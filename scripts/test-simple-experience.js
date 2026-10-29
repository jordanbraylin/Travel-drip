import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../usability.js", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../simple.css", import.meta.url), "utf8");
const keys = [...html.matchAll(/data-settings-panel="([^"]+)"/g)].map((match) => match[1]).filter((key) => key !== "system");
assert.equal(new Set(keys).size, keys.length);
assert.ok(keys.includes("profile") && keys.includes("accessibility"));
const panels = keys.map((key) => ({ dataset: { settingsPanel: key }, classList: { toggle() {} } }));
const tabs = keys.map((key) => ({ dataset: { settingsSection: key }, classList: { toggle() {} }, setAttribute(name, value) { this[name] = value; }, focus() { this.focused = true; } }));
const picker = {};
const account = {
  querySelectorAll(selector) { return selector === "[data-settings-panel]" ? panels : tabs; },
  querySelector: () => picker
};
let path;
const context = {
  getRouteComponentById: () => account,
  document: { body: { dataset: { activeRoute: "adminPanel" } } },
  location: { protocol: "https:" }, history: { state: {}, replaceState(state, title, url) { this.state = state; path = url; } },
  setVisibilityWithoutCssLeaks: (element, visible) => { element.hidden = !visible; element.inert = !visible; }
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("function selectAccountSettings("), source.indexOf("function applyReadingPreferences(")), context);
for (const key of keys) {
  assert.equal(vm.runInContext(`selectAccountSettings('${key}', {focus:true})`, context), key);
  assert.equal(panels.filter((panel) => !panel.hidden).length, 1);
  assert.equal(tabs.filter((tab) => tab.tabIndex === 0).length, 1);
  assert.equal(tabs.find((tab) => tab.dataset.settingsSection === key)["aria-selected"], "true");
  assert.equal(picker.value, key);
  assert.equal(path, `/account/${key}`);
  assert.ok(panels.filter((panel) => panel.hidden).every((panel) => panel.inert));
}
assert.equal(vm.runInContext("selectAccountSettings('socialMediaHub')", context), "integrations");
assert.equal(vm.runInContext("selectAccountSettings('bad-tab')", context), "account");
const inputs = {
  readingTextSize: { type: "select-one" }, readingHighContrast: { type: "checkbox" }, readingReduceMotion: { type: "checkbox" }
};
const storage = new Map();
const readingContext = {
  document: { documentElement: { dataset: {} }, getElementById: (id) => inputs[id] },
  localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) }
};
vm.createContext(readingContext);
vm.runInContext(source.slice(source.indexOf("function applyReadingPreferences("), source.indexOf("function initializeSimpleExperience(")) + "\napplyReadingPreferences();", readingContext);
inputs.readingTextSize.value = "extra-large";
inputs.readingTextSize.onchange();
assert.equal(readingContext.document.documentElement.dataset.textSize, "extra-large");
inputs.readingHighContrast.checked = true;
inputs.readingHighContrast.onchange();
assert.equal(readingContext.document.documentElement.dataset.highContrast, "true");
assert.equal(JSON.parse(storage.get("traveldripReadingPreferences")).textSize, "extra-large");
assert.ok(app.includes('initializeSimpleExperience();'));
assert.ok(app.includes('target === "myProfile"'));
assert.ok(app.includes('return "adminPanel"'));
assert.ok(css.includes(".simple-disclosure:not([open]) > :not(summary)"));
assert.ok(css.includes("--reading-size: 18px"));
assert.ok(source.includes('move(".itinerary-preferences-widget", "notifications"'));
assert.ok(source.includes('move(".ride-account-panel", "integrations"'));
assert.ok(source.includes('diagnostics.removeAttribute("data-settings-panel")'));
assert.ok(!html.includes('data-settings-section="system"'));
assert.equal((html.match(/id="destinationInfoButton"/g)||[]).length,1);
assert.ok(app.includes('$("#destinationInfoButton")?.addEventListener("click"'));
assert.match(css,/#dashboardHome\.destination-banner:not\(\[hidden\]\).*min-height:240px/);
assert.match(css,/#dashboardHome\.destination-banner \.hero-copy h1.*font-size:32px/);
assert.match(css,/#destinationInfoButton.*min-height:44px/);
console.log("Simplified experience passed: one active account tab, keyboard state, legacy aliases, readable preferences, and settings ownership.");
