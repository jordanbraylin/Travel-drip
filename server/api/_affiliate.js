// Adds partner tracking parameters to outbound booking links.
// Configure with AFFILIATE_LINKS, a JSON object mapping a hostname to query parameters, for example:
//   AFFILIATE_LINKS={"booking.com":{"aid":"YOUR_ID"},"viator.com":{"pid":"YOUR_PID","mcid":"42383"}}
// Only hostnames listed there are changed. With nothing configured, links pass through untouched.
let cached;

function loadRules() {
  const raw = process.env.AFFILIATE_LINKS || "";
  if (cached?.raw === raw) return cached.rules;
  let rules = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [host, params] of Object.entries(parsed)) {
        if (!params || typeof params !== "object" || Array.isArray(params)) continue;
        const clean = Object.fromEntries(
          Object.entries(params).filter(([key, value]) => /^[\w.-]{1,40}$/.test(key) && /^[\w.\-:]{1,80}$/.test(String(value)))
        );
        if (Object.keys(clean).length) rules[host.toLowerCase().replace(/^www\./, "")] = clean;
      }
    }
  } catch {
    rules = {};
  }
  cached = { raw, rules };
  return rules;
}

export function withAffiliate(rawUrl) {
  try {
    const rules = loadRules();
    if (!rawUrl || !Object.keys(rules).length) return { url: rawUrl, affiliate: false };
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return { url: rawUrl, affiliate: false };
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const match = Object.keys(rules).find((key) => host === key || host.endsWith(`.${key}`));
    if (!match) return { url: rawUrl, affiliate: false };
    for (const [key, value] of Object.entries(rules[match])) url.searchParams.set(key, String(value));
    return { url: url.toString(), affiliate: true };
  } catch {
    return { url: rawUrl, affiliate: false };
  }
}

export const AFFILIATE_DISCLOSURE =
  "Some booking links may earn Travel-Drip a commission at no extra cost to you.";
