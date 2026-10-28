import assert from "node:assert/strict";
import handler from "../server/api/travel-search.js";

const originalFetch = globalThis.fetch;
let outboundRequests = 0;
globalThis.fetch = async () => {
  outboundRequests += 1;
  throw new Error("Free search must not call a paid API.");
};
const response = () => ({
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; },
  end() { this.ended = true; }
});
try {
  const result = response();
  await handler({ method: "POST", headers: {}, body: { query: "museums & gardens", destination: "New York" } }, result);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.provider, "duckduckgo");
  assert.equal(result.body.free, true);
  assert.equal(result.body.live, false);
  assert.equal(result.body.searchMode, "external_results");
  assert.deepEqual(result.body.results, []);
  const search = new URL(result.body.searchUrl);
  assert.equal(search.origin, "https://duckduckgo.com");
  assert.equal(search.searchParams.get("q"), "museums & gardens in New York");
  assert.deepEqual([...search.searchParams.keys()], ["q"]);

  const redirect = response();
  await handler({ method: "GET", headers: {}, query: { q: "museums & gardens", destination: "New York" } }, redirect);
  assert.equal(redirect.statusCode, 302);
  assert.equal(redirect.headers.Location, result.body.searchUrl);
  assert.equal(redirect.ended, true);

  const injection = response();
  await handler({ method: "GET", headers: {}, query: { q: "https://untrusted.invalid/?q=test&k1=-1" } }, injection);
  const injectionUrl = new URL(injection.headers.Location);
  assert.equal(injectionUrl.origin, "https://duckduckgo.com");
  assert.deepEqual([...injectionUrl.searchParams.keys()], ["q"]);

  const category = response();
  await handler({ method: "POST", headers: {}, body: { category: "food", destination: "Paris" } }, category);
  assert.equal(new URL(category.body.searchUrl).searchParams.get("q"), "restaurants and dining in Paris");

  const unsupported = response();
  const rideshare = response();
  await handler({ method: "POST", headers: {}, body: { category: "rideshare", destination: "Charlotte" } }, rideshare);
  assert.equal(new URL(rideshare.body.searchUrl).searchParams.get("q"), "rideshare services, taxis, and airport rides in Charlotte");

  await handler({ method: "POST", headers: {}, body: { provider: "unknown" } }, unsupported);
  assert.equal(unsupported.statusCode, 400);
  assert.equal(unsupported.body.code, "invalid_provider");
  assert.equal(outboundRequests, 0);
  console.log("Free search passed: no paid requests, encoded queries, safe redirects, and truthful external-results labels.");
} finally {
  globalThis.fetch = originalFetch;
}
