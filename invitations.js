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
    if (!inviteeEmail) {
      response.status(400).json({ error: "inviteeEmail is required" });
      return;
    }

    const token = createInviteToken();
    const expiresAt = body.expiresAt || body.expires_at || new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        trip_id: tripId,
        inviter_user_id: user.id,
        invitee_email: inviteeEmail,
        invitee_name: sanitizeText(body.inviteeName || body.invitee_name, "", 140),
        role: sanitizeText(body.role, "traveler", 40),
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
      metadata: { inviteeEmail, deliveryMethods: data.delivery_methods }
    });

    response.status(201).json({ invitation: data });
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

  let query = supabase
    .from("invitations")
    .update({
      status,
      responded_at: new Date().toISOString(),
      invitee_user_id: user.id
    })
    .eq("trip_id", tripId);

  query = invitationId ? query.eq("id", invitationId) : query.eq("token", token);
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
    entityId: invitationId
  });

  response.status(200).json({ invitation: data });
}
