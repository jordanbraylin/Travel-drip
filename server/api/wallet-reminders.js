import { applySecurityHeaders, createSupabaseAdminClient, methodNotAllowed } from "./_security.js";
import { dispatchQueuedNotifications } from "./_push-notifications.js";

function authorized(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const bearer = String(request.headers.authorization || "");
  const supplied = bearer.startsWith("Bearer ") ? bearer.slice(7) : String(request.headers["x-cron-secret"] || "");
  return supplied === secret;
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!['GET', 'POST'].includes(request.method)) {
    methodNotAllowed(response, "GET, POST");
    return;
  }
  if (!authorized(request)) {
    response.status(process.env.CRON_SECRET ? 401 : 503).json({
      error: process.env.CRON_SECRET ? "Invalid cron authorization" : "CRON_SECRET is not configured"
    });
    return;
  }

  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError || !supabase) {
    response.status(503).json({ error: configError || "Supabase server environment variables are not configured" });
    return;
  }

  const { data: queued, error: queueError } = await supabase.rpc("notify_due_trip_wallet_payments");
  if (queueError) {
    response.status(500).json({ error: queueError.message });
    return;
  }

  try {
    const push = await dispatchQueuedNotifications(supabase);
    response.status(200).json({ ok: true, overdueRequestsQueued: Number(queued || 0), push });
  } catch (error) {
    response.status(500).json({ error: error.message || "Wallet reminder dispatch failed" });
  }
}
