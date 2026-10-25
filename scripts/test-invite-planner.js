import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const api = await readFile(new URL("../server/api/invitations.js", import.meta.url), "utf8");
const elements = new Map();
const element = (id) => {
  if (!elements.has(id)) elements.set(id, { value: "", textContent: "", innerHTML: "", setAttribute() {}, focus() { this.focused = true; } });
  return elements.get(id);
};
const storage = new Map();
const state = { aiPlanner: { step: 0, answers: {} } };
const context = {
  state, $: element,
  sessionStorage: { setItem: (key, value) => storage.set(key, value) },
  escapeHtml: (value) => String(value).replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  setVisibilityWithoutCssLeaks: (el, visible) => { el.hidden = !visible; }
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("const aiPlannerSteps ="), source.indexOf("const $ =")), context);
vm.runInContext(source.slice(source.indexOf("function saveAiPlannerState("), source.indexOf("async function handleExploreAction(")), context);
await vm.runInContext('answerAiPlanner("Solo Travel")', context);
await vm.runInContext('answerAiPlanner("", true)', context);
await vm.runInContext('answerAiPlanner("Under $900")', context);
assert.equal(state.aiPlanner.step, 3);
assert.equal(state.aiPlanner.answers.destination, null);
vm.runInContext("editAiPlannerAnswer(0)", context);
await vm.runInContext('answerAiPlanner("Family Vacation")', context);
assert.equal(state.aiPlanner.step, 3);
assert.equal(state.aiPlanner.answers.tripType, "Family Vacation");
assert.equal(state.aiPlanner.answers.budget, "Under $900");
vm.runInContext("editAiPlannerAnswer(1)", context);
await vm.runInContext('answerAiPlanner("<script>Tokyo</script>")', context);
assert.ok(element("#aiPlannerTranscript").innerHTML.includes("&lt;script>Tokyo"));
assert.ok(!element("#aiPlannerTranscript").innerHTML.includes("<script>"));
for (let i = 3; i < 10; i++) await vm.runInContext('answerAiPlanner("", true)', context);
assert.equal(state.aiPlanner.step, 10);
assert.equal(element("#aiPlannerSendButton").disabled, true);
assert.ok(element("#aiPlannerQuestion").textContent.includes("preferences are collected"));
await vm.runInContext('answerAiPlanner("must not overwrite")', context);
assert.equal(state.aiPlanner.answers.accessibility, null);
assert.ok(storage.get("traveldripAiPlannerAnswers").includes('"destination":"<script>Tokyo</script>"'));
for (const id of ["inviteRecipientEmail", "inviteRecipientUsername", "inviteRecipientMobile", "tripInviteDialog", "aiPlannerTranscript"]) {
  assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `${id} must be unique`);
}
assert.ok(source.includes('addEventListener("click", openTripInviteDialog)'));
assert.ok(!source.includes('$("#inviteRecipientList").innerHTML'));
const savedActions = [];
const savedContext = {
  state: { accountData: { trips: [] } },
  document: { createElement: () => ({ append() {}, addEventListener(type, handler) { this.handler = handler; } }) },
  openTripInviteDialog() {},
  container: { append() {}, querySelector: () => ({ append: (button) => savedActions.push(button) }) }
};
vm.runInNewContext(source.slice(source.indexOf("function renderSavedTripList("), source.indexOf("function getSavedModuleRecords(")) + "\nrenderSavedTripList(container);", savedContext);
assert.equal(savedActions[0].textContent, "Invite people");
assert.equal(savedActions[0].handler, savedContext.openTripInviteDialog);

let rows, profile, allowed, operations;
const supabase = { from(table) {
  const query = {
    insert(row) { rows = row; return this; },
    select() { return this; },
    eq(key, value) { operations.push([table, "eq", key, value]); return this; },
    ilike(key, value) { operations.push([table, "ilike", key, value]); return this; },
    gt() { return this; }, order() { return this; }, limit() { return this; },
    maybeSingle: async () => ({ data: profile, error: null }),
    single: async () => ({ data: { id: "invitation-1", ...rows }, error: null }),
    then(resolve) { resolve({ data: [], error: null }); }
  };
  return query;
} };
const apiContext = {
  URL, Date, process: { env: { APP_BASE_URL: "https://travel-drip.com" } },
  crypto: { randomBytes: () => ({ toString: () => "test-token-only" }) },
  applySecurityHeaders() {}, getRequestBody: (request) => request.body || {},
  requireAuthenticatedUser: async () => ({ user: { id: "signed-in-user" }, supabase }),
  requireTripRole: async () => allowed,
  sanitizeText: (value, fallback = "", max = 240) => String(value || fallback).slice(0, max),
  writeAuditLog: async () => {}, methodNotAllowed() {}
};
vm.createContext(apiContext);
vm.runInContext(api.replace(/^import[\s\S]*?from "\.\/_security.js";\s*/, "").replace("export default async function", "async function"), apiContext);
const request = async (body, method = "POST", url = "/api/invitations") => {
  rows = null; operations = []; allowed = true; profile = { id: "recipient-1", username: "friend_one" };
  const response = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
  await apiContext.handler({ method, url, headers: {}, body: { tripId: "trip-1", ...body } }, response);
  return response;
};
assert.equal((await request({})).code, 400);
assert.equal((await request({ inviteeEmail: "not-email" })).code, 400);
assert.equal((await request({ inviteeUsername: "%" })).code, 400);
assert.equal((await request({ inviteeMobile: "555" })).code, 400);
assert.equal((await request({ inviteeEmail: "a@example.com", inviteeUsername: "friend_one" })).code, 400);
assert.equal((await request({ inviteeEmail: "a@example.com", expiresAt: "2020-01-01" })).code, 400);
const email = await request({ inviteeEmail: "friend@example.com" });
assert.equal(email.code, 201);
assert.equal(email.body.delivery.email, "provider_required");
assert.equal(rows.invitee_email, "friend@example.com");
const mobile = await request({ inviteeMobile: "+1 (555) 123-4567" });
assert.equal(mobile.code, 201);
assert.equal(rows.customization.recipientMobile, "+15551234567");
assert.equal(rows.invitee_email, null);
assert.equal(mobile.body.delivery.sms, "manual_compose");
assert.equal((await request({ inviteeUsername: "friend_one" })).code, 201);
assert.equal(rows.invitee_user_id, "recipient-1");
assert.ok(operations.some((item) => item[1] === "ilike" && item[3] === "friend\\_one"));
await request({}, "GET", "/api/invitations?scope=incoming");
assert.ok(operations.some((item) => item[2] === "invitee_user_id" && item[3] === "signed-in-user"));
allowed = false;
const denied = { status(code) { this.code = code; return this; }, json() {} };
await apiContext.handler({ method: "POST", url: "/api/invitations", headers: {}, body: { tripId: "trip-1", inviteeUsername: "friend_one" } }, denied);
assert.equal(denied.code, 403);
allowed = true;
profile = null;
const missing = { status(code) { this.code = code; return this; }, json() {} };
await apiContext.handler({ method: "POST", url: "/api/invitations", headers: {}, body: { tripId: "trip-1", inviteeUsername: "unknown_user" } }, missing);
assert.equal(missing.code, 404);
for (const [record, expected] of [
  [{ id: "invite-1", invitee_user_id: "someone-else" }, 403],
  [{ id: "invite-1", status: "cancelled" }, 410],
  [{ id: "invite-1", expires_at: "2020-01-01" }, 410]
]) {
  profile = record;
  const result = { status(code) { this.code = code; return this; }, json() {} };
  await apiContext.handler({ method: "PATCH", url: "/api/invitations", headers: {}, body: { tripId: "trip-1", invitationId: "invite-1", token: "required-token", status: "accepted" } }, result);
  assert.equal(result.code, expected);
  assert.ok(operations.some((item) => item[2] === "token" && item[3] === "required-token"));
}
console.log("Invite and planner tests passed: recipient validation, scoped inbox, phone/email compose, skip, edit, escaping, and completion.");
