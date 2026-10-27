import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const usability = await readFile(new URL("../usability.js", import.meta.url), "utf8");
assert.ok(!html.includes('id="accountEmptyDashboard"'));
assert.ok(html.includes('id="livePlanFunFact"') && html.includes('id="livePlanTip"'));
assert.ok(usability.includes('button.dataset.target = "exploreDrops"'));
assert.match(app, /section === "splitBills"\) \{\s*navigateSafely\("splitBill"/);

const sections = new Map();
for (const id of ["#dashboardHome", ".destination-insights", ".travel-social-strip", ".metrics", "#dashboardWidgets", ".pwa-panel", "#corporateHome"]) {
  sections.set(id, { hidden: false });
}
const context = {
  state: { session: { user: { id: "test-user" } } },
  document: { body: { dataset: { activeRoute: "dashboardHome" } } },
  $: (selector) => sections.get(selector),
  $$: (selector) => [sections.get(selector)],
  setVisibilityWithoutCssLeaks: (element, visible) => { element.hidden = !visible; }
};
vm.createContext(context);
vm.runInContext(app.slice(app.indexOf("function syncCorporateEmployeeDashboardVisibility("), app.indexOf("function syncCorporateEmployeeRouteVisibility(")), context);
vm.runInContext("syncCorporateEmployeeDashboardVisibility(false)", context);
assert.equal(sections.get("#dashboardHome").hidden, false, "Signed-in Home must show the slideshow");
assert.equal(sections.get(".metrics").hidden, true, "Do not restore sample account metrics");
assert.equal(sections.get("#dashboardWidgets").hidden, false);
vm.runInContext("syncCorporateEmployeeDashboardVisibility(true)", context);
assert.equal(sections.get("#dashboardHome").hidden, true, "Keep the corporate employee dashboard separate");
context.document.body.dataset.activeRoute = "exploreDrops";
vm.runInContext("syncCorporateEmployeeDashboardVisibility(false)", context);
assert.equal(sections.get("#dashboardHome").hidden, true, "Slideshow belongs on Home only");
assert.ok(app.includes('hero.contains(document.activeElement)'));
assert.ok(app.includes('document.documentElement.dataset.reduceMotion === "true"'));
console.log("Dashboard discovery passed: signed-in slideshow, no welcome panel, private widgets preserved, search and split navigation.");
