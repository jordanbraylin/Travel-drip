import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import health from "../server/api/health.js";
import hotelAvailability from "../server/api/hotel-availability.js";

const response = () => ({
  setHeader() {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; }
});
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ADMIN_EMAILS", "GUEST_ACCESS_PEPPER", "VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "APP_BASE_URL"];
const providers = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY", "FLIGHTAWARE_API_KEY", "FLIGHT_TRACKING_API_KEY", "AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET", "OPENAI_API_KEY", "OPENAI_MODEL"];
try {
  for (const name of [...required, ...providers]) delete process.env[name];
  const blocked = response();
  health({}, blocked);
  assert.equal(blocked.body.ready, false);
  assert.equal(blocked.body.readinessStatus, "blocked");
  for (const name of required) process.env[name] = "test-only";
  const limited = response();
  health({}, limited);
  assert.equal(limited.body.coreReady, true);
  assert.equal(limited.body.ready, false);
  assert.equal(limited.body.readinessStatus, "limited");
  assert.deepEqual(limited.body.unavailableFeatures, ["walletFunding", "flightTracking", "hotelAvailability", "aiResearch"]);
  assert.equal(limited.body.primarySearchProvider, "wikipedia");
  assert.equal(limited.body.freeWebSearchConfigured, true);
  for (const name of providers) process.env[name] = "test-only";
  process.env.ALLOW_PAID_AI = 'true';
  const configured = response();
  health({}, configured);
  assert.equal(configured.body.configurationReady, true);
  assert.equal(configured.body.readinessStatus, "verification_required");
  assert.equal(configured.body.providerConnectivityVerified, false);
  assert.equal(configured.body.verificationScope, "configuration_only");
  delete process.env.AMADEUS_CLIENT_ID;
  delete process.env.AMADEUS_CLIENT_SECRET;
  const cases = [
    [{}, "invalid_city_code"],
    [{ cityCode: "NYC" }, "invalid_dates"],
    [{ cityCode: "NYC", checkInDate: "2099-02-30", checkOutDate: "2099-03-05" }, "invalid_dates"],
    [{ cityCode: "NYC", checkInDate: "2020-01-01", checkOutDate: "2020-01-02" }, "past_check_in"],
    [{ cityCode: "NYC", checkInDate: "2099-04-05", checkOutDate: "2099-04-04" }, "invalid_date_range"],
    [{ cityCode: "NYC", checkInDate: "2099-04-04", checkOutDate: "2099-04-05" }, "provider_not_configured"]
  ];
  for (const [body, expected] of cases) {
    const result = response();
    await hotelAvailability({ method: "POST", headers: {}, body }, result);
    assert.equal(result.body.code, expected);
    assert.equal(result.statusCode, expected === "provider_not_configured" ? 503 : 400);
  }
  process.env.AMADEUS_CLIENT_ID = "test-only";
  process.env.AMADEUS_CLIENT_SECRET = "test-only";
  let upstreamFailed = true;
  globalThis.fetch = async (url) => String(url).includes("/oauth2/token")
    ? { ok: true, json: async () => ({ access_token: "test-only" }) }
    : { ok: !upstreamFailed, status: upstreamFailed ? 503 : 200, json: async () => ({ data: [] }) };
  const searchBody = { cityCode: "NYC", hotelId: "TESTONLY", checkInDate: "2099-04-04", checkOutDate: "2099-04-05" };
  const failedProvider = response();
  await hotelAvailability({ method: "POST", headers: {}, body: searchBody }, failedProvider);
  assert.equal(failedProvider.statusCode, 502);
  assert.equal(failedProvider.body.code, "provider_error");
  upstreamFailed = false;
  const emptyProvider = response();
  await hotelAvailability({ method: "POST", headers: {}, body: searchBody }, emptyProvider);
  assert.equal(emptyProvider.statusCode, 200);
  assert.equal(emptyProvider.body.live, true);
  assert.equal(emptyProvider.body.results.length, 0);
} finally {
  globalThis.fetch = originalFetch;
  for (const name of Object.keys(process.env)) if (!(name in originalEnv)) delete process.env[name];
  Object.assign(process.env, originalEnv);
}

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const policy = config.headers.find(({ source }) => source === "/(.*)").headers.find(({ key }) => key === "Content-Security-Policy").value;
const directives = Object.fromEntries(policy.split(";").map((part) => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]));
assert.ok(directives["img-src"].includes("blob:"));
assert.ok(directives["img-src"].includes("https://*.supabase.co"));
assert.ok(directives["media-src"].includes("https://*.supabase.co"));
assert.ok(directives["media-src"].includes("blob:"));
assert.ok(!directives["script-src"].includes("'unsafe-inline'"));
assert.deepEqual(directives["object-src"], ["'none'"]);
console.log("Operational readiness tests passed: feature gates, real hotel inputs, and uploaded-media policy.");
