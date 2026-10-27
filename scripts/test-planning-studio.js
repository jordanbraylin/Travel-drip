import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../planning-studio.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const storage = new Map();
const elements = new Map();
const node = (id) => {
  if (!elements.has(id)) elements.set(id, { value: "", textContent: "", close() {}, reset() {}, checkValidity() { return true; }, reportValidity() { this.reported = true; } });
  return elements.get(id);
};
const context = {
  state: { session: { user: { id: "account-one" } } },
  document: { querySelector: (selector) => node(selector.slice(1)), getElementById: node },
  localStorage: { getItem: (key) => storage.get(key) ?? null, removeItem: (key) => storage.delete(key) }
};
vm.createContext(context);
vm.runInContext(source, context);
storage.set("traveldripQuickPlan:account-one", JSON.stringify({ version: 1, step: 1, fields: { destination: "Lisbon" } }));
assert.equal(context.readQuickPlanningDraft().fields.destination, "Lisbon");
context.state.session.user.id = "account-two";
assert.equal(context.readQuickPlanningDraft(), null, "Drafts are isolated to the signed-in account");
context.state.session = null;
assert.equal(context.readQuickPlanningDraft(), null, "Guests never inherit another account's draft");
context.state.session = { user: { id: "account-one" } };
storage.set("traveldripQuickPlan:account-one", "{invalid");
assert.equal(context.readQuickPlanningDraft(), null);
storage.set("traveldripQuickPlan:account-one", JSON.stringify({ version: 9, fields: {} }));
assert.equal(context.readQuickPlanningDraft(), null);

node("letsPlanDestinationInput").value = "Lisbon";
node("letsPlanTypeInput").value = "group";
assert.equal(context.validateQuickPlanningStep(), true);
node("letsPlanTypeInput").value = "unsupported";
assert.equal(context.validateQuickPlanningStep(), false);
node("letsPlanTypeInput").value = "group";
vm.runInContext("quickPlanStep = 1", context);
node("letsPlanStartDateInput").value = "2026-12-14";
node("letsPlanEndDateInput").value = "2026-12-10";
assert.equal(context.validateQuickPlanningStep(), false);
node("letsPlanEndDateInput").value = "2026-12-18";
assert.equal(context.validateQuickPlanningStep(), true);
node("letsPlanTravelersInput").checkValidity = () => false;
assert.equal(context.validateQuickPlanningStep(), false);
assert.equal(node("letsPlanTravelersInput").reported, true);
node("letsPlanTravelersInput").checkValidity = () => true;
node("letsPlanTravelersInput").value = "4";
node("letsPlanBudgetInput").value = "2200";
context.updateQuickPlanningSummary();
assert.ok(node("quickPlanSummary").textContent.includes("Lisbon"));
assert.ok(node("quickPlanSummary").textContent.includes("4 travelers"));
assert.ok(node("quickPlanSummary").textContent.includes("$2,200"));
context.document.querySelectorAll = () => [{ value: "Food" }, { value: "Culture" }];
node("letsPlanInterestsInput").value = "Museum visit";
assert.equal(context.getQuickPlanningInterests(), "Food, Culture, Museum visit");
context.document.querySelectorAll = () => [{ value: "Food" }];
assert.equal(context.getQuickPlanningInterests(), "Food, Museum visit", "Unchecking a preference removes it from the handoff");
assert.equal(node("letsPlanInterestsInput").value, "Museum visit", "Choice merging never mutates the user's notes");
storage.set("traveldripQuickPlan:account-one", JSON.stringify({ version: 1, fields: { destination: "Lisbon" } }));
context.clearQuickPlanningDraft();
assert.ok(storage.has("traveldripQuickPlan:account-one"), "Creating an unrelated trip cannot erase the planning draft");
vm.runInContext('quickPlanTransferred = true; quickPlanOwner = "account-two"', context);
context.clearQuickPlanningDraft();
assert.ok(storage.has("traveldripQuickPlan:account-one"), "Another account cannot clear a draft");
vm.runInContext('quickPlanOwner = "account-one"', context);
context.clearQuickPlanningDraft();
assert.equal(storage.has("traveldripQuickPlan:account-one"), false);
assert.ok(app.includes("clearQuickPlanningDraft();"));
assert.ok(app.includes('renderQuickPlanningStep({ focus: true });'));
assert.ok(source.includes('event.stopImmediatePropagation()'));
assert.ok(source.includes('Draft saved on this browser. Save the trip to sync it to your account.'));
assert.ok(html.includes('id="letsPlanButton" aria-haspopup="dialog" aria-controls="letsPlanDialog">Let\'s plan'));
assert.equal([...html.matchAll(/data-quick-plan-step="\d"/g)].length, 3);
assert.ok(html.includes('src="icons/planning-coast.jpg"'));
console.log("Planning studio passed: account-isolated drafts, malformed storage, trip choices, dates, traveler validity, live summary, and existing save-flow handoff.");
