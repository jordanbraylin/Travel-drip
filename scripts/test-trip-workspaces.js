import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../trip-workspaces.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const split = (amount, people) => Array.from(vm.runInContext(`calculateWalletSplit(${JSON.stringify(amount)}, ${people})`, context));
assert.deepEqual(split("100.00", 3), [3334, 3333, 3333]);
assert.deepEqual(split("0.01", 3), [1, 0, 0]);
assert.deepEqual(split("12.3", 2), [615, 615]);
for (const value of ["", "-1", "0", "1.001", "1e4", "Infinity", "not money"]) assert.throws(() => split(value, 2));
for (const people of [0, 51, 1.5, NaN]) assert.throws(() => split("100", people));
for (let cents = 1; cents < 5000; cents += 71) {
  for (let people = 1; people <= 50; people++) {
    const shares = split((cents / 100).toFixed(2), people);
    assert.equal(shares.reduce((a,b) => a+b,0), cents);
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  }
}
assert.ok(source.includes('state.session?.user?.id !== userId'));
assert.ok(source.includes('!result.scheduleItem?.id'));
assert.ok(source.includes('trip.owner_user_id === state.session?.user?.id'));
assert.ok(source.includes('No money is moved or payment request sent.'));
const emptyClass = new Set(["is-account-empty"]);
context.document = { body: { classList: { contains: () => false } }, getElementById: () => ({ classList: { remove: (value) => emptyClass.delete(value) } }), querySelector: () => ({}) };
context.renderTripItinerary = () => {};
context.renderWalletWorkspaceStatus = () => {};
for (const route of ["itineraryAlerts", "walletPanel"]) {
  emptyClass.add("is-account-empty");
  vm.runInContext(`renderTripWorkspaces('${route}')`, context);
  assert.equal(emptyClass.has("is-account-empty"), false, `${route} must remain usable without a saved trip`);
}
const balance = {}, copy = {};
const walletContext = vm.createContext({ state: { accountData: { activeTrip: null }, walletAccess: { status: "ready", tripId: "other-trip", wallet: { availableCents: 1000 } } }, document: { querySelector: (selector) => selector === "#tripAvailableBalance" ? balance : selector === "#tripAvailableBalanceCopy" ? copy : null }, formatWalletMoney: () => "$10.00" });
vm.runInContext(source.slice(source.indexOf("function renderWalletWorkspaceStatus(")), walletContext);
vm.runInContext("renderWalletWorkspaceStatus()", walletContext);
assert.equal(balance.textContent, "Not connected");
walletContext.state.accountData.activeTrip = { id: "selected-trip" };
vm.runInContext("renderWalletWorkspaceStatus()", walletContext);
assert.equal(balance.textContent, "Not connected", "Never display a different trip's balance");
walletContext.state.walletAccess.tripId = "selected-trip";
vm.runInContext("renderWalletWorkspaceStatus()", walletContext);
assert.equal(balance.textContent, "$10.00");
console.log("Trip workspaces passed: exact-cent splitting, validation, saved-activity confirmation, and account guards.");
