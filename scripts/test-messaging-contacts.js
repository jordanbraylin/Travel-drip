import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { saveContact } from "../server/api/contacts.js";
import { sanitizeText } from "../server/api/_security.js";

const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
const stored = [
  { id: "mine", user_id: "user-a", name: "QA contact", phone: "+12025550123", email: null },
  { id: "theirs", user_id: "user-b", name: "Other account", phone: "+12025550124", email: null }
];
let writes = 0;
const supabase = { from(table) {
  assert.equal(table, "trusted_contacts");
  const filters = [];
  let values;
  let adding = false;
  return {
    select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
    order() { return this; },
    range: async () => ({ data: stored.filter((row) => filters.every(([key, value]) => row[key] === value)), error: null }),
    insert(value) { values = value; adding = true; return this; },
    update(value) { values = value; return this; },
    async maybeSingle() {
      if (adding) { writes++; return { data: { id: "new", ...values }, error: null }; }
      const row = stored.find((entry) => filters.every(([key, value]) => entry[key] === value));
      if (row) { writes++; Object.assign(row, values); }
      return { data: row || null, error: null };
    }
  };
} };
const valid = { name: "QA Friend", phone: "+1 (202) 555-0123", email: "QA@EXAMPLE.COM" };
let result = response();
await saveContact(result, supabase, { id: "user-a" }, valid);
assert.equal(result.code, 201);
assert.equal(result.body.contact.phone, "+12025550123");
assert.equal(result.body.contact.email, "qa@example.com");
assert.equal(result.body.contact.user_id, "user-a");
assert.equal(result.body.contact.metadata.contactKind, "address_book", "Address-book entries are not automatically emergency contacts");
result = response();
await saveContact(result, supabase, { id: "user-a" }, { ...valid, id: "theirs", user_id: "user-b" }, true);
assert.equal(result.code, 404);
assert.equal(stored[1].name, "Other account");
result = response();
await saveContact(result, supabase, { id: "user-a" }, { ...valid, id: "mine", user_id: "user-b" }, true);
assert.equal(result.code, 200);
assert.equal(stored[0].user_id, "user-a");
const previousWrites = writes;
for (const patch of [{ name: "" }, { phone: "javascript:alert(1)" }, { email: "a@example.com\r\nbcc:other@example.com" }]) {
  result = response();
  await saveContact(result, supabase, { id: "user-a" }, { ...valid, ...patch });
  assert.equal(result.code, 400);
}
assert.equal(writes, previousWrites);
const source = await readFile(new URL("../server/api/contacts.js", import.meta.url), "utf8");
let authorized = true;
const context = { URL, sanitizeText, applySecurityHeaders() {}, methodNotAllowed(res) { res.status(405).json({}); }, requireAuthenticatedUser: async (req, res) => {
  if (!authorized) { res.status(401).json({}); return {}; }
  return { user: { id: "user-a" }, supabase };
} };
vm.createContext(context);
vm.runInContext(source.replace(/^import[^\n]*\n/, "").replaceAll("export async function", "async function").replace("export default async function", "async function"), context);
result = response();
await context.handler({ method: "GET", url: "/api/contacts" }, result);
assert.equal(result.code, 200);
assert.equal(result.body.contacts.length, 1);
assert.equal(result.body.contacts[0].id, "mine");
authorized = false;
result = response();
await context.handler({ method: "GET", url: "/api/contacts" }, result);
assert.equal(result.code, 401);

const clientSource = await readFile(new URL("../messaging-contacts.js", import.meta.url), "utf8");
const client = {};
vm.createContext(client);
vm.runInContext(clientSource, client);
const links = client.contactMessageLinks(valid, "Meet at 7? & bring snacks");
assert.ok(links.sms.startsWith("sms:+12025550123?body="));
assert.equal(decodeURIComponent(links.email.split("?body=")[1]), "Meet at 7? & bring snacks");
assert.equal(client.contactMessageLinks({ phone: "javascript:alert(1)", email: "bad\r\n@host.test" }).sms, "");
assert.equal(client.contactMessageLinks({ email: "bad\r\n@host.test" }).email, "");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
assert.ok(html.includes('aria-label="Friends and contacts"'));
assert.ok(!html.includes('data-message-tab="private"'));
assert.ok(app.includes('privateAccountTargets.has(target) && target !== "socialHub"'));
assert.ok(app.includes('userId !== state.session?.user?.id || tripId !== state.activeTripId'));
assert.ok(clientSource.includes('Replies stay in that app, not in your trip chat.'));
const nodes = new Map();
const node = (selector) => {
  if (!nodes.has(selector)) nodes.set(selector, { value: "", replaceChildren() {}, hidden: true, disabled: false });
  return nodes.get(selector);
};
let resolveRequest;
client.document = { querySelector: node, querySelectorAll: () => [] };
client.state = { session: { user: { id: "user-a" }, access_token: "local-test" } };
client.isFilePreview = false;
client.apiRequest = () => new Promise((resolve) => { resolveRequest = resolve; });
const loading = client.loadMessagingContacts();
vm.runInContext('messagingContacts.generation++; messagingContacts.userId = "user-b";', client);
client.state.session.user.id = "user-b";
resolveRequest({ contacts: [{ id: "old-user-contact", name: "Must not appear" }] });
await loading;
assert.equal(vm.runInContext("messagingContacts.rows.length", client), 0, "An old account response cannot populate a new account");
console.log("Messaging contacts passed: authenticated reads, owner-only writes, validation, emergency-contact separation, safe compose links, empty-account access, and stale chat protection.");
