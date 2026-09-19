import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

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

  const isMember = await requireTripRole(supabase, tripId, user.id);
  if (!isMember) {
    response.status(403).json({ error: "Trip access required" });
    return;
  }

  if (request.method === "GET") {
    const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer"]);
    let query = supabase.from("rsvps").select("*").eq("trip_id", tripId);
    if (!canManage) query = query.eq("user_id", user.id);
    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    response.status(200).json({ rsvps: data || [] });
    return;
  }

  const status = sanitizeText(body.status, "accepted", 40);
  if (!["accepted", "maybe", "declined", "pending"].includes(status)) {
    response.status(400).json({ error: "Invalid RSVP status" });
    return;
  }

  const record = {
    trip_id: tripId,
    user_id: user.id,
    status,
    plus_one_count: Math.max(0, Number(body.plusOneCount || body.plus_one_count || 0)),
    meal_preference: sanitizeText(body.mealPreference || body.meal_preference, "", 120),
    dietary_needs: sanitizeText(body.dietaryNeeds || body.dietary_needs, "", 240),
    accessibility_needs: sanitizeText(body.accessibilityNeeds || body.accessibility_needs, "", 240),
    transportation_needed: Boolean(body.transportationNeeded || body.transportation_needed),
    hotel_needed: Boolean(body.hotelNeeded || body.hotel_needed),
    flight_needed: Boolean(body.flightNeeded || body.flight_needed),
    emergency_contact: body.emergencyContact || body.emergency_contact || {},
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("rsvps")
    .upsert(record, { onConflict: "trip_id,user_id" })
    .select("*")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "rsvp.updated",
    entityType: "rsvp",
    entityId: data.id,
    metadata: { status }
  });

  response.status(200).json({ rsvp: data });
}
