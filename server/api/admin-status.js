import { createClient } from "@supabase/supabase-js";
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
      || "https://osjexitranwtndehqyxw.supabase.co",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "GET") {
    methodNotAllowed(response, "GET");
    return;
  }

  const token = getToken(request);
  const supabaseConfig = getSupabaseServerConfig();

  if (!token) {
    response.status(401).json({ error: "Unauthorized", isAdmin: false });
    return;
  }

  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    response.status(503).json({ error: "Supabase server environment variables are not configured", isAdmin: false });
    return;
  }

  const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    response.status(401).json({ error: "Unauthorized", isAdmin: false });
    return;
  }

  const email = data.user.email?.toLowerCase();
  const isAdmin = Boolean(email && getAdminEmails().includes(email));
  response.status(200).json({ isAdmin });
}
