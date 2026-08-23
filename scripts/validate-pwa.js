import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const fail = (message) => {
  console.error(`PWA validation failed: ${message}`);
  process.exit(1);
};

const manifest = JSON.parse(read("manifest.webmanifest"));
const sw = read("sw.js");
const html = read("index.html");
const adminHtml = read("admin.html");
const app = read("app.js");
const offline = read("offline.html");
const envExample = read(".env.example");
const vercel = JSON.parse(read("vercel.json"));
const render = read("render.yaml");
const betaMigration = read("supabase-beta.sql");
const ownershipMigration = read("supabase-ownership-transfer.sql");
const walletNotificationsMigration = read("supabase-wallet-notifications.sql");
const guestAccess = read("api/guest-access.js");

if (manifest.name !== "Travel-Drip") fail("manifest name must be Travel-Drip");
if (manifest.short_name !== "Travel-Drip") fail("manifest short_name must be Travel-Drip");
if (manifest.display !== "standalone") fail("manifest display must be standalone");
if (manifest.start_url !== "/") fail("manifest start_url must be /");
if (manifest.orientation !== "portrait-primary") fail("manifest orientation must be portrait-primary");
if (!manifest.icons?.some((icon) => icon.sizes === "192x192")) fail("missing 192x192 icon");
if (!manifest.icons?.some((icon) => icon.sizes === "512x512")) fail("missing 512x512 icon");
if (!manifest.icons?.some((icon) => icon.purpose?.includes("maskable"))) fail("missing maskable icon");

for (const required of ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]) {
  if (!sw.includes(required)) fail(`service worker missing ${required}`);
}

const assetReference = (source, pattern, label) => {
  const match = source.match(pattern);
  if (!match) fail(`${label} is missing a versioned asset reference`);
  return `/${match[1]}`;
};

const webAssets = {
  styles: assetReference(html, /href="(styles\.css\?v=\d+)"/, "index styles"),
  navigation: assetReference(html, /href="(navigation\.css\?v=\d+)"/, "index navigation"),
  app: assetReference(html, /src="(app\.js\?v=\d+)"/, "index app"),
  config: assetReference(html, /src="(public-config\.js\?v=\d+)"/, "index public config")
};

for (const asset of Object.values(webAssets)) {
  if (!sw.includes(`"${asset}"`)) fail(`service worker cache is out of sync with ${asset}`);
}

const adminStyles = assetReference(adminHtml, /href="(styles\.css\?v=\d+)"/, "admin styles");
const adminApp = assetReference(adminHtml, /src="(app\.js\?v=\d+)"/, "admin app");
if (adminStyles !== webAssets.styles) fail("admin and web styles versions do not match");
if (adminApp !== webAssets.app) fail("admin and web app versions do not match");
if (!app.includes('register("/sw.js", { updateViaCache: "none" })')) {
  fail("service worker registration must bypass the HTTP cache when checking for updates");
}

for (const [label, pattern] of [
  ["Supabase service role key", /sb_secret_[A-Za-z0-9_-]+/],
  ["VAPID private key value", /VAPID_PRIVATE_KEY=(?!\s*$).+/],
  ["OpenAI-style secret key", /sk-[A-Za-z0-9]{20,}/]
]) {
  if (pattern.test(sw) || pattern.test(html) || pattern.test(offline)) {
    fail(`${label} appears to be committed in browser assets`);
  }
}

if (guestAccess.includes("traveldrip-local-preview") || guestAccess.includes("process.env.SUPABASE_SERVICE_ROLE_KEY")) {
  fail("guest access must not use a predictable fallback or the service-role key as a hashing pepper");
}
if (!guestAccess.includes("getPepper().length >= 32") || !guestAccess.includes("status(503)")) {
  fail("guest access must fail closed when GUEST_ACCESS_PEPPER is missing or too short");
}

for (const meta of [
  "apple-mobile-web-app-capable",
  "apple-mobile-web-app-title",
  "apple-mobile-web-app-status-bar-style",
  "mobile-web-app-capable"
]) {
  if (!html.includes(meta)) fail(`index.html missing ${meta}`);
}

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ADMIN_EMAILS",
  "GUEST_ACCESS_PEPPER",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET"
]) {
  if (!envExample.includes(`${name}=`)) fail(`.env.example missing ${name}`);
}

if (!vercel.rewrites?.some((rewrite) => rewrite.source === "/offline" && rewrite.destination === "/offline.html")) {
  fail("vercel.json missing /offline rewrite");
}
if (!vercel.crons?.some((cron) => cron.path === "/api/wallet-reminders")) {
  fail("vercel.json missing wallet reminder cron");
}

for (const required of ["runtime: static", "staticPublishPath: .", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!render.includes(required)) fail(`render.yaml missing ${required}`);
}

for (const legalPage of ["privacy.html", "terms.html"]) {
  if (!fs.existsSync(legalPage)) fail(`missing public legal page ${legalPage}`);
}

for (const required of [
  "create table if not exists public.trusted_contacts",
  "enable row level security",
  "Users read their own trusted contacts",
  "Users create their own trusted contacts",
  "on_auth_user_created_profile"
]) {
  if (!betaMigration.includes(required)) fail(`supabase-beta.sql missing ${required}`);
}

for (const required of [
  "transfer_trip_or_event_ownership",
  "revoke all on function public.transfer_trip_or_event_ownership",
  "grant execute on function public.transfer_trip_or_event_ownership(uuid, uuid, uuid, boolean) to service_role"
]) {
  if (!ownershipMigration.includes(required)) fail(`supabase-ownership-transfer.sql missing ${required}`);
}

for (const required of [
  "create table if not exists public.trip_wallet_payment_requests",
  "notify_due_trip_wallet_payments",
  "wallet_deposit_confirmed",
  "grant execute on function public.notify_due_trip_wallet_payments() to service_role"
]) {
  if (!walletNotificationsMigration.includes(required)) fail(`supabase-wallet-notifications.sql missing ${required}`);
}

console.log("Travel-Drip PWA validation passed.");
