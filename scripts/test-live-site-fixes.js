import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import handler from "../server/api/ai-planner.js";
import travelSearch from "../server/api/travel-search.js";
import { getResponseText, getOpenAiFailure } from "../server/api/_openai-response.js";

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
assert.equal(getOpenAiFailure({ error: { code: "credit_balance_exhausted" } }, 429).code, "provider_quota_exhausted");
assert.equal(getOpenAiFailure({ error: { type: "insufficient_quota" } }, 429).code, "provider_quota_exhausted");
assert.match(getOpenAiFailure({ error: { code: "rate_limit_exceeded" } }, 429).error, /try again/);

const previousFetch = globalThis.fetch;
const previousKey = process.env.OPENAI_API_KEY;
try {
  process.env.OPENAI_API_KEY = "test-only";
  let upstream = payload;
  let sentRequest;
  globalThis.fetch = async (_url, options) => {
    sentRequest = JSON.parse(options.body);
    return { ok: true, json: async () => upstream };
  };
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
  assert.equal(success.body.live, true);
  assert.equal(sentRequest.tool_choice, "required");
  assert.deepEqual(sentRequest.tools, [{ type: "web_search" }]);
  const search = response();
  await travelSearch({ method: "POST", headers: {}, body: { provider: "openai", query: "Museums", destination: "New York" } }, search);
  assert.equal(search.statusCode, 200);
  assert.equal(search.body.provider, "openai");
  assert.ok(sentRequest.input[1].content[0].text.includes("Museums in New York"));
  upstream = { output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Unverified answer" }] }] };
  const unsourced = response();
  await handler({ method: "POST", headers: {}, body: { query: "Research" } }, unsourced);
  assert.equal(unsourced.statusCode, 502);
  assert.equal(unsourced.body.code, "provider_unverified_response");
  upstream = { output: [] };
  const empty = response();
  await handler({ method: "POST", headers: {}, body: {} }, empty);
  assert.equal(empty.statusCode, 502);
  assert.equal(empty.body.code, "provider_invalid_response");
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { code: "credit_balance_exhausted" } }) });
  const exhausted = response();
  await travelSearch({ method: "POST", headers: {}, body: { provider: "openai", query: "Museums" } }, exhausted);
  assert.equal(exhausted.statusCode, 429);
  assert.equal(exhausted.body.code, "provider_quota_exhausted");
} finally {
  globalThis.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML ids must be unique");
assert.ok(!source.includes('aria-label="Mock secure QR code"'));
assert.ok(!source.includes('PDF export queued'));
assert.ok(source.includes('const transportRecords = []'));
assert.ok(source.includes('const travelSmartSearchRecords = []'));
assert.ok(source.includes('records[table] = data || []'));
assert.ok(source.includes('await loadAccountData();'));
assert.ok(!html.includes('Card ending 4829'));
assert.ok(!html.includes('84% complete'));
assert.ok(!html.includes('class="conversation-card active"'));
assert.ok(!html.includes("Caribbean Cruise"));
assert.ok(source.includes('renderLiveAiSearchResults(target, result)'));
assert.ok(source.includes('link.rel = "noopener noreferrer"'));
const moduleStart = source.indexOf("async function loadAccountModuleData(");
const moduleEnd = source.indexOf("function renderLiveAccountDashboard(", moduleStart);
const filters = [];
const moduleContext = {
  state: {
    session: { user: { id: "test-user" } },
    accountData: { activeTrip: { trip_type: "group_vacation" } },
    supabase: {
      from(table) {
        const query = {
          select() { return query; },
          limit() { return query; },
          eq(column, value) { filters.push({ table, column, value }); return query; },
          then(resolve) {
            return Promise.resolve(table === "hotels"
              ? { error: { message: "Access denied" } }
              : { data: table === "flights" ? [{ id: "saved-flight" }] : [], count: table === "flights" ? 1 : 0 }).then(resolve);
          }
        };
        return query;
      }
    }
  }
};
const modules = await vm.runInNewContext(`${source.slice(moduleStart, moduleEnd)}\nloadAccountModuleData("selected-trip")`, moduleContext);
assert.equal(modules.records.flights[0].id, "saved-flight");
assert.equal(modules.counts.flights, 1);
assert.equal(modules.records.hotels.length, 0);
assert.equal(modules.moduleErrors.hotels, "Access denied");
assert.equal(filters.length, 13);
assert.ok(filters.every(({ column, value }) => column === "status" ? value === "active" : value === "selected-trip"));
assert.ok(filters.some(({ table, column }) => table === "events" && column === "id"));
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
