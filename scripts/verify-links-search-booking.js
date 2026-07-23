import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("index.html");
const app = read("app.js");
const pkg = JSON.parse(read("package.json"));

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
const routeBlock = app.match(/const routeDefinitions = \{([\s\S]*?)\n\};/)?.[1] || "";
const routeTargets = unique(matchAll(routeBlock, /^\s{2}([A-Za-z0-9_]+):\s*\{\s*path:/gm));
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
unique(targetButtons).forEach((target) => {
  if (!sectionExists(target)) targetIssues.push(`Missing screen section for data-target="${target}"`);
  if (!routeTargets.includes(target)) targetIssues.push(`Missing routeDefinition for data-target="${target}"`);
});

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
const report = `# TravelDrip Links, Search, Date Picker, Booking, and Real-Time Updates Verification

Generated: ${results.generatedAt}

## Final Status

**${finalStatus}**

This local verification checks static routes, link targets, search/date field wiring, provider labels, and API surface. It does **not** certify live provider search, booking callbacks, webhooks, real-time flight data, push delivery, or deployed browser/device behavior.

## Summary

- Total buttons inspected: ${buttonCount}
- Total links inspected: ${linkCount}
- Data-target controls inspected: ${targetButtons.length}
- Working local data-target routes: ${results.linkAndRouteVerification.workingLocalTargets}/${unique(targetButtons).length}
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

${targetIssues.length ? `### Target Issues\n${targetIssues.map((issue) => `- ${issue}`).join("\n")}` : "No missing local data-target sections or route definitions were detected."}

${ariaIssues.length ? `### ARIA Issues\n${ariaIssues.map((issue) => `- ${issue}`).join("\n")}` : "No missing aria-controls targets were detected."}

${linkIssues.length ? `### Link Issues\n${linkIssues.map((issue) => `- ${issue}`).join("\n")}` : "No placeholder or insecure href values were detected."}

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
