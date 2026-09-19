import assert from "node:assert/strict";
import { canTransitionCorporateBooking, evaluateCorporatePolicy } from "../server/api/_corporate-policy.js";

const policy = {
  flight_cap_cents: 150000,
  hotel_nightly_cap_cents: 32500,
  ground_transport_cap_cents: 18000,
  meal_daily_cap_cents: 12500,
  flight_cabin: "economy",
  allowed_airlines: ["Delta"],
  allowed_hotel_categories: ["business"],
  allowed_transport_providers: ["Careem"],
  rules: { blockUnapprovedProviders: true }
};

assert.deepEqual(
  evaluateCorporatePolicy(policy, { bookingType: "flight", providerName: "Delta", totalCents: 120000, details: { cabin: "economy" } }),
  { status: "compliant", reasons: [] }
);

const expensiveFlight = evaluateCorporatePolicy(policy, { bookingType: "flight", providerName: "Delta", totalCents: 190000, details: { cabin: "economy" } });
assert.equal(expensiveFlight.status, "exception");
assert.ok(expensiveFlight.reasons.includes("Flight exceeds the approved fare cap"));

const blockedAirline = evaluateCorporatePolicy(policy, { bookingType: "flight", providerName: "Unknown Air", totalCents: 90000, details: { cabin: "economy" } });
assert.equal(blockedAirline.status, "blocked");

const hotelException = evaluateCorporatePolicy(policy, { bookingType: "hotel", providerName: "Marina Grand", totalCents: 38000, details: { nightlyRateCents: 38000, category: "business" } });
assert.equal(hotelException.status, "exception");

const transportException = evaluateCorporatePolicy(policy, { bookingType: "transportation", providerName: "Careem", totalCents: 22000, details: {} });
assert.equal(transportException.status, "exception");

assert.equal(evaluateCorporatePolicy(null, { bookingType: "flight" }).status, "review");

assert.equal(canTransitionCorporateBooking("requested", "confirm"), true);
assert.equal(canTransitionCorporateBooking("requested", "complete"), false);
assert.equal(canTransitionCorporateBooking("confirmed", "ticket"), true);
assert.equal(canTransitionCorporateBooking("ticketed", "refund"), true);
assert.equal(canTransitionCorporateBooking("refunded", "confirm"), false);

console.log("Corporate booking policy and lifecycle tests passed: 11 scenarios.");
