import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../navigation.css", import.meta.url), "utf8");
const start = source.indexOf("function syncSidebarAccessibility(");
const end = source.indexOf("function applyMainNavigationConfig(", start);
assert.ok(start >= 0 && end > start);
for (const narrow of [true, false]) {
  const classes = new Set();
  const sidebar = { hidden: false, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
  const menu = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, focus() { this.focused = true; } };
  const summary = { focus() { this.focused = true; } };
  const context = {
    window: { matchMedia: () => ({ matches: narrow }) },
    document: { body: { classList: { contains: (name) => classes.has(name), toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } } } },
    $: (selector) => ({ ".sidebar": sidebar, "#sidebarMenuButton": menu, ".sidebar summary": summary })[selector]
  };
  vm.runInNewContext(`${source.slice(start, end)}\nsyncSidebarAccessibility();`, context);
  assert.equal(sidebar.inert, narrow);
  vm.runInNewContext("setSidebarOpen(true);", context);
  assert.equal(sidebar.inert, false);
  assert.equal(menu.attributes["aria-expanded"], "true");
  assert.equal(summary.focused, true);
  vm.runInNewContext("setSidebarOpen(false, true);", context);
  assert.equal(sidebar.inert, narrow);
  assert.equal(menu.focused, true);
  sidebar.hidden = true;
  vm.runInNewContext("syncSidebarAccessibility();", context);
  assert.equal(sidebar.inert, true);
}
assert.ok(css.includes("html body.signed-in-shell .shell > .sidebar"));
assert.ok(css.includes("position: fixed !important"));
assert.ok(source.includes('setVisibilityWithoutCssLeaks(panel, active)'));
assert.ok(source.includes('$("#exploreEmptyState").hidden = true'));
assert.ok(html.includes('class="explore-filter-row" hidden inert'));
assert.ok(html.includes('class="trip-optional-details wide"'));
assert.ok(html.includes('id="tripTypeSelect"'));
for (const id of ["tripNameInput", "tripDestinationInput", "tripStartInput", "tripEndInput"]) {
  const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0];
  assert.ok(tag?.includes("required"), `${id} must be validated`);
}
const globalHandler = source.slice(source.indexOf('$("#globalSearchInput")?.addEventListener("keydown"'), source.indexOf('$("#aiPlannerStartButton")?.addEventListener'));
assert.ok(globalHandler.indexOf('renderRoute("exploreDrops"') < globalHandler.indexOf('$("#exploreSearchInput").value = query'));
await import("./build-vercel.js");
const deployedHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
assert.ok(deployedHtml.includes('<base href="/">'));
for (const asset of ["app.js?v=85", "navigation.css?v=91", "icons/icon.svg"]) {
  assert.equal(new URL(asset, new URL("/", "https://travel-drip.com/explore/food")).pathname, `/${asset.split("?")[0]}`);
}
console.log("User experience tests passed: responsive drawer, focus restoration, empty states, search preservation, and required trip fields.");
