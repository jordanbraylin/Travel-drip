import { createClient } from "@supabase/supabase-js";

function getToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = getToken(request);
  const { subscription } = getRequestBody(request);

  if (!token || !subscription?.endpoint) {
    response.status(400).json({ error: "Missing user token or push subscription" });
    return;
  }

  const supabaseConfig = getSupabaseServerConfig();
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    response.status(503).json({ error: "Supabase server environment variables are not configured" });
    return;
  }

  const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { error: upsertError } = await supabase
    .from("push_subscriptions")
    .upsert({
      user_id: data.user.id,
      endpoint: subscription.endpoint,
      subscription,
      updated_at: new Date().toISOString()
    }, { onConflict: "endpoint" });

  if (upsertError) {
    response.status(500).json({ error: upsertError.message });
    return;
  }

  response.status(200).json({ ok: true });
}
