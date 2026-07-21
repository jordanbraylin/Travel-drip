import {
  applySecurityHeaders,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole
} from "./_security.js";

export default async function handler(request, response) {
  applySecurityHeaders(response);

  if (request.method !== "GET") {
    methodNotAllowed(response, "GET");
    return;
  }

  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const url = new URL(request.url, "https://traveldrip.local");
  const tripId = url.searchParams.get("tripId");

  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }

  const canViewAudit = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canViewAudit) {
    response.status(403).json({ error: "Audit access required" });
    return;
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(200).json({ auditLogs: data || [] });
}
