const target = process.argv.find((argument) => /^https?:\/\//.test(argument)) || "https://travel-drip.com";
const base = new URL(target);
if (base.username || base.password || (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname))) {
  throw new Error("Use an HTTPS site URL without embedded credentials.");
}
const checks = [];
const record = (name, passed, detail) => checks.push({ name, status: passed ? "pass" : "blocked", detail });
async function request(path, options = {}) {
  try {
    const response = await fetch(new URL(path, base), { ...options, redirect: "error", signal: AbortSignal.timeout(25000) });
    const text = await response.text();
    let body = {};
    try { body = JSON.parse(text); } catch { /* Static assets are not JSON. */ }
    return { status: response.status, ok: response.ok, body, text, headers: response.headers };
  } catch {
    return { status: 0, ok: false, body: {}, text: "", headers: new Headers() };
  }
}
const post = (path, body) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

for (const path of ["/login", "/register", "/dashboard", "/travel", "/wallet", "/chat"]) {
  const result = await request(path);
  record(`page:${path}`, result.ok && result.text.includes('id="authPanel"'), `HTTP ${result.status}; page shell only, not a signed-in journey`);
}
const health = await request("/api/health", { cache: "no-store" });
record("core-configuration", health.ok && (health.body.coreReady ?? health.body.ready) === true, "Environment presence only");
const config = await request("/api/config", { cache: "no-store" });
record("public-config", config.ok && Boolean(config.body.supabaseUrl && config.body.supabaseAnonKey), `HTTP ${config.status}`);
if (config.body.supabaseUrl && config.body.supabaseAnonKey) {
  try {
    const auth = await fetch(new URL("/auth/v1/health", config.body.supabaseUrl), {
      headers: { apikey: config.body.supabaseAnonKey }, signal: AbortSignal.timeout(10000)
    });
    record("auth-service", auth.ok, `HTTP ${auth.status}; credentials not exercised`);
  } catch { record("auth-service", false, "Could not reach authentication service"); }
}
for (const path of ["/api/trips", "/api/wallet", "/api/chat", "/api/schedule", "/api/corporate-bookings"]) {
  const result = await request(path);
  record(`private-access:${path}`, result.status === 401, `Unauthenticated request: HTTP ${result.status}`);
}
const places = await post("/api/travel-search", { query: "restaurants", destination: "New York", category: "food", limit: 1 });
const validAiSearch = places.body.provider === "openai" && Boolean(places.body.text?.trim()) && Array.isArray(places.body.citations) && places.body.citations.length > 0;
let validFreeSearch = false;
try {
  const url = new URL(places.body.searchUrl);
  validFreeSearch = places.body.provider === "duckduckgo" && places.body.free === true && places.body.searchMode === "external_results"
    && url.origin === "https://duckduckgo.com" && url.pathname === "/" && Boolean(url.searchParams.get("q"));
} catch { /* A provider-backed response does not have an external search URL. */ }
record("primary-web-search", places.ok && (validFreeSearch || (places.body.live === true && (validAiSearch || Array.isArray(places.body.results)))), `HTTP ${places.status}${validFreeSearch ? "; free external DuckDuckGo results" : places.body.code ? `; ${places.body.code}` : ""}`);
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const followingDay = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
const hotels = await post("/api/hotel-availability", { cityCode: "NYC", checkInDate: nextWeek, checkOutDate: followingDay, adults: 1 });
record("hotel-availability", hotels.ok && hotels.body.live === true && Array.isArray(hotels.body.results), `HTTP ${hotels.status}${hotels.body.code ? `; ${hotels.body.code}` : ""}`);
record("flight-provider-configured", Boolean(health.body.flightAwareConfigured), "A signed-in flight lookup is still required");
record("wallet-funding-configured", Boolean(health.body.walletFundingConfigured), "A provider-confirmed payment journey is still required");
if (process.argv.includes("--include-ai")) {
  const ai = await post("/api/ai-planner", { query: "Reply briefly to confirm the connection." });
  record("ai-response", ai.ok && Boolean(ai.body.text?.trim()), `HTTP ${ai.status}${ai.body.code ? `; ${ai.body.code}` : ""}`);
}
const blocked = checks.filter(({ status }) => status === "blocked");
console.log(JSON.stringify({ site: base.origin, checkedAt: new Date().toISOString(), allProbesPassed: blocked.length === 0, authenticatedJourneyVerified: false, checks }, null, 2));
process.exitCode = blocked.length ? 1 : 0;
