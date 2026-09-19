function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function includesIgnoreCase(values, candidate) {
  if (!Array.isArray(values) || !values.length || !candidate) return true;
  const normalized = String(candidate).toLowerCase();
  return values.some((value) => String(value).toLowerCase() === normalized);
}

const bookingTransitions = {
  requested: new Set(["approve", "reject", "confirm", "cancel", "fail"]),
  approved: new Set(["confirm", "ticket", "cancel", "fail"]),
  confirmed: new Set(["ticket", "start", "cancel", "refund", "fail"]),
  ticketed: new Set(["start", "cancel", "refund", "fail"]),
  in_progress: new Set(["complete", "cancel", "fail"]),
  completed: new Set(["refund"]),
  cancelled: new Set(["refund"]),
  failed: new Set(),
  refunded: new Set()
};

export function canTransitionCorporateBooking(status, action) {
  return bookingTransitions[String(status)]?.has(String(action)) || false;
}

export function evaluateCorporatePolicy(policy, booking) {
  if (!policy) return { status: "review", reasons: ["No active corporate travel policy is assigned"] };
  const reasons = [];
  const rules = policy.rules || {};
  const amount = cents(booking.totalCents);
  const details = booking.details || {};

  if (booking.bookingType === "flight") {
    if (policy.flight_cap_cents > 0 && amount > policy.flight_cap_cents) reasons.push("Flight exceeds the approved fare cap");
    if (!includesIgnoreCase(policy.allowed_airlines, booking.providerName)) reasons.push("Airline is outside the preferred supplier list");
    const cabinOrder = ["economy", "premium_economy", "business", "first"];
    const cabin = String(details.cabin || "economy");
    if (cabinOrder.indexOf(cabin) > cabinOrder.indexOf(policy.flight_cabin || "economy")) reasons.push("Cabin class exceeds policy");
  }

  if (booking.bookingType === "hotel") {
    const nightly = cents(details.nightlyRateCents || details.nightly_rate_cents || amount);
    if (policy.hotel_nightly_cap_cents > 0 && nightly > policy.hotel_nightly_cap_cents) reasons.push("Nightly hotel rate exceeds policy");
    if (!includesIgnoreCase(policy.allowed_hotel_categories, details.category)) reasons.push("Hotel category is outside policy");
  }

  if (["car", "transportation"].includes(booking.bookingType)) {
    if (policy.ground_transport_cap_cents > 0 && amount > policy.ground_transport_cap_cents) reasons.push("Ground transportation exceeds policy");
    if (!includesIgnoreCase(policy.allowed_transport_providers, booking.providerName)) reasons.push("Transportation provider is outside policy");
  }

  if (booking.bookingType === "restaurant" && policy.meal_daily_cap_cents > 0 && amount > policy.meal_daily_cap_cents) {
    reasons.push("Meal cost exceeds the daily allowance");
  }

  if (rules.blockUnapprovedProviders && reasons.some((reason) => reason.includes("provider") || reason.includes("supplier"))) {
    return { status: "blocked", reasons };
  }
  return reasons.length ? { status: "exception", reasons } : { status: "compliant", reasons: [] };
}
