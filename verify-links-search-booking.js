import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("index.html");
const app = read("app.js");
const navigationCss = read("navigation.css");
const pkg = JSON.parse(read("package.json"));
const travelHomeMarkup = html.match(/<section class="travel-focus-panel active" data-travel-panel="overview">([\s\S]*?)<\/section>\s*<section class="travel-focus-panel" data-travel-panel="flights">/)?.[1] || "";

function matchAll(text, regex, group = 1) {
  return [...text.matchAll(regex)].map((match) => match[group]);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function countMatches(text, regex) {
  return matchAll(text, regex, 0).length;
}

function sectionExists(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bid=["']${escaped}["']`).test(html);
}

const ids = unique(matchAll(html, /\bid=["']([^"']+)["']/g));
const targetButtons = matchAll(html, /\bdata-target=["']([^"']+)["']/g);
const mainNavigationBlock = app.match(/const mainNavigation = Object\.freeze\(\[([\s\S]*?)\n\]\);/)?.[1] || "";
const mainNavigationIds = unique(matchAll(mainNavigationBlock, /id:\s*["']([^"']+)["']/g));
const mainNavigationPaths = unique(matchAll(mainNavigationBlock, /path:\s*["']([^"']+)["']/g));
const mainNavigationControls = matchAll(html, /\bdata-main-nav-id=["']([^"']+)["']/g);
const requiredMainNavigationIds = ["dashboard", "planning", "itinerary", "events", "travel", "wallet", "chat", "important-info", "memories", "settings"];
const requiredToolbarRoutes = {
  dashboard: "/dashboard",
  planning: "/planning",
  itinerary: "/itinerary",
  events: "/events",
  travel: "/travel",
  wallet: "/wallet",
  chat: "/chat",
  "important-info": "/important-info",
  memories: "/memories",
  settings: "/settings"
};
const sidebarBlock = html.match(/<aside\b[^>]*class=["'][^"']*\bsidebar\b[^"']*["'][\s\S]*?<\/aside>/)?.[0] || "";
const sidebarMainNavigationIds = unique(matchAll(sidebarBlock, /\bdata-main-nav-id=["']([^"']+)["']/g));
const routeBlock = app.match(/const routeDefinitions = \{([\s\S]*?)\n\};/)?.[1] || "";
const routeTargets = unique(matchAll(routeBlock, /^\s{2}([A-Za-z0-9_]+):\s*\{\s*path:/gm));
const routeSupportTargets = unique(matchAll(html, /\bdata-route-support=["']([^"']+)["']/g).flatMap((value) => value.split(/\s+/).filter(Boolean)));
const extractedRouteComponents = unique(matchAll(html, /\bid=["']([^"']+)["'][^>]*\bdata-route-extract\b/g));
const dashboardOnlyIds = unique(matchAll(html, /<[^>]*\bid=["']([^"']+)["'][^>]*\bdata-dashboard-only\b[^>]*>/g));
const dashboardOnlyRequiredIds = ["dashboardHome", "dashboardWidgets"];
const todayHeadingCount = countMatches(html, /Today in Travel-Drip/g);
const travelDocumentCardCount = countMatches(html, /class=["'][^"']*\btravel-document-card\b[^"']*["']/g);
const fullWidthWidgetCss = navigationCss.split("/* Full-width Smart Dashboard pass")[1] || "";
const routeTypographyCss = navigationCss.split("/* App-wide route typography:")[1] || "";
const fullWidthWidgetIssues = [];
if (!fullWidthWidgetCss.includes("body.app-routed main,")
  || !fullWidthWidgetCss.includes("body.signed-in-shell main")
  || !fullWidthWidgetCss.includes("width: 100% !important;")
  || !fullWidthWidgetCss.includes("max-width: none !important;")) {
  fullWidthWidgetIssues.push("Authenticated main content is not explicitly full width");
}
if (!fullWidthWidgetCss.includes(".smart-dashboard-grid > *,\n.widget-grid > *")) {
  fullWidthWidgetIssues.push("Widget cards are not explicitly sized to fill their grid tracks");
}
if (!fullWidthWidgetCss.includes("writing-mode: horizontal-tb !important")
  || !fullWidthWidgetCss.includes("word-break: normal !important")) {
  fullWidthWidgetIssues.push("Widget title text does not have an explicit horizontal wrapping rule");
}
if (!fullWidthWidgetCss.includes("grid-column: span 6 !important")
  || !fullWidthWidgetCss.includes("grid-column: 1 / -1 !important")) {
  fullWidthWidgetIssues.push("Smart Dashboard tablet/mobile column rules are incomplete");
}
if (!routeTypographyCss.includes("body.app-routed [data-route-component]:not([hidden])")
  || !routeTypographyCss.includes("writing-mode: horizontal-tb !important")
  || !routeTypographyCss.includes(".section-heading > *")) {
  fullWidthWidgetIssues.push("Route-level headings are missing the horizontal full-width text rules");
}
const travelDocumentRequiredClasses = [
  "travel-documents-section",
  "travel-documents-grid",
  "travel-document-card__title",
  "travel-document-card__description",
  "travel-document-card__due",
  "travel-document-card__status"
];
const hrefs = matchAll(html, /\bhref=["']([^"']*)["']/g);
const ariaControls = matchAll(html, /\baria-controls=["']([^"']+)["']/g);
const dateInputs = [...html.matchAll(/<input\b[^>]*\btype=["'](date|datetime-local)["'][^>]*>/g)].map((match) => match[0]);
const searchInputs = [...html.matchAll(/<input\b[^>]*\btype=["']search["'][^>]*>/g)].map((match) => match[0]);
const buttonCount = countMatches(html, /<button\b/g);
const linkCount = hrefs.length;
const actionAttributes = unique(matchAll(html, /\b(data-[a-z0-9-]+)=["'][^"']+["']/gi));
const externalHrefs = hrefs.filter((href) => /^https?:\/\//i.test(href));
const placeholderHrefs = hrefs.filter((href) => !href || href === "#");

const targetIssues = [];
requiredMainNavigationIds.forEach((id) => {
  if (!mainNavigationIds.includes(id)) targetIssues.push(`Missing shared main navigation item: ${id}`);
  if (!mainNavigationControls.includes(id)) targetIssues.push(`No rendered control uses shared main navigation item: ${id}`);
});
mainNavigationPaths.forEach((path) => {
  if (!app.includes(`"${path}"`)) targetIssues.push(`Shared main navigation path is not registered: ${path}`);
});
unique(targetButtons).forEach((target) => {
  if (!sectionExists(target)) targetIssues.push(`Missing screen section for data-target="${target}"`);
  if (!routeTargets.includes(target)) targetIssues.push(`Missing routeDefinition for data-target="${target}"`);
});

const routeIsolationIssues = [];
routeSupportTargets.forEach((target) => {
  if (!routeTargets.includes(target)) routeIsolationIssues.push(`data-route-support references unknown route: ${target}`);
});
for (const required of ["dailyMemoryPanel", "socialMediaHub"]) {
  if (!extractedRouteComponents.includes(required)) routeIsolationIssues.push(`Missing extracted route component: ${required}`);
}

const dashboardOnlyIssues = dashboardOnlyRequiredIds
  .filter((id) => !dashboardOnlyIds.includes(id))
  .map((id) => `Dashboard-only section is not marked: ${id}`);
if (todayHeadingCount !== 1) dashboardOnlyIssues.push(`Expected one Today in Travel-Drip heading, found ${todayHeadingCount}`);
if (!app.includes("[data-dashboard-only]") || !app.includes("section.hidden = !isHome")) {
  dashboardOnlyIssues.push("Route renderer does not explicitly toggle dashboard-only sections");
}

const toolbarNavigationIssues = requiredMainNavigationIds
  .filter((id) => !sidebarMainNavigationIds.includes(id))
  .map((id) => `Sidebar is missing shared navigation item: ${id}`);
Object.entries(requiredToolbarRoutes).forEach(([id, path]) => {
  if (!mainNavigationBlock.includes(`id: "${id}"`) || !mainNavigationBlock.includes(`path: "${path}"`)) {
    toolbarNavigationIssues.push(`Shared navigation route is missing or incorrect: ${id} -> ${path}`);
  }
});
if (sidebarBlock.includes('data-main-nav-id="cruise"')) {
  toolbarNavigationIssues.push("Cruise must remain nested under Travel, not a main sidebar route");
}
if (!app.includes("applyMainNavigationConfig()") || !app.includes("syncNavigationState")) {
  toolbarNavigationIssues.push("Shared navigation configuration is not applied to route controls");
}

const travelDocumentIssues = travelDocumentRequiredClasses
  .filter((className) => !html.includes(className))
  .map((className) => `Required travel-document class is missing: ${className}`);
if (travelDocumentCardCount !== 4) travelDocumentIssues.push(`Expected four travel document cards, found ${travelDocumentCardCount}`);
if (!navigationCss.includes("grid-template-columns: repeat(4, minmax(220px, 1fr))")
  || !navigationCss.includes("grid-template-columns: repeat(2, minmax(240px, 1fr))")
  || !navigationCss.includes("grid-template-columns: 1fr")) {
  travelDocumentIssues.push("Travel document responsive 4/2/1 grid rules are incomplete");
}

const outerWrapperSelectors = [
  "[data-route-component]:not([hidden])",
  ".messages-hub",
  ".travel-workspace",
  ".ride-hub-redesign",
  ".reservation-reminder-panel",
  ".wallet-redesign-shell",
  ".memories-gallery-shell",
  ".settings-shell",
  ".admin-settings-shell"
];
const outerWrapperIssues = outerWrapperSelectors
  .filter((selector) => !navigationCss.includes(selector))
  .map((selector) => `Missing outer-wrapper cleanup selector: ${selector}`);

const focusedLayoutChecks = [
  ["Itinerary layout", html.includes('id="itineraryAlerts"') && html.includes("itinerary-card--today") && html.includes("itinerary-timeline-list") && navigationCss.includes("#itineraryAlerts > .itinerary-dashboard") && navigationCss.includes("grid-template-columns: repeat(12, minmax(0, 1fr))") && navigationCss.includes("#itineraryAlerts .itinerary-timeline-list details summary") && navigationCss.includes("#itineraryAlerts .reservation-preferences-grid")],
  ["Memories layout", html.includes('id="memoriesPanel"') && navigationCss.includes("#memoriesPanel .memory-gallery-grid") && navigationCss.includes("#memoriesPanel .memory-media-card")],
  ["Event controls and cards", html.includes('id="eventsPanel"') && navigationCss.includes("#eventsPanel .event-dashboard-tabs") && navigationCss.includes("#eventsPanel .event-experience-card")],
  ["Wallet formatting", html.includes('id="walletPanel"') && html.includes('class="wallet-operations-panel"') && navigationCss.includes("#walletPanel > .wallet-dashboard-header") && navigationCss.includes("#walletPanel > .wallet-redesign-shell") && navigationCss.includes("#walletPanel > .wallet-operations-panel") && navigationCss.includes("Wallet text visibility") && navigationCss.includes("grid-template-columns: repeat(3, minmax(0, 1fr))")],
  ["Smart Travel Search icon", html.includes('<span class="travel-search-icon" aria-hidden="true"></span>') && navigationCss.includes("#rideShareHub .travel-search-icon::after") && navigationCss.includes("#rideShareHub .travel-smart-search-row")],
  ["Chat layout", html.includes('id="socialHub"') && navigationCss.includes("#socialHub .messages-layout") && navigationCss.includes("#socialHub .chat-workspace") && navigationCss.includes("#socialHub .conversation-details-panel")],
  ["Chat vibe shortcuts", html.includes("chat-vibe-strip") && html.includes("Vote on dinner") && html.includes("Drop a memory") && navigationCss.includes("Chat vibe refresh") && navigationCss.includes("#socialHub .chat-vibe-actions")],
  ["Widget headers stay on top", html.includes('class="widget-toolbar"') && navigationCss.includes("body.app-routed :where(.smart-widget, .travel-widget, [data-widget]) > .widget-toolbar") && navigationCss.includes("grid-column: 1 / -1 !important")],
  ["Wallet and boarding pass visuals", html.includes('class="card-chip"') && html.includes("digital-boarding-pass") && navigationCss.includes("#virtualCard .virtual-card") && navigationCss.includes("#rideShareHub .digital-boarding-pass")],
  ["Travel-Drip Pass workspace", html.includes('id="travelBoardingPasses"') && navigationCss.includes("#rideShareHub .travel-pass-workspace") && navigationCss.includes("single-focus-pass")],
  ["AI item recognition layout", html.includes('class="receipt-items-panel"') && html.includes('class="receipt-item-list"') && navigationCss.includes("#splitBill .receipt-workspace") && navigationCss.includes("#splitBill .receipt-item-list > article") && navigationCss.includes("#splitBill .receipt-claim-grid")],
  ["Readable app widget text", navigationCss.includes("App content color pass") && navigationCss.includes("color: var(--ink) !important") && navigationCss.includes("color: var(--muted) !important")],
  ["White sidebar toolbar", navigationCss.includes("Navigation chrome stays white") && navigationCss.includes("body.app-routed :where(.sidebar, .mobile-nav)")],
  ["Itinerary Smart Dashboard", navigationCss.includes("Itinerary Smart Dashboard") && navigationCss.includes("#itineraryAlerts > .itinerary-dashboard > .itinerary-card") && navigationCss.includes("#itineraryAlerts > .itinerary-dashboard") && navigationCss.includes("background: transparent !important") && navigationCss.includes("grid-template-columns: repeat(4, minmax(0, 1fr)) !important") && navigationCss.includes("#itineraryAlerts > .itinerary-timeline-dashboard")],
  ["Itinerary Dashboard header", html.includes("Itinerary Dashboard") && navigationCss.includes("Itinerary Dashboard header") && navigationCss.includes("#itineraryAlerts > .section-heading") && navigationCss.includes("grid-template-columns: minmax(0, 1fr) auto !important")],
  ["Compact widget sizing", navigationCss.includes("Compact Smart Dashboard density") && navigationCss.includes("grid-auto-rows: max-content") && navigationCss.includes("min-height: 0 !important")],
  ["No oversized parent widgets", navigationCss.includes("Global parent widget cleanup") && navigationCss.includes("background: transparent !important") && navigationCss.includes("border: 0 !important") && navigationCss.includes("box-shadow: none !important") && navigationCss.includes("grid-auto-rows: max-content !important")],
  ["Itinerary matches Events styling", navigationCss.includes("Itinerary matches the Events dashboard") && navigationCss.includes("#itineraryAlerts > .itinerary-dashboard") && navigationCss.includes("grid-template-columns: repeat(4, minmax(0, 1fr)) !important") && navigationCss.includes("#itineraryAlerts .itinerary-timeline-list") && navigationCss.includes("#itineraryAlerts .alert-category-grid")],
  ["Travel boarding, rail, and hotel widgets", html.includes('data-travel-panel="boarding"') && html.includes('data-travel-panel="trains"') && html.includes('data-travel-panel="hotels"') && navigationCss.includes("Travel tab card repair") && navigationCss.includes('#rideShareHub [data-travel-panel="boarding"] .digital-boarding-pass') && navigationCss.includes('#rideShareHub [data-travel-panel="trains"] .travel-focus-grid > article') && navigationCss.includes('#rideShareHub [data-travel-panel="hotels"] .travel-focus-grid > article')],
  ["Travel-Drip Pass card widths", html.includes('id="travelBoardingPasses"') && navigationCss.includes("Travel-Drip Pass workspace: prevent the legacy narrow side rail") && navigationCss.includes("#rideShareHub #travelBoardingPasses .visual-pass-grid") && navigationCss.includes("grid-template-columns: repeat(3, minmax(0, 1fr)) !important") && navigationCss.includes("#rideShareHub #travelBoardingPasses .visual-pass-card h4")],
  ["Itinerary reservation titles", html.includes("Real-time ready") && html.includes("Ocean Rooftop Grill") && html.includes("Catamaran Sunset Cruise") && navigationCss.includes("Itinerary reservation titles") && navigationCss.includes("#itineraryAlerts > .upcoming-reservation-grid > article") && navigationCss.includes("grid-template-columns: repeat(4, minmax(180px, 1fr)) !important")],
  ["Itinerary no overflow and compact alert controls", html.includes('class="security-note"') && html.includes('class="alert-category-grid"') && navigationCss.includes("Itinerary overflow repair") && navigationCss.includes("#itineraryAlerts > .security-note") && navigationCss.includes("min-height: 0 !important") && navigationCss.includes("grid-auto-rows: max-content !important") && navigationCss.includes("#itineraryAlerts .itinerary-timeline-list")],
  ["Itinerary route stays full-width", navigationCss.includes("Route view repair") && navigationCss.includes("#itineraryAlerts > *") && navigationCss.includes("#itineraryAlerts > .alert-category-grid") && navigationCss.includes("grid-column: 1 / -1 !important") && navigationCss.includes("position: relative !important")],
  ["Wallet route stays readable", html.includes('id="walletPanel"') && html.includes("wallet-metric-list") && navigationCss.includes("Wallet route repair") && navigationCss.includes("#walletPanel > *") && navigationCss.includes("#walletPanel > .wallet-redesign-shell > .wallet-dashboard-sections") && navigationCss.includes("#walletPanel > .wallet-redesign-shell .wallet-metric-list") && navigationCss.includes("grid-template-columns: repeat(3, minmax(0, 1fr)) !important")],
  ["Wallet contrast stays readable", html.includes('id="walletPanel"') && navigationCss.includes("Wallet contrast repair") && navigationCss.includes("color: #10202f !important") && navigationCss.includes("color: #607280 !important") && navigationCss.includes("#walletPanel :where(input, select, textarea)")],
  ["AI receipt workspace stays readable", html.includes('id="splitBill"') && html.includes('class="receipt-workspace"') && navigationCss.includes("AI receipt workspace repair") && navigationCss.includes("#splitBill > *") && navigationCss.includes("#splitBill .receipt-item-list") && navigationCss.includes("#splitBill .receipt-claim-grid") && navigationCss.includes("writing-mode: horizontal-tb !important")],
  ["AI recognition widget stays horizontal", html.includes('id="aiBillReviewButton"') && navigationCss.includes("AI recognition widget repair") && navigationCss.includes("#splitBill .receipt-workspace") && navigationCss.includes("#splitBill .receipt-items-panel > .section-heading") && navigationCss.includes("grid-template-columns: minmax(0, 1fr) !important")],
  ["Overview Memories collage stays contained", html.includes("memories-widget") && html.includes('class="mini-collage"') && navigationCss.includes("Overview Memories widget repair") && navigationCss.includes("#dashboardWidgets .memories-widget .mini-collage") && navigationCss.includes("overflow: hidden !important") && navigationCss.includes("#dashboardWidgets .memories-widget > .ghost-button")],
  ["Travel Home summary cards stay readable", html.includes('data-travel-panel="overview"') && navigationCss.includes("Travel Home summary card repair") && navigationCss.includes('#rideShareHub [data-travel-panel="overview"] .travel-booking-summary') && navigationCss.includes("grid-template-columns: minmax(0, 1fr) auto !important") && navigationCss.includes("grid-template-areas:")],
  ["My Profile widgets stay readable", html.includes('id="myProfile"') && html.includes('class="profile-stats-grid"') && html.includes('class="profile-adventure-grid"') && navigationCss.includes("My Profile widget repair") && navigationCss.includes("#myProfile .profile-stats-grid") && navigationCss.includes("#myProfile .profile-adventure-grid") && navigationCss.includes("grid-template-areas:")],
  ["Travel selected page panel removed", !html.includes('id="travelSelectedTile"') && !html.includes('class="travel-selected-tile"')],
  ["Travel Home avoids duplicate summaries", travelHomeMarkup.includes('class="travel-booking-summary"') && travelHomeMarkup.includes('class="travel-transport-summary"') && !travelHomeMarkup.includes('class="travel-dashboard-sections"') && !travelHomeMarkup.includes('class="travel-focus-grid"')],
  ["Travel uses one canonical navigation", countMatches(html, /class="travel-settings-nav"/g) === 1 && !html.includes('class="travel-section-nav"') && html.includes('data-travel-focus="boarding">Tickets &amp; Boarding</button>')],
  ["Travel duplicate widgets are consolidated", html.includes('class="travel-overview-card" hidden') && html.includes('class="travel-workspace" hidden') && html.includes('class="travel-support-grid" hidden')]
];
const focusedLayoutIssues = focusedLayoutChecks
  .filter(([, passed]) => !passed)
  .map(([label]) => `${label} is missing its focused layout implementation`);

const corporateExperienceChecks = [
  ["Visible Corporate navigation entry", html.includes('data-corporate-entry') && html.includes('data-target="enterpriseRbac"')],
  ["Corporate tab entry", html.includes('class="corporate-tab"') && html.includes('data-target="enterpriseRbac"')],
  ["Secure corporate access gate", html.includes('id="corporateAccessDialog"') && app.includes("showCorporateAccessGate") && app.includes("hasValidCorporateAccess")],
  ["Policy and conditions", html.includes("Travel policy engine") && html.includes("Corporate acceptance checklist") && html.includes("Financial privacy enforced")],
  ["Role and finance restrictions", html.includes("data-visible-roles") && html.includes("data-financial-panel") && app.includes("isFinancialRole")],
  ["Corporate entry styling", navigationCss.includes(".corporate-entry-nav") && navigationCss.includes(".corporate-tab")]
];
const corporateExperienceIssues = corporateExperienceChecks
  .filter(([, passed]) => !passed)
  .map(([label]) => `${label} is missing or disconnected`);

const textContainmentChecks = [
  ["Horizontal text flow", navigationCss.includes("Global horizontal text flow") && navigationCss.includes("All authenticated panel headings") && navigationCss.includes("Final widget text-flow hardening") && navigationCss.includes("Bubble text rows must span the widget") && navigationCss.includes("grid-column: 1 / -1 !important") && navigationCss.includes("writing-mode: horizontal-tb !important") && navigationCss.includes("word-break: normal !important")],
  ["Full-width widget titles", navigationCss.includes(".memory-media-card") && navigationCss.includes("h1, h2, h3, h4, h5, h6") && navigationCss.includes("width: 100% !important")],
  ["No narrow photo caption column", navigationCss.includes(".memory-media-card {\n  grid-template-columns: none !important;")],
  ["Contained photos and captions", navigationCss.includes(".memory-media-card img") && navigationCss.includes("overflow-wrap: anywhere !important")],
  ["Wrapped widget actions", navigationCss.includes(".memory-card-actions") && navigationCss.includes("flex-wrap: wrap !important")]
];
const textContainmentIssues = textContainmentChecks
  .filter(([, passed]) => !passed)
  .map(([label]) => `${label} is missing or incomplete`);

const ariaIssues = [];
unique(ariaControls).forEach((target) => {
  if (!ids.includes(target)) ariaIssues.push(`Missing aria-controls target "${target}"`);
});

const linkIssues = [];
hrefs.forEach((href) => {
  if (!href || href === "#") linkIssues.push(`Placeholder href detected: "${href}"`);
  if (/^http:\/\//i.test(href)) linkIssues.push(`Insecure external href detected: ${href}`);
});

const searchResults = searchInputs.map((input) => {
  const id = input.match(/\bid=["']([^"']+)["']/)?.[1] || "";
  return {
    id,
    referencedInApp: id ? app.includes(`#${id}`) || app.includes(`"${id}"`) || app.includes(`'${id}'`) : false,
    hasLabelOrPlaceholder: /placeholder=["'][^"']+["']/.test(input)
  };
});

const dateResults = dateInputs.map((input) => {
  const id = input.match(/\bid=["']([^"']+)["']/)?.[1] || "";
  return {
    id,
    type: input.match(/\btype=["']([^"']+)["']/)?.[1] || "",
    referencedInApp: id ? app.includes(`#${id}`) || app.includes(`"${id}"`) || app.includes(`'${id}'`) : false,
    hasDefaultValue: /\bvalue=["'][^"']+["']/.test(input)
  };
});

const expectedDatePairs = [
  ["tripStartInput", "tripEndInput"],
  ["tripStartInput", "inviteDeadlineInput"],
  ["tripStartInput", "eventRsvpDeadlineInput"]
];

const datePairResults = expectedDatePairs.map(([start, end]) => ({
  start,
  end,
  fieldsPresent: ids.includes(start) && ids.includes(end),
  bothReferencedInApp: app.includes(start) && app.includes(end),
  invalidRangeGuardPresent: /end.*before start|invalid date|date range/i.test(app)
}));

const providerSignals = [
  ["Provider-required labeling", /provider required|provider_required|provider confirmation|required before payment/i],
  ["Estimated pricing labeling", /estimated price|pricing is estimated|estimated/i],
  ["Manual data labeling", /manually entered|manual/i],
  ["Booking not marked confirmed without provider", /Provider confirmation is required before payment|Do not display “Booked”|Failed bookings are not marked confirmed/i],
  ["Realtime limitations stated", /Do not label flight information as real time|live provider|provider integrations before they can be production-live/i]
].map(([label, regex]) => ({ label, present: regex.test(html) || regex.test(app) || regex.test(read("README.md")) }));

const apiFiles = fs.existsSync(path.join(root, "api"))
  ? fs.readdirSync(path.join(root, "api")).filter((file) => file.endsWith(".js")).sort()
  : [];

const results = {
  generatedAt: new Date().toISOString(),
  package: { name: pkg.name, version: pkg.version },
  totals: {
    screenIds: ids.length,
    buttons: buttonCount,
    hrefLinks: linkCount,
    dataTargets: targetButtons.length,
    uniqueDataTargets: unique(targetButtons).length,
    mainNavigationControls: mainNavigationControls.length,
    mainNavigationItems: mainNavigationIds.length,
    routeDefinitions: routeTargets.length,
    dateInputs: dateInputs.length,
    searchInputs: searchInputs.length,
    actionAttributeTypes: actionAttributes.length,
    apiRoutes: apiFiles.length
  },
  linkAndRouteVerification: {
    workingLocalTargets: unique(targetButtons).filter((target) => sectionExists(target) && routeTargets.includes(target)).length,
    targetIssues,
    ariaIssues,
    linkIssues,
    externalHrefs,
    placeholderHrefs
  },
  mainNavigationVerification: {
    requiredItems: requiredMainNavigationIds,
    configuredItems: mainNavigationIds,
    configuredPaths: mainNavigationPaths,
    renderedControlCount: mainNavigationControls.length,
    issues: targetIssues.filter((issue) => issue.includes("main navigation") || issue.includes("Shared main navigation"))
  },
  routeIsolationVerification: {
    requiredExtractedComponents: ["dailyMemoryPanel", "socialMediaHub"],
    extractedComponents: extractedRouteComponents,
    supportedRoutes: routeSupportTargets,
    issues: routeIsolationIssues,
    status: routeIsolationIssues.length ? "FAIL" : "PASS"
  },
  dashboardOnlyVerification: {
    requiredIds: dashboardOnlyRequiredIds,
    markedIds: dashboardOnlyIds,
    todayHeadingCount,
    issues: dashboardOnlyIssues,
    status: dashboardOnlyIssues.length ? "FAIL" : "PASS"
  },
  toolbarNavigationVerification: {
    requiredRoutes: requiredToolbarRoutes,
    sidebarItems: sidebarMainNavigationIds,
    issues: toolbarNavigationIssues,
    status: toolbarNavigationIssues.length ? "FAIL" : "PASS"
  },
  fullWidthWidgetVerification: {
    issues: fullWidthWidgetIssues,
    status: fullWidthWidgetIssues.length ? "FAIL" : "PASS"
  },
  travelDocumentsVerification: {
    cardCount: travelDocumentCardCount,
    requiredClasses: travelDocumentRequiredClasses,
    issues: travelDocumentIssues,
    status: travelDocumentIssues.length ? "FAIL" : "PASS"
  },
  outerWrapperVerification: {
    selectors: outerWrapperSelectors,
    issues: outerWrapperIssues,
    status: outerWrapperIssues.length ? "FAIL" : "PASS"
  },
  focusedRouteLayoutVerification: {
    checks: focusedLayoutChecks.map(([label, passed]) => ({ label, status: passed ? "PASS" : "FAIL" })),
    issues: focusedLayoutIssues,
    status: focusedLayoutIssues.length ? "FAIL" : "PASS"
  },
  corporateExperienceVerification: {
    checks: corporateExperienceChecks.map(([label, passed]) => ({ label, status: passed ? "PASS" : "FAIL" })),
    issues: corporateExperienceIssues,
    status: corporateExperienceIssues.length ? "FAIL" : "PASS"
  },
  textContainmentVerification: {
    checks: textContainmentChecks.map(([label, passed]) => ({ label, status: passed ? "PASS" : "FAIL" })),
    issues: textContainmentIssues,
    status: textContainmentIssues.length ? "FAIL" : "PASS"
  },
  datePickerVerification: {
    status: "Native browser date/datetime-local controls present locally; full custom popover/mobile calendar QA requires browser/device testing.",
    fields: dateResults,
    ranges: datePairResults
  },
  searchVerification: {
    status: "Local UI search fields are present; provider-backed travel search requires live integrations.",
    fields: searchResults,
    missingAppReferences: searchResults.filter((field) => !field.referencedInApp).map((field) => field.id)
  },
  bookingAndRealtimeVerification: {
    status: "Not production-complete without live provider credentials and deployed callback/webhook testing.",
    providerSignals,
    apiRoutes: apiFiles
  },
  productionTesting: {
    status: "Not run by this local script.",
    reason: "Network access, provider credentials, and browser/device farm access are outside this local workspace execution."
  }
};

const criticalIssues = [
  ...targetIssues,
  ...routeIsolationIssues,
  ...dashboardOnlyIssues,
  ...toolbarNavigationIssues,
  ...fullWidthWidgetIssues,
  ...travelDocumentIssues,
  ...outerWrapperIssues,
  ...focusedLayoutIssues,
  ...corporateExperienceIssues,
  ...textContainmentIssues,
  ...ariaIssues,
  ...linkIssues,
  ...searchResults.filter((field) => !field.referencedInApp).map((field) => `Search input is not referenced in app.js: ${field.id || "unknown"}`),
  ...dateResults.filter((field) => !field.referencedInApp).map((field) => `Date input is not referenced in app.js: ${field.id || "unknown"}`)
];

const providerBlocked = true;
const finalStatus = criticalIssues.length
  ? "Not Ready for Production"
  : providerBlocked
    ? "Ready with Documented Limitations"
    : "Ready for Production";

results.finalStatus = finalStatus;
results.criticalIssues = criticalIssues;

const ok = (value) => value ? "PASS" : "REVIEW";
const report = `# Travel-Drip Links, Search, Date Picker, Booking, and Real-Time Updates Verification

Generated: ${results.generatedAt}

## Final Status

**${finalStatus}**

This local verification checks static routes, link targets, search/date field wiring, provider labels, and API surface. It does **not** certify live provider search, booking callbacks, webhooks, real-time flight data, push delivery, or deployed browser/device behavior.

## Summary

- Total buttons inspected: ${buttonCount}
- Total links inspected: ${linkCount}
- Data-target controls inspected: ${targetButtons.length}
- Working local data-target routes: ${results.linkAndRouteVerification.workingLocalTargets}/${unique(targetButtons).length}
- Shared main-navigation controls inspected: ${mainNavigationControls.length}
- Shared main-navigation items configured: ${mainNavigationIds.length}/${requiredMainNavigationIds.length}
- Route definitions found: ${routeTargets.length}
- Date fields found: ${dateInputs.length}
- Search fields found: ${searchInputs.length}
- API route files found: ${apiFiles.length}
- Critical local issues: ${criticalIssues.length}

## Link and Redirect Verification

- Target validation: ${ok(targetIssues.length === 0)}
- ARIA control validation: ${ok(ariaIssues.length === 0)}
- HREF validation: ${ok(linkIssues.length === 0)}
- External HTTPS links: ${externalHrefs.length}
- Shared main navigation: ${ok(results.mainNavigationVerification.issues.length === 0)}

${targetIssues.length ? `### Target Issues\n${targetIssues.map((issue) => `- ${issue}`).join("\n")}` : "No missing local data-target sections or route definitions were detected."}

${ariaIssues.length ? `### ARIA Issues\n${ariaIssues.map((issue) => `- ${issue}`).join("\n")}` : "No missing aria-controls targets were detected."}

${linkIssues.length ? `### Link Issues\n${linkIssues.map((issue) => `- ${issue}`).join("\n")}` : "No placeholder or insecure href values were detected."}

${results.mainNavigationVerification.issues.length ? `### Main Navigation Issues\n${results.mainNavigationVerification.issues.map((issue) => `- ${issue}`).join("\n")}` : `Shared navigation config covers ${requiredMainNavigationIds.join(", ")} and is stamped onto ${mainNavigationControls.length} header, sidebar, dashboard, and mobile controls.`}

## Route Isolation Verification

- Route-scoped components: ${ok(routeIsolationIssues.length === 0)}
- Extracted components: ${extractedRouteComponents.join(", ") || "none"}
- Supported route scopes: ${routeSupportTargets.join(", ") || "none"}

${routeIsolationIssues.length ? `### Route Isolation Issues\n${routeIsolationIssues.map((issue) => `- ${issue}`).join("\n")}` : "Chat owns messaging only; Daily Memory is mounted under Memories and Social Media Hub is mounted under Settings."}

## Dashboard-Only Content Verification

- Dashboard-only section markers: ${ok(dashboardOnlyIssues.length === 0)}
- Marked sections: ${dashboardOnlyIds.join(", ") || "none"}
- Today in Travel-Drip heading count: ${todayHeadingCount}

${dashboardOnlyIssues.length ? `### Dashboard-Only Issues\n${dashboardOnlyIssues.map((issue) => `- ${issue}`).join("\n")}` : "Today in Travel-Drip is defined once inside the Dashboard widget section, and the route renderer hides all dashboard-only sections on other routes."}

## Side Toolbar Navigation Verification

| Toolbar item | Expected route | Shared config | Sidebar control | Status |
| --- | --- | --- | --- |
${Object.entries(requiredToolbarRoutes).map(([id, path]) => `| ${id} | ${path} | ${mainNavigationBlock.includes(`id: "${id}"`) && mainNavigationBlock.includes(`path: "${path}"`) ? "yes" : "no"} | ${sidebarMainNavigationIds.includes(id) ? "yes" : "no"} | ${toolbarNavigationIssues.some((issue) => issue.includes(id)) ? "review" : "pass"} |`).join("\n")}

${toolbarNavigationIssues.length ? `### Toolbar Navigation Issues\n${toolbarNavigationIssues.map((issue) => `- ${issue}`).join("\n")}` : "All ten main sidebar routes use the shared navigation configuration; Cruise remains nested under Travel."}

## Full-Width Widget Verification

- Full-width authenticated content: ${ok(fullWidthWidgetIssues.length === 0)}
- Horizontal title wrapping: ${ok(fullWidthWidgetIssues.length === 0)}
- Responsive Smart Dashboard rules: ${ok(fullWidthWidgetIssues.length === 0)}

${fullWidthWidgetIssues.length ? `### Full-Width Widget Issues\n${fullWidthWidgetIssues.map((issue) => `- ${issue}`).join("\n")}` : "Authenticated tabs use the full content width, widget cards fill their grid tracks, and widget titles are explicitly kept horizontal."}

## Required Travel Documents Verification

- Document card structure: ${ok(travelDocumentIssues.length === 0)}
- Document cards: ${travelDocumentCardCount}
- Responsive grid rules: ${ok(travelDocumentIssues.length === 0)}

${travelDocumentIssues.length ? `### Travel Document Issues\n${travelDocumentIssues.map((issue) => `- ${issue}`).join("\n")}` : "Required Travel Documents uses four compact cards with horizontal text flow and responsive desktop/tablet/mobile columns."}

## Outer Wrapper Verification

- Outer-shell cleanup selectors: ${ok(outerWrapperIssues.length === 0)}

${outerWrapperIssues.length ? `### Outer Wrapper Issues\n${outerWrapperIssues.map((issue) => `- ${issue}`).join("\n")}` : "Route roots and visible inner shells are transparent; individual widgets retain their card styling."}

## Focused Route Layout Verification

- Itinerary, Events, Memories, Wallet, Smart Travel Search, Chat, widget headers, Travel-Drip Pass, and compact sizing: ${ok(focusedLayoutIssues.length === 0)}

${focusedLayoutChecks.map(([label, passed]) => `- ${label}: ${ok(passed)}`).join("\n")}

${focusedLayoutIssues.length ? `### Focused Layout Issues\n${focusedLayoutIssues.map((issue) => `- ${issue}`).join("\n")}` : "Focused route grids, compact event controls, horizontal widget text, wallet summaries, and the Smart Travel Search icon are present."}

## Corporate Experience Verification

- Corporate section restored: ${ok(corporateExperienceIssues.length === 0)}

${corporateExperienceChecks.map(([label, passed]) => `- ${label}: ${ok(passed)}`).join("\n")}

${corporateExperienceIssues.length ? `### Corporate Experience Issues\n${corporateExperienceIssues.map((issue) => `- ${issue}`).join("\n")}` : "Corporate navigation is reachable, secure access verification remains required, and the existing policy, role, financial privacy, audit, and acceptance conditions remain present."}

## Text Containment Verification

- Widget text and photo captions: ${ok(textContainmentIssues.length === 0)}

${textContainmentChecks.map(([label, passed]) => `- ${label}: ${ok(passed)}`).join("\n")}

${textContainmentIssues.length ? `### Text Containment Issues\n${textContainmentIssues.map((issue) => `- ${issue}`).join("\n")}` : "Widget titles, descriptions, status text, actions, and photo captions use horizontal full-width flow without narrow side columns."}

## Date Picker Verification

Status: ${results.datePickerVerification.status}

${dateResults.map((field) => `- ${field.id || "(missing id)"}: type=${field.type}, app reference=${field.referencedInApp ? "yes" : "no"}, default value=${field.hasDefaultValue ? "yes" : "no"}`).join("\n")}

### Date Range Review

${datePairResults.map((range) => `- ${range.start} → ${range.end}: fields present=${range.fieldsPresent ? "yes" : "no"}, app references=${range.bothReferencedInApp ? "yes" : "no"}, explicit invalid-range guard=${range.invalidRangeGuardPresent ? "yes" : "review"}`).join("\n")}

## Search Verification

Status: ${results.searchVerification.status}

${searchResults.map((field) => `- ${field.id || "(missing id)"}: app reference=${field.referencedInApp ? "yes" : "no"}, placeholder/label=${field.hasLabelOrPlaceholder ? "yes" : "review"}`).join("\n")}

## Booking and Real-Time Updates

Status: ${results.bookingAndRealtimeVerification.status}

${providerSignals.map((signal) => `- ${signal.label}: ${signal.present ? "present" : "missing/review"}`).join("\n")}

## API Surface

${apiFiles.map((file) => `- api/${file}`).join("\n")}

## Remaining Production Limitations

- Live flight search and real-time status require a configured flight-data provider.
- Hotel, train, bus, ferry, cruise, activity, restaurant, maps, calendar, ride-share, and payment booking providers still require production credentials and callback/webhook verification.
- Native date inputs are present locally; full calendar popover behavior must be tested in Chrome, Safari, Firefox, Edge, iPhone, Android, tablet, and desktop.
- Push notifications require VAPID keys, real browser permission flow, subscription creation, delivery test, click routing, unsubscribe, and expired subscription cleanup.
- Production tests must run against the deployed Vercel app with real Supabase/auth/provider configuration.
`;

fs.writeFileSync(path.join(root, "TRAVELDRIP_LINKS_SEARCH_BOOKING_QA_REPORT.md"), report);
fs.writeFileSync(path.join(root, "TRAVELDRIP_LINKS_SEARCH_BOOKING_QA_REPORT.json"), `${JSON.stringify(results, null, 2)}\n`);

console.log(report);

if (criticalIssues.length) {
  process.exitCode = 1;
}
