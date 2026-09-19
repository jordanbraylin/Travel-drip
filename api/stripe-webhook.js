import { createHmac, timingSafeEqual } from "node:crypto";
import { applySecurityHeaders, createSupabaseAdminClient } from "../server/api/_security.js";
import { dispatchQueuedNotifications } from "../server/api/_push-notifications.js";

export const config = { api: { bodyParser: false } };

function rawBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody.toString("utf8");
  if (typeof request.rawBody === "string") return request.rawBody;
  if (Buffer.isBuffer(request.body)) return request.body.toString("utf8");
  return typeof request.body === "string" ? request.body : "";
}

function validStripeSignature(payload, header, secret) {
  const parts = String(header || "").split(",").reduce((result, item) => {
    const [key, value] = item.split("=", 2);
    if (key && value) result[key] = result[key] ? [].concat(result[key], value) : value;
    return result;
  }, {});
  const timestamp = Number(parts.t);
  const signature = Array.isArray(parts.v1) ? parts.v1 : [parts.v1];
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signature.some((candidate) => {
    if (!candidate || candidate.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(candidate, "utf8"));
  });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const payload = rawBody(request);
  if (!secret || !payload || !validStripeSignature(payload, request.headers["stripe-signature"], secret)) {
    response.status(400).json({ error: "Invalid Stripe webhook signature" });
    return;
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch (_error) {
    response.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    response.status(200).json({ received: true, ignored: true });
    return;
  }

  const session = event.data?.object || {};
  if (session.payment_status !== "paid") {
    response.status(200).json({ received: true, pending: true });
    return;
  }

  const contributionId = session.metadata?.contribution_id || session.client_reference_id;
  const tripId = session.metadata?.trip_id;
  const amountCents = Number(session.amount_total);
  if (!contributionId || !tripId || !Number.isInteger(amountCents) || amountCents < 1) {
    response.status(400).json({ error: "Contribution metadata is incomplete" });
    return;
  }

  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError || !supabase) {
    response.status(503).json({ error: configError || "Supabase server environment variables are not configured" });
    return;
  }

  const { error } = await supabase.rpc("complete_trip_wallet_contribution", {
    p_contribution_id: contributionId,
    p_trip_id: tripId,
    p_amount_cents: amountCents,
    p_provider_ref: String(session.payment_intent || session.id)
  });
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  let push = { enabled: false, sent: 0, checked: 0 };
  try {
    const { data: notifications } = await supabase
      .from("notifications")
      .select("id")
      .eq("trip_id", tripId)
      .eq("notification_type", "wallet_deposit_confirmed")
      .contains("metadata", { contribution_id: contributionId })
      .eq("status", "queued");
    push = await dispatchQueuedNotifications(supabase, { notificationIds: (notifications || []).map((item) => item.id) });
  } catch (pushError) {
    console.error("Wallet deposit push dispatch failed", pushError);
  }

  response.status(200).json({ received: true, contributionCompleted: true, push });
}
