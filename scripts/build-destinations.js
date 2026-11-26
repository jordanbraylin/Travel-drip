import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { destinations } from "./destinations-data.js";

export const SITE_URL = "https://www.travel-drip.com";

const esc = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const styles = `
  :root{--ink:#0b2a3a;--muted:#4a6472;--brand:#0096c7;--bg:#f6fbfd;--card:#fff;--line:#d7e7ee}
  *{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
  header,main,footer{max-width:860px;margin:0 auto;padding:16px}
  header{display:flex;justify-content:space-between;align-items:center}
  header a.brand{font-weight:800;color:var(--ink);text-decoration:none;font-size:20px}
  a{color:#00698f}h1{font-size:clamp(28px,6vw,42px);line-height:1.15;margin:.4em 0 .2em}
  h2{margin-top:1.6em}.lead{font-size:18px;color:var(--muted)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0}
  .cta{display:inline-block;background:var(--brand);color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;margin:8px 8px 8px 0}
  .cta.alt{background:#fff;color:#00698f;border:1px solid var(--brand)}
  ul{padding-left:20px}li{margin:6px 0}footer{color:var(--muted);font-size:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
  .grid a{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-decoration:none;color:var(--ink)}
  .grid small{display:block;color:var(--muted)}
  :focus-visible{outline:3px solid #ffbf47;outline-offset:2px}
`;

function shell({ title, description, path, jsonld, body }) {
  const url = `${SITE_URL}${path}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Travel-Drip">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE_URL}/icons/app-icon-1024.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0096c7">
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <style>${styles}</style>
</head>
<body>
  <header><a class="brand" href="/">Travel-Drip</a><nav aria-label="Primary"><a href="/destinations/">Destinations</a> · <a href="/register">Sign up</a></nav></header>
  <main>${body}</main>
  <footer>
    <p>Travel-Drip: Good Trips. Better People. · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
    <p>Guides are general planning information. Check current entry rules, prices and opening hours with official sources before you travel.</p>
  </footer>
</body>
</html>
`;
}

function destinationPage(d) {
  const path = `/destinations/${d.slug}/`;
  const others = destinations.filter((o) => o.slug !== d.slug).slice(0, 4);
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristDestination",
        name: d.name,
        description: d.why,
        url: `${SITE_URL}${path}`,
        containedInPlace: { "@type": "Country", name: d.country },
        touristType: ["Friends", "Couples", "Families", "Group travel"]
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Travel-Drip", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Destinations", item: `${SITE_URL}/destinations/` },
          { "@type": "ListItem", position: 3, name: d.name, item: `${SITE_URL}${path}` }
        ]
      },
      {
        "@type": "FAQPage",
        mainEntity: d.faqs.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a }
        }))
      }
    ]
  };
  const body = `
  <nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/destinations/">Destinations</a> › ${esc(d.name)}</nav>
  <h1>${esc(d.name)} travel guide: itinerary, best time and group tips</h1>
  <p class="lead">${esc(d.tagline)}</p>
  <p><a class="cta" href="/register?destination=${esc(d.slug)}">Plan a ${esc(d.name)} trip</a><a class="cta alt" href="/">Open Travel-Drip</a></p>
  <section class="card"><h2>Why go to ${esc(d.name)}</h2><p>${esc(d.why)}</p></section>
  <section class="card"><h2>Best time to visit ${esc(d.name)}</h2><p>${esc(d.bestTime)}</p></section>
  <section><h2>Top things to do</h2><ul>${d.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></section>
  <section><h2>Sample 3-day ${esc(d.name)} itinerary</h2>
    <ul>${d.itinerary.map(([day, text]) => `<li><strong>${esc(day)}:</strong> ${esc(text)}</li>`).join("")}</ul>
    <p>Copy this plan into a Travel-Drip trip, change it with your group, and vote on the options.</p>
  </section>
  <section class="card"><h2>Group trip tips</h2><p>${esc(d.groupTips)}</p></section>
  <section><h2>Frequently asked questions</h2>${d.faqs
    .map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`)
    .join("")}</section>
  <section><h2>More destinations</h2><div class="grid">${others
    .map((o) => `<a href="/destinations/${o.slug}/"><strong>${esc(o.name)}</strong><small>${esc(o.country)}</small></a>`)
    .join("")}</div></section>`;
  return shell({
    title: `${d.name} Travel Guide: 3-Day Itinerary & Best Time to Visit | Travel-Drip`,
    description: `${d.name}, ${d.country}: best time to visit, top things to do, a sample 3-day itinerary and group trip tips. Plan it with friends on Travel-Drip.`,
    path,
    jsonld,
    body
  });
}

function hubPage() {
  const path = "/destinations/";
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Travel-Drip destination guides",
    url: `${SITE_URL}${path}`,
    hasPart: destinations.map((d) => ({ "@type": "WebPage", name: `${d.name} travel guide`, url: `${SITE_URL}/destinations/${d.slug}/` }))
  };
  const body = `
  <h1>Destination guides for group trips</h1>
  <p class="lead">Pick a place, copy a sample itinerary, and invite your friends to plan it together.</p>
  <div class="grid">${destinations
    .map((d) => `<a href="/destinations/${d.slug}/"><strong>${esc(d.name)}</strong><small>${esc(d.country)}</small><small>${esc(d.tagline)}</small></a>`)
    .join("")}</div>
  <p><a class="cta" href="/register">Start planning free</a></p>`;
  return shell({
    title: "Destination Guides for Group Trips | Travel-Drip",
    description: "Browse Travel-Drip destination guides with best times to visit, top things to do and sample itineraries you can copy into a group trip.",
    path,
    jsonld,
    body
  });
}

export async function buildDestinationPages(outputDir) {
  const urls = ["/destinations/"];
  await mkdir(resolve(outputDir, "destinations"), { recursive: true });
  await writeFile(resolve(outputDir, "destinations", "index.html"), hubPage());
  for (const d of destinations) {
    const dir = resolve(outputDir, "destinations", d.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, "index.html"), destinationPage(d));
    urls.push(`/destinations/${d.slug}/`);
  }
  return urls;
}

export function buildSitemap(paths) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = ["/", ...paths, "/privacy.html", "/terms.html"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
}
