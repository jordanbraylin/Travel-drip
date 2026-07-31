import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

const eventTypes = new Set([
  "wedding",
  "birthday",
  "anniversary",
  "family_reunion",
  "conference",
  "graduation_trip",
  "church_retreat",
  "corporate_retreat",
  "bachelor_bachelorette",
  "business_event",
  "special_event"
]);

const eventModules = {
  wedding: ["overview", "guest_list", "rsvp", "ceremony", "reception", "hotel_block", "transportation", "wallet", "messages", "polls", "documents", "media", "completion"],
  birthday: ["overview", "guest_list", "rsvp", "dinner", "activities", "nightlife", "polls", "wallet", "messages", "media", "notifications", "completion"],
  anniversary: ["overview", "guest_list", "rsvp", "schedule", "hotel", "activities", "messages", "media", "notifications", "completion"],
  family_reunion: ["overview", "guest_list", "rsvp", "room_assignments", "meals", "activities", "announcements", "wallet", "documents", "media", "completion"],
  conference: ["overview", "registration", "sessions", "speakers", "tracks", "sponsors", "venue_rooms", "badges", "hotels", "transportation", "messages", "reports", "completion"],
  graduation_trip: ["overview", "guest_list", "rsvp", "travel", "dinner", "activities", "wallet", "messages", "media", "completion"],
  church_retreat: ["overview", "guest_list", "rsvp", "theme", "worship", "sessions", "meals", "transportation_groups", "emergency_contacts", "announcements", "documents", "completion"],
  corporate_retreat: ["overview", "employee_schedule", "announcements", "flights", "hotels", "transportation", "important_information", "reports", "audit_logs", "completion"],
  bachelor_bachelorette: ["overview", "guest_list", "rsvp", "activities", "dinner", "nightlife", "polls", "wallet", "transportation", "messages", "media", "completion"],
  business_event: ["overview", "guest_list", "rsvp", "schedule", "sessions", "transportation", "documents", "messages", "reports", "completion"],
  special_event: ["overview", "guest_list", "rsvp", "schedule", "activities", "wallet", "messages", "polls", "documents", "media", "notifications", "completion"]
};

const lifecycleStatuses = new Set(["draft", "active", "published", "archived", "completed", "cancelled"]);

function normalizeEventType(value) {
  const type = sanitizeText(value, "special_event", 80);
  return eventTypes.has(type) ? type : "special_event";
}

function moneyCents(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function getEventDetails(body) {
  const eventDetails = body.eventDetails || body.event_details || {};
  return {
    description: sanitizeText(eventDetails.description || body.description, "", 1200),
    host: sanitizeText(eventDetails.host || body.host || body.organizer, "", 180),
    guestCount: Math.max(0, Number(eventDetails.guestCount || eventDetails.guest_count || body.guestCount || body.guest_count || 0)),
    rsvpDeadline: eventDetails.rsvpDeadline || eventDetails.rsvp_deadline || body.rsvpDeadline || body.rsvp_deadline || null,
    travelRequired: Boolean(eventDetails.travelRequired ?? eventDetails.travel_required ?? body.travelRequired ?? body.travel_required),
    hotelRequired: Boolean(eventDetails.hotelRequired ?? eventDetails.hotel_required ?? body.hotelRequired ?? body.hotel_required),
    transportationRequired: Boolean(eventDetails.transportationRequired ?? eventDetails.transportation_required ?? body.transportationRequired ?? body.transportation_required),
    inviteApprovalRequired: Boolean(eventDetails.inviteApprovalRequired ?? eventDetails.invite_approval_required ?? body.inviteApprovalRequired ?? body.invite_approval_required),
    specific: eventDetails.specific && typeof eventDetails.specific === "object" ? eventDetails.specific : {}
  };
}

async function listEvents(request, response, supabase, user) {
  const { searchParams } = new URL(request.url, "https://traveldrip.local");
  const eventId = searchParams.get("eventId") || searchParams.get("tripId");

  if (eventId) {
    const isMember = await requireTripRole(supabase, eventId, user.id);
    if (!isMember) {
      response.status(403).json({ error: "Event access required" });
      return;
    }

    const { data, error } = await supabase.from("trips").select("*").eq("id", eventId).single();
    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }
    response.status(200).json({ event: data });
    return;
  }

  const { data, error } = await supabase
    .from("trip_members")
    .select("role, status, trips(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(200).json({
    events: (data || [])
      .map((row) => ({ ...row.trips, myRole: row.role, myStatus: row.status }))
      .filter((event) => eventTypes.has(event.trip_type))
  });
}

async function createEvent(response, supabase, user, body) {
  const eventType = normalizeEventType(body.eventType || body.event_type || body.tripType || body.trip_type);
  const title = sanitizeText(body.title || body.name || body.eventName || body.event_name, "Untitled Travel-Drip event", 180);
  const destination = sanitizeText(body.destination, "Destination TBD", 180);
  const details = getEventDetails(body);
  const modules = eventModules[eventType] || eventModules.special_event;
  const status = lifecycleStatuses.has(body.status) ? body.status : "draft";

  const { data: eventRecord, error } = await supabase
    .from("trips")
    .insert({
      owner_user_id: user.id,
      organization_id: body.organizationId || body.organization_id || null,
      trip_type: eventType,
      title,
      destination,
      starts_on: body.startsOn || body.starts_on || null,
      ends_on: body.endsOn || body.ends_on || null,
      budget_cents: moneyCents(body.budgetCents || body.budget_cents),
      privacy: sanitizeText(body.privacy, "invite_only", 40),
      status,
      settings: {
        eventPlanningVersion: 1,
        eventDetails: details,
        currency: sanitizeText(body.currency, "USD", 12),
        inviteSettings: body.inviteSettings || body.invite_settings || {},
        coverPhoto: body.coverPhoto || body.cover_photo || null
      }
    })
    .select("*")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const { error: eventError } = await supabase.from("events").insert({
    id: eventRecord.id,
    event_type: eventType,
    title,
    description: details.description,
    destination,
    host_user_id: user.id,
    organization_id: eventRecord.organization_id,
    guest_count: details.guestCount,
    rsvp_deadline: details.rsvpDeadline,
    currency: sanitizeText(body.currency, "USD", 12),
    budget_cents: eventRecord.budget_cents,
    starts_on: eventRecord.starts_on,
    ends_on: eventRecord.ends_on,
    privacy: eventRecord.privacy,
    status: eventRecord.status,
    travel_required: details.travelRequired,
    hotel_required: details.hotelRequired,
    transportation_required: details.transportationRequired,
    event_details: details.specific
  });

  if (eventError) {
    response.status(500).json({ error: eventError.message });
    return;
  }

  await supabase.from("trip_members").insert({
    trip_id: eventRecord.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    permissions: { all: true, eventHost: true }
  });

  await supabase.from("event_members").insert({
    event_id: eventRecord.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    permissions: { all: true, eventHost: true }
  });

  await supabase.from("trip_feature_flags").insert({
    trip_id: eventRecord.id,
    flags: {
      event_planning: true,
      invitations: true,
      rsvp: true,
      schedules: true,
      travel_records: true,
      wallet: eventType !== "conference" || Boolean(body.enableWallet),
      messages: true,
      polls: true,
      media: true,
      notifications: true,
      completion: true
    }
  });

  await supabase.from("trip_modules").insert(modules.map((moduleKey, index) => ({
    trip_id: eventRecord.id,
    module_key: moduleKey,
    enabled: true,
    sort_order: index + 1
  })));

  if (eventType !== "conference" || Boolean(body.enableWallet)) {
    await supabase.from("event_wallets").insert({
      event_id: eventRecord.id,
      currency: sanitizeText(body.currency, "USD", 12),
      status: "provider_required",
      settings: {
        requiresPaymentProvider: true,
        pinRequired: true,
        refundableBalanceTracking: true,
        idempotencyRequired: true
      }
    });
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId: eventRecord.id,
    organizationId: eventRecord.organization_id,
    action: "event.created",
    entityType: "event",
    entityId: eventRecord.id,
    metadata: { eventType, modules, guestCount: details.guestCount }
  });

  response.status(201).json({ event: eventRecord, modules });
}

async function updateLifecycle(request, response, supabase, user, body) {
  const eventId = body.eventId || body.event_id || body.tripId || body.trip_id;
  if (!eventId) {
    response.status(400).json({ error: "eventId is required" });
    return;
  }

  const canManage = await requireTripRole(supabase, eventId, user.id, ["owner", "admin", "organizer", "event_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Event organizer access required" });
    return;
  }

  const action = sanitizeText(body.action || request.method.toLowerCase(), "update", 40);
  const statusByAction = {
    publish: "published",
    archive: "archived",
    complete: "completed",
    cancel: "cancelled",
    update: body.status
  };
  const status = lifecycleStatuses.has(statusByAction[action]) ? statusByAction[action] : null;

  const updates = { updated_at: new Date().toISOString() };
  if (body.title || body.name) updates.title = sanitizeText(body.title || body.name, "", 180);
  if (body.destination) updates.destination = sanitizeText(body.destination, "", 180);
  if (status) updates.status = status;
  if (body.eventDetails || body.event_details || body.description) {
    updates.settings = {
      eventPlanningVersion: 1,
      eventDetails: getEventDetails(body)
    };
  }

  const { data, error } = await supabase
    .from("trips")
    .update(updates)
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const eventUpdates = {};
  if (updates.title) eventUpdates.title = updates.title;
  if (updates.destination) eventUpdates.destination = updates.destination;
  if (updates.status) eventUpdates.status = updates.status;
  if (body.eventDetails || body.event_details || body.description) {
    const details = getEventDetails(body);
    eventUpdates.description = details.description;
    eventUpdates.guest_count = details.guestCount;
    eventUpdates.rsvp_deadline = details.rsvpDeadline;
    eventUpdates.travel_required = details.travelRequired;
    eventUpdates.hotel_required = details.hotelRequired;
    eventUpdates.transportation_required = details.transportationRequired;
    eventUpdates.event_details = details.specific;
  }
  if (Object.keys(eventUpdates).length) {
    eventUpdates.updated_at = new Date().toISOString();
    const { error: eventUpdateError } = await supabase.from("events").update(eventUpdates).eq("id", eventId);
    if (eventUpdateError) {
      response.status(500).json({ error: eventUpdateError.message });
      return;
    }
  }

  if (action === "complete") {
    await supabase.from("notifications").insert({
      trip_id: eventId,
      user_id: user.id,
      notification_type: "event_completed",
      title: "Event marked complete",
      body: "The host completed this event. Wallet reconciliation, reports, memories, and archive steps are ready.",
      channels: ["in_app"],
      metadata: { eventId }
    });
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId: eventId,
    organizationId: data.organization_id,
    action: `event.${action}`,
    entityType: "event",
    entityId: eventId,
    metadata: updates
  });

  response.status(200).json({ event: data });
}

async function deleteEvent(response, supabase, user, body, requestUrl) {
  const url = new URL(requestUrl, "https://traveldrip.local");
  const eventId = body.eventId || body.event_id || url.searchParams.get("eventId");
  if (!eventId) {
    response.status(400).json({ error: "eventId is required" });
    return;
  }

  const canDelete = await requireTripRole(supabase, eventId, user.id, ["owner"]);
  if (!canDelete) {
    response.status(403).json({ error: "Only the event owner can delete this event" });
    return;
  }

  const { error } = await supabase.from("trips").delete().eq("id", eventId);
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  response.status(200).json({ ok: true });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST, PATCH, DELETE");
    return;
  }

  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const body = getRequestBody(request);
  if (request.method === "GET") return listEvents(request, response, supabase, user);
  if (request.method === "POST") return createEvent(response, supabase, user, body);
  if (request.method === "PATCH") return updateLifecycle(request, response, supabase, user, body);
  return deleteEvent(response, supabase, user, body, request.url);
}
