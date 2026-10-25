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

  if (request.method === "GET" && url.searchParams.get("scope") === "incoming") {
    const { data, error } = await supabase.from("invitations")
      .select("id, trip_id, token, expires_at, customization")
      .eq("invitee_user_id", user.id).eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(50);
    response.status(error ? 500 : 200).json(error ? { error: "Could not load invitations" } : { invitations: data || [] });
    return;
  }

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
    const inviteeMobile = sanitizeText(body.inviteeMobile, "", 30).replace(/[\s().-]/g, "");
    if ([inviteeEmail, inviteeUsername, inviteeMobile].filter(Boolean).length !== 1) {
      response.status(400).json({ error: "Choose one recipient: email, username, or mobile number" });
      return;
    }
    if ((inviteeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) ||
        (inviteeUsername && !/^[a-z0-9_]{3,24}$/.test(inviteeUsername)) ||
        (inviteeMobile && !/^\+[1-9]\d{7,14}$/.test(inviteeMobile))) {
      response.status(400).json({ error: "Enter a valid email, username, or international mobile number" });
      return;
    }

    let inviteeUserId = null;
    if (inviteeUsername) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", inviteeUsername.replaceAll("_", "\\_"))
        .maybeSingle();
      if (profileError) {
        response.status(500).json({ error: "The username could not be checked" });
        return;
      }
      if (!profile) {
        response.status(404).json({ error: "No Travel-Drip account uses that username" });
        return;
      }
      inviteeUserId = profile.id;
    }

    const token = createInviteToken();
    const requestedRole = sanitizeText(body.role, "traveler", 40);
    const role = allowedInvitationRoles.has(requestedRole) ? requestedRole : "traveler";
    const expiresAt = body.expiresAt || body.expires_at || new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    if (!Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now()) {
      response.status(400).json({ error: "Invitation expiry must be a future date" });
      return;
    }
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
        customization: {
          title: sanitizeText(body.customization?.title, "Travel-Drip invitation", 160),
          message: sanitizeText(body.customization?.message, "", 2000),
          note: sanitizeText(body.customization?.note, "", 1000),
          ...(inviteeMobile ? { recipientMobile: inviteeMobile } : {})
        }
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
        sms: inviteeMobile ? "manual_compose" : "not_requested",
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
  if (invitationId) existingQuery = existingQuery.eq("id", invitationId);
  if (token) existingQuery = existingQuery.eq("token", token);
  const { data: existingInvitation, error: lookupError } = await existingQuery.maybeSingle();
  if (lookupError || !existingInvitation) {
    response.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (token) {
    if (["cancelled", "expired"].includes(existingInvitation.status)) {
      response.status(410).json({ error: "This invitation is no longer available" });
      return;
    }
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
  if (token && !existingInvitation.invitee_user_id) query = query.is("invitee_user_id", null);
  const { data, error } = await query.select("*").single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  if (status === "accepted") {
    const { error: membershipError } = await supabase.from("trip_members").upsert({
      trip_id: tripId,
      user_id: user.id,
      role: data.role || "traveler",
      status: "active",
      invited_by: data.inviter_user_id
    }, { onConflict: "trip_id,user_id" });
    if (membershipError) {
      response.status(500).json({ error: "Your response was saved, but trip access could not be added. Retry accepting the invitation." });
      return;
    }
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
