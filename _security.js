import { createClient } from "@supabase/supabase-js";

export function applySecurityHeaders(response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

export function methodNotAllowed(response, method) {
  response.setHeader("Allow", method);
  response.status(405).json({ error: "Method not allowed" });
}

export function getRequestBody(request) {
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

export function getBearerToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function getSupabaseServerConfig() {
  return {
    url: process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || "https://bfuiqmmbsgfcnyeneunv.supabase.co",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

export function createSupabaseAdminClient() {
  const config = getSupabaseServerConfig();
  if (!config.url || !config.serviceRoleKey) {
    return { client: null, error: "Supabase server environment variables are not configured" };
  }
  return {
    client: createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }),
    error: null
  };
}

export async function requireAuthenticatedUser(request, response) {
  const token = getBearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Unauthorized" });
    return { user: null, supabase: null };
  }

  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return { user: null, supabase: null };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    response.status(401).json({ error: "Unauthorized" });
    return { user: null, supabase: null };
  }

  return { user: data.user, supabase };
}

export async function requireTripRole(supabase, tripId, userId, allowedRoles = []) {
  const { data, error } = await supabase
    .from("trip_members")
    .select("role, status")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || data.status !== "active") return false;
  if (!allowedRoles.length) return true;
  return allowedRoles.includes(data.role);
}

export async function writeAuditLog(supabase, {
  actorUserId,
  tripId,
  organizationId = null,
  action,
  entityType,
  entityId = null,
  metadata = {}
}) {
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId,
    trip_id: tripId || null,
    organization_id: organizationId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });
}

export function sanitizeText(value, fallback = "", maxLength = 240) {
  return String(value || fallback).trim().slice(0, maxLength);
}
