import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../simple.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const elements = new Map();
const element = (selector) => {
  if (!elements.has(selector)) elements.set(selector, {
    listeners: {}, dataset: {}, classList: { add() {}, remove() {} },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this[name] = value; }
  });
  return elements.get(selector);
};
let tick;
let reducedMotion = false;
let renders = 0;
const context = {
  $: element,
  state: { globalDestinationIndex: 0, globalDestinationPaused: false },
  document: { hidden: false, documentElement: { dataset: {} } },
  window: {
    matchMedia: () => ({ matches: reducedMotion }),
    setInterval(callback, delay) { assert.equal(delay, 8000); tick = callback; return 1; },
    clearInterval() { tick = null; }
  },
  getTargetFromRoute: () => "dashboardHome",
  renderGlobalDestinationHeader() { renders++; }
};
vm.createContext(context);
vm.runInContext(app.slice(app.indexOf("function startGlobalDestinationHeader("), app.indexOf("async function openDestinationExplore(")), context);
vm.runInContext("startGlobalDestinationHeader()", context);
assert.equal(renders, 1);
tick();
assert.equal(renders, 2);
context.document.documentElement.dataset.reduceMotion = "true";
tick();
assert.equal(renders, 2, "Account reduced motion prevents automatic rotation");
context.document.documentElement.dataset.reduceMotion = "false";
reducedMotion = true;
tick();
assert.equal(renders, 2, "System reduced motion prevents automatic rotation");
reducedMotion = false;
context.document.hidden = true;
tick();
assert.equal(renders, 2, "Hidden tabs do not rotate");
element("#globalDestinationPauseButton").listeners.click();
assert.equal(tick, null);
assert.equal(element("#globalDestinationPauseButton")["aria-pressed"], "true");
element("#globalDestinationPauseButton").listeners.click();
assert.equal(typeof tick, "function");
assert.ok(css.includes(':is([data-active-route="dashboardHome"], [data-active-route="exploreDrops"]) #globalDestinationHeader:not([hidden])'));
assert.ok(css.includes('html[data-high-contrast="true"] body.signed-in-shell :is(.sidebar, #globalDestinationHeader:not([hidden]))'));
assert.ok(!html.includes('id="globalDestinationHeader" aria-live="polite"'));
console.log("Destination banner passed: rotation, pause/resume, motion preferences, hidden tabs, route scope, and high contrast.");
