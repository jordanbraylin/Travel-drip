const cache = new Map();

export async function searchTravelGuides({ query = "", destination = "", category = "trending" }) {
  const terms = { rideshare: "taxi transport", flights: "airport", trains: "railway station", shuttle: "public transport", transport: "public transport", food: "cuisine", activities: "tourist attractions", trending: "travel" };
  const search = [destination, query || terms[category] || category.replaceAll("_", " ")].filter(Boolean).join(" ").trim().slice(0, 300);
  if (!search || (!query && !destination)) throw Object.assign(new Error("Enter a destination or something you'd like to find."), { status: 400 });
  const saved = cache.get(search);
  if (saved?.until > Date.now()) return saved.value;
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", generator: "search", gsrsearch: search, gsrlimit: "6", prop: "extracts", exintro: "1", explaintext: "1", exsentences: "5", format: "json" }).toString();
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Travel-Drip/1.0 (https://travel-drip.com)" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Destination guides are temporarily unavailable. Please try again.");
  const data = await response.json();
  if (data.error) throw new Error("Destination guides could not be searched. Try a different place.");
  const results = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index).filter((page) => {
    if (!page.title || !page.extract || /may refer to:/i.test(page.extract)) return false;
    if (["flights", "rideshare", "trains", "shuttle", "transport"].includes(category) && /\b(defunct|former|ceased|discontinued|historic|historical)\b|\b(?:18|19)\d{2}\s*[–-]\s*(?:18|19)\d{2}\b/i.test(`${page.title} ${page.extract.split(".")[0]}`)) return false;
    if (category === "flights") return /airport|aerodrome|airfield|terminal/i.test(page.title);
    if (category === "trains") return /rail|station|metro|transit/i.test(`${page.title} ${page.extract.split(".")[0]}`);
    return true;
  }).map((page) => ({ id: String(page.pageid), title: page.title, description: String(page.extract).slice(0, 1800), sourceUrl: `https://en.wikipedia.org/?curid=${Number(page.pageid)}`, sourceLabel: "Wikipedia contributors", kind: "reference_guide" }));
  const value = { provider: "in_app", sourceLabel: "Wikipedia destination guides", searchMode: "in_app_guides", liveAvailability: false, fetchedAt: new Date().toISOString(), query: search, results };
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(search, { value, until: Date.now() + 600000 });
  return value;
}
