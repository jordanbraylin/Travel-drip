import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  sanitizeText
} from "./_security.js";

const ENTITY_TYPES = new Set(["auto", "trip", "event"]);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function requestedEntityType(value) {
  const type = sanitizeText(value, "auto", 20).toLowerCase();
  return ENTITY_TYPES.has(type) ? type : "auto";
}

async function resolveWorkspace(supabase, userId, tripId, entityType = "auto") {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, owner_user_id, organization_id, title, destination, trip_type, status")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError) throw new Error(tripError.message);
  if (!trip) return { error: "Trip was not found", status: 404 };

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, host_user_id, title, status")
    .eq("id", tripId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (entityType === "event" && !event) return { error: "Event was not found", status: 404 };

  // Events share the trip id in this schema, so always keep both owner records in sync.
  const isEvent = Boolean(event);
  const ownerId = isEvent ? event?.host_user_id : trip.owner_user_id;
  if (ownerId !== userId) {
    return {
      error: isEvent ? "Only the current event owner can manage ownership." : "Only the current trip owner can manage ownership.",
      status: 403
    };
  }

  return { trip, event: isEvent ? event : null, entityType: isEvent ? "event" : "trip" };
}

async function listOwnershipCandidates(request, response, supabase, user) {
  const url = new URL(request.url, "https://traveldrip.local");
  const tripId = url.searchParams.get("tripId") || url.searchParams.get("eventId") || "";
  const entityType = requestedEntityType(url.searchParams.get("entityType"));
  if (!isUuid(tripId)) {
    response.status(400).json({ error: "A valid tripId is required" });
    return;
  }

  const workspace = await resolveWorkspace(supabase, user.id, tripId, entityType);
  if (workspace.error) {
    response.status(workspace.status).json({ error: workspace.error });
    return;
  }

  const { data: memberships, error: memberError } = await supabase
    .from("trip_members")
    .select("user_id, role, status, created_at")
    .eq("trip_id", tripId)
    .eq("status", "active")
    .neq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (memberError) throw new Error(memberError.message);

  let activeEventUserIds = null;
  if (workspace.entityType === "event") {
    const { data: eventMembers, error: eventMemberError } = await supabase
      .from("event_members")
      .select("user_id, role, status")
      .eq("event_id", tripId)
      .eq("status", "active");
    if (eventMemberError) throw new Error(eventMemberError.message);
    activeEventUserIds = new Set((eventMembers || []).map((member) => member.user_id));
  }

  const eligibleMembers = (memberships || []).filter((member) => !activeEventUserIds || activeEventUserIds.has(member.user_id));
  const userIds = eligibleMembers.map((member) => member.user_id);
  let profiles = [];
  if (userIds.length) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", userIds);
    if (profileError) throw new Error(profileError.message);
    profiles = data || [];
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  response.status(200).json({
    tripId,
    entityType: workspace.entityType,
    trip: {
      title: workspace.trip.title,
      destination: workspace.trip.destination,
      tripType: workspace.trip.trip_type,
      status: workspace.trip.status
    },
    ownerUserId: user.id,
    members: eligibleMembers.map((member) => {
      const profile = profileById.get(member.user_id) || {};
      return {
        userId: member.user_id,
        fullName: profile.full_name || "Travel-Drip member",
        username: profile.username || "",
        currentRole: member.role
      };
    })
  });
}

function transferErrorStatus(error) {
  const message = String(error?.message || "");
  if (/only the current|must be an active|choose another|membership is not active/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  return 500;
}

async function transferOwnership(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id || body.eventId || body.event_id, "", 80);
  const newOwnerUserId = sanitizeText(body.newOwnerUserId || body.new_owner_user_id, "", 80);
  const entityType = requestedEntityType(body.entityType || body.entity_type);
  const leaveAfterTransfer = body.leaveAfterTransfer === true || body.leave_after_transfer === true;
  if (!isUuid(tripId) || !isUuid(newOwnerUserId)) {
    response.status(400).json({ error: "Valid tripId and newOwnerUserId are required" });
    return;
  }
  if (newOwnerUserId === user.id) {
    response.status(400).json({ error: "Choose another active trip member as the new owner" });
    return;
  }

  const workspace = await resolveWorkspace(supabase, user.id, tripId, entityType);
  if (workspace.error) {
    response.status(workspace.status).json({ error: workspace.error });
    return;
  }

  const { data, error } = await supabase.rpc("transfer_trip_or_event_ownership", {
    p_trip_id: tripId,
    p_new_owner_user_id: newOwnerUserId,
    p_actor_user_id: user.id,
    p_leave_after_transfer: leaveAfterTransfer
  });
  if (error) {
    response.status(transferErrorStatus(error)).json({ error: error.message, code: error.code || "ownership_transfer_failed" });
    return;
  }

  response.status(200).json({
    ok: true,
    transfer: data,
    entityType: workspace.entityType,
    message: leaveAfterTransfer
      ? "Ownership transferred. Your access has been changed to a former participant."
      : "Ownership transferred. You remain an organizer without owner-level control."
  });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!["GET", "POST"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST");
    return;
  }

  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  try {
    if (request.method === "GET") {
      await listOwnershipCandidates(request, response, supabase, user);
      return;
    }
    await transferOwnership(response, supabase, user, getRequestBody(request));
  } catch (error) {
    response.status(500).json({ error: error.message || "Ownership transfer failed" });
  }
}
