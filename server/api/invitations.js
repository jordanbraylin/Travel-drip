import crypto from "node:crypto";
import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function appBaseUrl(request) {
  const configured = String(process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto = String(request.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "travel-drip.com").split(",")[0].trim();
  return `${proto}://${host}`;
}

const allowedInvitationRoles = new Set(["traveler", "employee", "team_lead", "guest", "vendor"]);

export default async function handler(request, response) {
  applySecurityHeaders(response);

  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST, PATCH");
    return;
  }

  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const url = new URL(request.url, "https://traveldrip.local");
  const body = getRequestBody(request);
  const tripId = body.tripId || body.trip_id || url.searchParams.get("tripId");

  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }

  if (request.method === "GET") {
    const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer"]);
    if (!canManage) {
      response.status(403).json({ error: "Invitation manager access required" });
      return;
    }

    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    response.status(200).json({ invitations: data || [] });
    return;
  }

  if (request.method === "POST") {
    const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer"]);
    if (!canManage) {
      response.status(403).json({ error: "Invitation manager access required" });
      return;
    }

    const inviteeEmail = sanitizeText(body.inviteeEmail || body.invitee_email, "", 180).toLowerCase();
    const inviteeUsername = sanitizeText(body.inviteeUsername || body.invitee_username, "", 80).replace(/^@/, "").toLowerCase();
    if (!inviteeEmail && !inviteeUsername) {
      response.status(400).json({ error: "An email address or Travel-Drip username is required" });
      return;
    }

    let inviteeUserId = null;
    if (inviteeUsername) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", inviteeUsername)
        .maybeSingle();
      if (profileError) {
        response.status(500).json({ error: "The username could not be checked" });
        return;
      }
      if (!profile) {
        response.status(404).json({ error: "No verified Travel-Drip account uses that username" });
        return;
      }
      inviteeUserId = profile.id;
    }

    const token = createInviteToken();
    const requestedRole = sanitizeText(body.role, "traveler", 40);
    const role = allowedInvitationRoles.has(requestedRole) ? requestedRole : "traveler";
    const expiresAt = body.expiresAt || body.expires_at || new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        trip_id: tripId,
        inviter_user_id: user.id,
        invitee_email: inviteeEmail || null,
        invitee_user_id: inviteeUserId,
        invitee_name: sanitizeText(body.inviteeName || body.invitee_name, "", 140),
        role,
        delivery_methods: Array.isArray(body.deliveryMethods || body.delivery_methods)
          ? body.deliveryMethods || body.delivery_methods
          : ["email"],
        status: "pending",
        token,
        expires_at: expiresAt,
        customization: body.customization || {}
      })
      .select("*")
      .single();

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    await writeAuditLog(supabase, {
      actorUserId: user.id,
      tripId,
      action: "invitation.created",
      entityType: "invitation",
      entityId: data.id,
      metadata: { inviteeEmail: inviteeEmail || null, inviteeUsername: inviteeUsername || null, deliveryMethods: data.delivery_methods }
    });

    const shareUrl = `${appBaseUrl(request)}/?tripId=${encodeURIComponent(tripId)}&inviteToken=${encodeURIComponent(token)}`;
    response.status(201).json({
      invitation: data,
      shareUrl,
      delivery: {
        email: inviteeEmail ? "provider_required" : "not_requested",
        inApp: inviteeUserId ? "ready" : "not_targeted"
      }
    });
    return;
  }

  const invitationId = body.invitationId || body.invitation_id;
  const token = sanitizeText(body.token, "", 160);
  const status = sanitizeText(body.status, "", 40);
  if ((!invitationId && !token) || !["accepted", "maybe", "declined", "cancelled"].includes(status)) {
    response.status(400).json({ error: "Valid invitationId or token and status are required" });
    return;
  }

  if (invitationId && !token) {
    const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer"]);
    if (!canManage) {
      response.status(403).json({ error: "Invitation token or manager access required" });
      return;
    }
  }

  let existingQuery = supabase.from("invitations").select("*").eq("trip_id", tripId);
  existingQuery = invitationId ? existingQuery.eq("id", invitationId) : existingQuery.eq("token", token);
  const { data: existingInvitation, error: lookupError } = await existingQuery.maybeSingle();
  if (lookupError || !existingInvitation) {
    response.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (token) {
    if (existingInvitation.invitee_user_id && existingInvitation.invitee_user_id !== user.id) {
      response.status(403).json({ error: "This invitation belongs to another Travel-Drip account" });
      return;
    }
    if (existingInvitation.invitee_email && existingInvitation.invitee_email.toLowerCase() !== String(user.email || "").toLowerCase()) {
      response.status(403).json({ error: "Sign in with the email address that received this invitation" });
      return;
    }
    if (existingInvitation.expires_at && new Date(existingInvitation.expires_at).getTime() < Date.now()) {
      response.status(410).json({ error: "This invitation has expired" });
      return;
    }
  }

  const update = {
    status,
    responded_at: new Date().toISOString()
  };
  if (token) update.invitee_user_id = user.id;
  let query = supabase.from("invitations").update(update).eq("id", existingInvitation.id);
  const { data, error } = await query.select("*").single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  if (status === "accepted") {
    await supabase.from("trip_members").upsert({
      trip_id: tripId,
      user_id: user.id,
      role: data.role || "traveler",
      status: "active",
      invited_by: data.inviter_user_id
    }, { onConflict: "trip_id,user_id" });
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: `invitation.${status}`,
    entityType: "invitation",
    entityId: data.id
  });

  response.status(200).json({ invitation: data });
}
