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
const navigation = read("navigation.css");
const offline = read("offline.html");
const envExample = read(".env.example");
const vercel = JSON.parse(read("vercel.json"));
const render = read("render.yaml");
const betaMigration = read("supabase-beta.sql");
const ownershipMigration = read("supabase-ownership-transfer.sql");
const walletNotificationsMigration = read("supabase-wallet-notifications.sql");
const guestAccess = read("server/api/guest-access.js");

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

for (const [label, source, required] of [
  ["corporate employee ID field", html, 'id="corporateInviteEmployeeId"'],
  ["temporary and reusable employee access selector", html, 'id="corporateInviteAccessMode"'],
  ["employee event dashboard", html, 'id="employeeEventName"'],
  ["private employee portal defaults hidden", html, 'id="guestPortalPanel" hidden aria-hidden="true" inert'],
  ["employee attendance status", html, 'id="employeeAttendanceStatus"'],
  ["corporate event plan", html, 'id="corporateEmployeePlan"'],
  ["corporate event dress code", html, 'id="corporateEmployeeDressCode"'],
  ["corporate event attendee list", html, 'id="corporateEmployeeAttendeeList"'],
  ["ID-only employee event plan", html, 'id="employeePortalPlan"'],
  ["ID-only employee attendee list", html, 'id="employeePortalAttendeeList"'],
  ["employee rideshare-only portal", html, 'id="employeeRideShareList"'],
  ["employee stipend wallet", html, 'id="employeeStipendBalance"'],
  ["linked employee corporate card status", html, 'id="linkedEmployeeCardStatus"'],
  ["employee bill splitter", html, 'id="employeeBillEach"'],
  ["personal and corporate workspace switch", html, 'id="accountWorkspaceSwitch"'],
  ["guest personal-dashboard sign-up action", html, 'id="guestPortalCreateAccountButton"'],
  ["corporate attendee invite action", app, 'action: "upsert-attendee"'],
  ["individual corporate access-code action", app, 'action: "create-code"'],
  ["corporate-only account marker", app, 'personalDashboard: false'],
  ["corporate employee restricted routes", app, "corporateEmployeeBlockedTargets"],
  ["corporate employee dashboard visibility controller", app, "syncCorporateEmployeeDashboardVisibility(isEmployeeMode)"],
  ["corporate employee dashboard CSS precedence", navigation, 'html body.app-routed.corporate-employee-mode[data-active-route="dashboardHome"]'],
  ["employee-scoped corporate travel view", html, 'id="corporateEmployeeTravel"'],
  ["event-only corporate itinerary view", html, 'id="corporateEmployeeItinerary"'],
  ["corporate travel data renderer", app, "renderCorporateEmployeeTravel(portal)"],
  ["corporate itinerary data renderer", app, "renderCorporateEmployeeItinerary(portal)"],
  ["corporate employee route visibility controller", app, "syncCorporateEmployeeRouteVisibility(isEmployeeMode)"],
  ["corporate employee travel and itinerary CSS scope", navigation, "Corporate employee route scope: Travel contains only the employee's assigned"],
  ["private employee portal CSS guard", navigation, 'html body #guestPortalPanel[hidden]'],
  ["wallet ledger horizontal text guard", navigation, 'Wallet ledger precedence: transaction text keeps useful columns'],
  ["corporate employee home layout guard", navigation, "Corporate employee home precedence: global panel grids must not split"],
  ["employee portal opens through controlled visibility", app, 'setVisibilityWithoutCssLeaks($("#guestPortalPanel"), true)'],
  ["employee bill splitter remains inside wallet", app, '"splitBill"'],
  ["reusable employee access mode", app, 'accessMode === "persistent"'],
  ["complete employee access removal action", app, 'action: "remove-attendee-access"'],
  ["personal dashboard authentication guard", app, '!isFilePreview && !state.session?.user'],
  ["post-sign-up guest account upgrade", guestAccess, 'action === "upgrade-account"'],
  ["corporate invite list authorization", guestAccess, 'action === "list-invites"'],
  ["server employee access revocation", guestAccess, 'action === "remove-attendee-access"'],
  ["revoked session enforcement", guestAccess, 'Your employer has removed access to this corporate workspace.'],
  ["organization event history", guestAccess, "eventHistory"],
  ["privacy-safe event attendee directory", guestAccess, "eventAttendees"],
  ["reusable access requires organization", guestAccess, "Reusable employee access requires this corporate trip to belong to an organization."],
  ["linked employee trip membership", guestAccess, 'corporateEmployee: true'],
  ["linked employee account portal", guestAccess, 'action === "account-portal"']
]) {
  if (!source.includes(required)) fail(`${label} is missing`);
}
const employeeOverviewGuard = navigation.lastIndexOf("/* Employee overview precedence:");
const genericDestinationGuard = navigation.lastIndexOf('html body.app-routed[data-active-route="dashboardHome"] main > .destination-insights');
if (employeeOverviewGuard < genericDestinationGuard) {
  fail("corporate employee dashboard CSS guard must follow generic dashboard visibility rules");
}
if (guestAccess.includes("user_id: body.userId") || guestAccess.includes("user_id: body.user_id")) {
  fail("employer attendee invitations must not create or attach personal accounts");
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
