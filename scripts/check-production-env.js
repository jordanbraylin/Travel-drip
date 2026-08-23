const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ADMIN_EMAILS",
  "GUEST_ACCESS_PEPPER",
  "VAPID_SUBJECT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "APP_BASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
];

const optionalProviders = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "GOOGLE_PLACES_API_KEY",
  "FLIGHTAWARE_API_KEY",
  "AMADEUS_CLIENT_ID",
  "AMADEUS_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "OPENAI_MODEL"
];

const missing = (names) => names.filter((name) => !String(process.env[name] || "").trim());
const requiredMissing = missing(required);
const optionalMissing = missing(optionalProviders);

console.log("Travel-Drip production environment audit");
console.log(`Required configured: ${required.length - requiredMissing.length}/${required.length}`);
console.log(`Optional providers configured: ${optionalProviders.length - optionalMissing.length}/${optionalProviders.length}`);

if (requiredMissing.length) {
  console.log(`Missing required variables: ${requiredMissing.join(", ")}`);
}

if (optionalMissing.length) {
  console.log(`Missing optional provider variables: ${optionalMissing.join(", ")}`);
}

if (process.argv.includes("--strict") && requiredMissing.length) {
  process.exitCode = 1;
}
