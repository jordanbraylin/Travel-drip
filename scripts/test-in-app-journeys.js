import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import handler from "../server/api/travel-search.js";

const original = globalThis.fetch;
let fetched;
globalThis.fetch = async (url) => {
  fetched = new URL(url);
  return { ok: true, json: async () => ({ query: { pages: { 1: { pageid: 1, index: 2, title: "Paris", extract: "Paris destination guide." }, 2: { pageid: 2, index: 1, title: "Gare du Nord", extract: "Railway station in Paris." } } } }) };
};
const response = () => ({ setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } });
try {
  const result = response();
  await handler({ method: "POST", headers: {}, body: { provider: "in_app", category: "trains", destination: "Paris" } }, result);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.provider, "in_app");
  assert.equal(result.body.liveAvailability, false);
  assert.equal(result.body.results[0].title, "Gare du Nord");
  assert.equal(fetched.origin, "https://en.wikipedia.org");
  assert.ok(fetched.searchParams.get("gsrsearch").includes("railway station"));
  const blank = response();
  await handler({ method: "POST", headers: {}, body: { provider: "in_app" } }, blank);
  assert.equal(blank.statusCode, 400);
  globalThis.fetch = async () => ({ ok: false });
  const failure = response();
  await handler({ method: "POST", headers: {}, body: { provider: "in_app", destination: "Unknown test town" } }, failure);
  assert.equal(failure.statusCode, 502);
} finally { globalThis.fetch = original; }
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const search = app.slice(app.indexOf("async function searchLiveTravelPlaces("), app.indexOf("function formatFlightDateTime("));
assert.ok(!search.includes("window.open"));
assert.ok(search.includes('provider: "live"'));
const module = await readFile(new URL("../journey-dashboard.js", import.meta.url), "utf8");
assert.ok(!module.includes("window.open") && !module.includes('target = "_blank"'));
const context = vm.createContext({ state: { session: { user: { id: "owner" } }, accountData: { activeTrip: { id: "trip" }, records: { flights: [{ id: "flight" }], transportation_records: [{ id: "train", transportation_type: "train" }, { id: "ride", transportation_type: "ride_share" }] } } } });
vm.runInContext(module, context);
assert.equal(vm.runInContext("getJourneyRecords('flights').length", context), 1);
assert.equal(vm.runInContext("getJourneyRecords('trains')[0].id", context), "train");
assert.equal(vm.runInContext("getJourneyRecords('rideshare')[0].id", context), "ride");
context.state.session = null;
assert.equal(vm.runInContext("getJourneyRecords('flights').length", context), 0);
const first = vm.runInContext("beginInAppSearch('explore')", context);
vm.runInContext("beginInAppSearch('explore')", context);
assert.equal(vm.runInContext(`isCurrentInAppSearch('explore',${first})`, context), false);
console.log("In-app journeys passed: real guides, blank/error states, no new tabs, record isolation, and stale-search guards.");

const oldPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
const oldMapsKey = process.env.GOOGLE_MAPS_API_KEY;
try {
  delete process.env.GOOGLE_PLACES_API_KEY; delete process.env.GOOGLE_MAPS_API_KEY;
  const missing = response();
  await handler({ method: "POST", headers: {}, body: { provider: "live", destination: "Paris" } }, missing);
  assert.equal(missing.statusCode, 503);
  assert.equal(missing.body.code, "provider_not_configured");
  const transport = response();
  await handler({ method: "POST", headers: {}, body: { provider: "live", category: "flights", destination: "Paris" } }, transport);
  assert.equal(transport.body.code, "live_transport_not_connected");
  process.env.GOOGLE_PLACES_API_KEY = "test-only";
  let requestHeaders;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://places.googleapis.com/v1/places:searchText");
    requestHeaders = options.headers;
    return { ok: true, json: async () => ({ places: [{ id: "p1", displayName: { text: "Test cafe" }, currentOpeningHours: { openNow: true } }] }) };
  };
  const live = response();
  await handler({ method: "POST", headers: {}, body: { provider: "live", category: "food", destination: "Paris" } }, live);
  assert.equal(live.statusCode, 200);
  assert.equal(live.body.results[0].status, "Open now");
  assert.equal(live.body.searchMode, "live_places");
  assert.equal(live.body.liveAvailability, false);
  assert.ok(live.body.fetchedAt);
  assert.equal(requestHeaders["X-Goog-Api-Key"], "test-only");
  assert.ok(!JSON.stringify(live.body).includes("test-only"));
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  const denied = response();
  await handler({ method: "POST", headers: {}, body: { provider: "live", destination: "Paris" } }, denied);
  assert.equal(denied.statusCode, 502);
  assert.equal(denied.body.code, "provider_error");
} finally {
  globalThis.fetch = original;
  if (oldPlacesKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = oldPlacesKey;
  if (oldMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = oldMapsKey;
}
console.log("Live search passed: missing connection, unavailable fares, current opening hours, source timestamp, private API key, and provider failures.");
