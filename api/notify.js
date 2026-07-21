import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { applySecurityHeaders, methodNotAllowed } from "./_security.js";

function getToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function getAdminEmails() {
  return (process.env.SUPABASE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getSupabaseServerConfig() {
  return {
    url: process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "https://bfuiqmmbsgfcnyeneunv.supabase.co",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

function getRequestBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch (_error) {
      return {};
    }
  }
  return request.body;
}

function getNotificationUrl(value) {
  const fallback = "/";
  const raw = String(value || fallback).slice(0, 200);
  if (raw.startsWith("/")) return raw;

  try {
    const url = new URL(raw);
    return url.pathname + url.search + url.hash;
  } catch (_error) {
    return fallback;
  }
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }

  const token = getToken(request);
  const supabaseConfig = getSupabaseServerConfig();
  const vapidReady = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    response.status(503).json({ error: "Supabase server environment variables are not configured" });
    return;
  }

  if (!vapidReady) {
    response.status(503).json({ error: "VAPID push notification keys are not configured" });
    return;
  }

  const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  const email = data.user.email?.toLowerCase();
  if (!email || !getAdminEmails().includes(email)) {
    response.status(403).json({ error: "Admin access required" });
    return;
  }

  const requestBody = getRequestBody(request);
  const title = String(requestBody.title || "Traveldrip update").slice(0, 80);
  const body = String(requestBody.body || "You have a trip update.").slice(0, 180);
  const url = getNotificationUrl(requestBody.url);

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, subscription");

  if (subscriptionError) {
    response.status(500).json({ error: subscriptionError.message });
    return;
  }

  let sent = 0;
  const payload = JSON.stringify({ title, body, url });

  await Promise.all((subscriptions || []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent += 1;
    } catch (sendError) {
      if (sendError.statusCode === 404 || sendError.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
    }
  }));

  response.status(200).json({ sent });
}
