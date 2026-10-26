import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { changeTripVisibility } from "../server/api/trips.js";
import { getCurrentWeather } from "../server/api/weather.js";

const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
async function removal({ owner = "user-1", status = "draft", member = { role: "owner", status: "active" }, action = "remove", fail = false, missing = false } = {}) {
  const writes = [];
  const supabase = { from(table) {
    const query = {
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: table === "trips" ? missing ? null : { id: "trip-1", owner_user_id: owner, status, settings: { previousStatus: "active", keep: true } } : member }),
      update(value) { writes.push({ table, value }); return this; },
      insert() { return Promise.resolve({ error: null }); },
      single: async () => ({ data: { id: "trip-1" }, error: fail ? { message: "test failure" } : null })
    };
    return query;
  } };
  const result = response();
  await changeTripVisibility(result, supabase, { id: "user-1" }, { tripId: "trip-1", action });
  return { result, writes };
}
const archived = await removal();
assert.equal(archived.result.code, 200);
assert.equal(archived.writes[0].table, "trips");
assert.equal(archived.writes[0].value.status, "archived");
assert.equal(archived.writes[0].value.settings.keep, true);
assert.equal(archived.result.body.restorable, true);
const left = await removal({ owner: "other-user", member: { role: "traveler", status: "active" } });
assert.equal(left.writes[0].table, "trip_members");
assert.equal(left.writes[0].value.status, "left");
assert.equal(left.result.body.restorable, false);
assert.equal((await removal({ owner: "other-user", action: "restore", status: "archived" })).result.code, 403);
assert.equal((await removal({ member: null })).result.code, 403);
assert.equal((await removal({ missing: true })).result.code, 404);
assert.equal((await removal({ fail: true })).result.code, 500);
const restored = await removal({ action: "restore", status: "archived" });
assert.equal(restored.result.code, 200);
assert.equal(restored.writes[0].value.status, "active");

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const calls = [];
try {
  await assert.rejects(getCurrentWeather({}), (error) => error.status === 400);
  await assert.rejects(getCurrentWeather({ latitude: 91, longitude: 0 }), (error) => error.status === 400);
  await assert.rejects(getCurrentWeather({ latitude: null, longitude: null }), (error) => error.status === 400);
  const now = Date.now();
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const headers = { get: (key) => key === "expires" ? new Date(now + 60000).toUTCString() : new Date(now).toUTCString() };
    if (String(url).includes("photon")) return { ok: true, status: 200, json: async () => ({ features: [{ geometry: { coordinates: [-80.8431, 35.2271] }, properties: { name: "Charlotte", state: "North Carolina", country: "United States", osm_value: "city" } }] }), headers };
    if (options.headers["If-Modified-Since"]) return { status: 304, headers };
    return { ok: true, status: 200, headers, json: async () => ({ properties: { meta: { updated_at: new Date(now).toISOString() }, timeseries: [{ time: new Date(Math.floor(now / 3600000) * 3600000).toISOString(), data: { instant: { details: { air_temperature: 22, wind_speed: 3 } }, next_1_hours: { summary: { symbol_code: "clearsky_day" } } } }] } }) };
  };
  const weather = await getCurrentWeather({ destination: "Charlotte, North Carolina" });
  assert.equal(weather.temperatureC, 22);
  assert.equal(weather.provider, "MET Norway");
  assert.equal(weather.live, true);
  assert.equal(weather.kind, "current_forecast");
  assert.ok(weather.location.includes("Charlotte"));
  assert.ok(calls[1].url.includes("lat=35.23"));
  assert.ok(calls[1].options.headers["User-Agent"].includes("travel-drip.com"));
  await getCurrentWeather({ destination: "Charlotte, North Carolina" });
  assert.equal(calls.length, 2, "destination and weather are cached");
  Date.now = () => now + 120000;
  assert.equal((await getCurrentWeather({ destination: "Charlotte, North Carolina" })).temperatureC, 22);
  assert.equal(calls.length, 3, "expired forecast revalidates without geocoding again");
  assert.ok(calls[2].options.headers["If-Modified-Since"]);
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(getCurrentWeather({ latitude: 20, longitude: 20 }), /temporarily unavailable/);
} finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
const weatherSource = await readFile(new URL("../live-weather.js", import.meta.url), "utf8");
let click;
let geolocationCalls = 0;
let searches = 0;
const client = {
  document: { querySelector: (selector) => selector.includes("data-widget") ? {} : null, querySelectorAll: () => [], addEventListener: (type, handler) => { if (type === "click") click = handler; } },
  navigator: { geolocation: { getCurrentPosition(success, failure) { geolocationCalls++; failure(); } } },
  state: { session: { user: { id: "test-user" } }, accountData: { activeTrip: null } },
  localStorage: { getItem: () => null },
  setInterval() {},
  liveSearchApiRequest: async () => { searches++; return { live: true, temperatureC: 10 }; }
};
vm.createContext(client);
vm.runInContext(weatherSource + "\ninitializeLiveWeather();", client);
assert.equal(geolocationCalls, 0, "location is never requested automatically");
click({ target: { closest: () => ({ dataset: { weatherAction: "location" } }) } });
assert.equal(geolocationCalls, 1);
assert.equal(searches, 0, "a denied location does not generate invented coordinates");
assert.ok(vm.runInContext("weatherMessage.includes('Location was not available')", client));
console.log("Trip and weather tests passed: recoverable removal, member isolation, restore ownership, live provider data, precision limits, cache, and provider failure.");
