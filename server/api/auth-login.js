import {
  applySecurityHeaders,
  createSupabaseAdminClient,
  getRequestBody,
  getSupabaseServerConfig,
  methodNotAllowed,
  sanitizeText
} from "./_security.js";

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

function getPublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || "";
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") return methodNotAllowed(response, "POST");

  const body = getRequestBody(request);
  const username = sanitizeText(body.username, "", 24).toLowerCase();
  const password = String(body.password || "");
  if (!USERNAME_PATTERN.test(username) || password.length < 6 || password.length > 128) {
    response.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const { client: supabase, error: configError } = createSupabaseAdminClient();
  const { url } = getSupabaseServerConfig();
  const publishableKey = getPublishableKey();
  if (configError || !url || !publishableKey) {
    response.status(503).json({ error: "Account login is temporarily unavailable" });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (profileError || !profile?.id) {
    response.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(profile.id);
  const email = userResult?.user?.email;
  if (userError || !email) {
    response.status(401).json({ error: "Invalid username or password" });
    return;
  }

  let authResponse;
  try {
    authResponse = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": publishableKey
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000)
    });
  } catch (_error) {
    response.status(503).json({ error: "Account login is temporarily unavailable" });
    return;
  }

  const authResult = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok) {
    const authError = String(authResult?.msg || authResult?.error_description || "");
    const error = /email not confirmed/i.test(authError)
      ? "Verify your email before signing in."
      : "Invalid username or password";
    response.status(authResponse.status === 400 ? 401 : authResponse.status).json({ error });
    return;
  }

  if (!authResult.access_token || !authResult.refresh_token) {
    response.status(502).json({ error: "Account login is temporarily unavailable" });
    return;
  }

  response.status(200).json({
    accessToken: authResult.access_token,
    refreshToken: authResult.refresh_token,
    expiresIn: authResult.expires_in || null
  });
}
