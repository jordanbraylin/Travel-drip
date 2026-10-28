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
assert.ok(search.includes('provider: "in_app"'));
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
