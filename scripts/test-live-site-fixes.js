import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import handler from "../server/api/ai-planner.js";
import { getResponseText } from "../server/api/_openai-response.js";

const citation = { type: "url_citation", title: "Travel source", url: "https://example.com/travel" };
const payload = {
  output: [
    { type: "web_search_call", status: "completed" },
    { type: "reasoning", summary: [] },
    { type: "message", role: "assistant", content: [
      { type: "output_text", text: "Current travel summary", annotations: [citation] },
      { type: "output_text", text: "Check availability before booking.", annotations: [] }
    ] }
  ]
};
assert.equal(getResponseText(payload), "Current travel summary\nCheck availability before booking.");
assert.equal(getResponseText({ output_text: "SDK summary" }), "SDK summary");
assert.equal(getResponseText({ output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "Declined" }] }] }), "");

const previousFetch = globalThis.fetch;
const previousKey = process.env.OPENAI_API_KEY;
try {
  process.env.OPENAI_API_KEY = "test-only";
  let upstream = payload;
  globalThis.fetch = async () => ({ ok: true, json: async () => upstream });
  const response = () => ({
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  });
  const success = response();
  await handler({ method: "POST", headers: {}, body: { query: "Travel research" } }, success);
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.text, getResponseText(payload));
  assert.deepEqual(success.body.citations, [{ title: citation.title, url: citation.url }]);
  upstream = { output: [] };
  const empty = response();
  await handler({ method: "POST", headers: {}, body: {} }, empty);
  assert.equal(empty.statusCode, 502);
  assert.equal(empty.body.code, "provider_invalid_response");
} finally {
  globalThis.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function syncCorporateEmployeeDashboardVisibility(");
const end = source.indexOf("function syncCorporateEmployeeRouteVisibility(", start);
assert.ok(start >= 0 && end > start);
for (const [signedIn, employeeMode, activeRoute, expected] of [
  [true, false, "dashboardHome", true],
  [false, false, "dashboardHome", true],
  [true, true, "dashboardHome", false],
  [true, false, "walletPanel", false]
]) {
  const visibility = new Map();
  const context = {
    state: { session: signedIn ? { user: { id: "test-user" } } : null },
    document: { body: { dataset: { activeRoute } } },
    $: (selector) => selector,
    $$: (selector) => [selector],
    setVisibilityWithoutCssLeaks: (selector, visible) => visibility.set(selector, visible)
  };
  vm.runInNewContext(`${source.slice(start, end)}\nsyncCorporateEmployeeDashboardVisibility(${employeeMode});`, context);
  assert.equal(visibility.get("#dashboardWidgets"), expected);
  if (signedIn) assert.equal(visibility.get(".metrics"), false);
}
console.log("Live site regression checks passed: AI summaries, citations, empty responses, and dashboard widget visibility.");
