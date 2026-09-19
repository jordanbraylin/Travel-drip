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

  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST, PATCH, DELETE");
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
    const { data, error } = await supabase
      .from("schedule_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("starts_at", { ascending: true });

    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    response.status(200).json({ scheduleItems: data || [] });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "team_lead"]);
  if (!canManage) {
    response.status(403).json({ error: "Schedule manager access required" });
    return;
  }

  if (request.method === "DELETE") {
    const itemId = body.itemId || body.item_id || url.searchParams.get("itemId");
    if (!itemId) {
      response.status(400).json({ error: "itemId is required" });
      return;
    }

    const { error } = await supabase.from("schedule_items").delete().eq("id", itemId).eq("trip_id", tripId);
    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }

    await writeAuditLog(supabase, {
      actorUserId: user.id,
      tripId,
      action: "schedule.deleted",
      entityType: "schedule_item",
      entityId: itemId
    });

    response.status(200).json({ ok: true });
    return;
  }

  const record = {
    trip_id: tripId,
    title: sanitizeText(body.title, "Untitled schedule item", 160),
    item_type: sanitizeText(body.itemType || body.item_type, "activity", 60),
    starts_at: body.startsAt || body.starts_at || null,
    ends_at: body.endsAt || body.ends_at || null,
    location_name: sanitizeText(body.locationName || body.location_name, "", 180),
    location_address: sanitizeText(body.locationAddress || body.location_address, "", 240),
    visibility: sanitizeText(body.visibility, "members", 40),
    details: body.details || {},
    updated_at: new Date().toISOString()
  };

  let query;
  if (request.method === "POST") {
    query = supabase.from("schedule_items").insert({
      ...record,
      created_by: user.id
    });
  } else {
    const itemId = body.itemId || body.item_id;
    if (!itemId) {
      response.status(400).json({ error: "itemId is required" });
      return;
    }
    query = supabase.from("schedule_items").update(record).eq("id", itemId).eq("trip_id", tripId);
  }

  const { data, error } = await query.select("*").single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: request.method === "POST" ? "schedule.created" : "schedule.updated",
    entityType: "schedule_item",
    entityId: data.id,
    metadata: { title: data.title, itemType: data.item_type }
  });

  response.status(request.method === "POST" ? 201 : 200).json({ scheduleItem: data });
}
