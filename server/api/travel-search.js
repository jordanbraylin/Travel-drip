import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  sanitizeText
} from "./_security.js";
import aiPlanner from "./ai-planner.js";
import { searchTravelGuides } from "./_travel-guides.js";

const googlePlacesUrl = "https://places.googleapis.com/v1/places:searchText";
const requestWindow = new Map();
const MAX_REQUESTS_PER_WINDOW = 20;
const WINDOW_MS = 60_000;

const categoryQueries = {
  trending: "popular travel experiences",
  food: "restaurants and dining",
  nightlife: "nightlife and live music",
  under900: "budget-friendly travel activities",
  activities: "things to do and activities",
  hidden_gems: "hidden gems and local favorites",
  beaches: "beaches and beach activities",
  shopping: "shopping and local markets",
  outdoor: "outdoor adventures",
  family: "family-friendly activities",
  luxury: "luxury travel experiences",
  events: "local events and festivals",
  weekend: "weekend getaway attractions",
  hotels: "hotels and places to stay",
  transport: "transportation, private drivers, and airport transfers",
  rideshare: "rideshare services, taxis, and airport rides",
  flights: "airports",
  trains: "railway stations",
  shuttle: "public transport",
  trips: "tourist attractions and travel destinations"
};

function getClientKey(request) {
  const forwarded = request.headers["x-forwarded-for"] || request.headers["x-real-ip"] || "unknown";
  return String(forwarded).split(",")[0].trim().slice(0, 80) || "unknown";
}

function allowRequest(request) {
  const now = Date.now();
  const key = getClientKey(request);
  const current = requestWindow.get(key) || { startedAt: now, count: 0 };
  if (now - current.startedAt > WINDOW_MS) {
    requestWindow.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  requestWindow.set(key, current);
  return current.count <= MAX_REQUESTS_PER_WINDOW;
}

function normalizeCategory(value) {
  const category = sanitizeText(value, "trending", 60).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (category === "hidden") return "hidden_gems";
  return categoryQueries[category] ? category : "trending";
}

function getPriceLabel(priceLevel) {
  return {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$"
  }[priceLevel] || "Price varies";
}

function mapPlace(place, category, destination) {
  const title = place.displayName?.text || "Travel place";
  const location = place.formattedAddress || destination || "Location available from provider";
  const mapsUrl = place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title}, ${location}`)}`;
  const typeLabel = (place.primaryTypeDisplayName?.text || place.types?.[0] || categoryQueries[category])
    .replaceAll("_", " ");
  const openStatus = place.currentOpeningHours?.openNow === true
    ? "Open now"
    : place.currentOpeningHours?.openNow === false
      ? "Closed now"
      : "Hours vary";

  return {
    id: `google-${place.id || encodeURIComponent(title).slice(0, 80)}`,
    category,
    title,
    type: typeLabel,
    location,
    price: getPriceLabel(place.priceLevel),
    priceCents: null,
    rating: Number(place.rating || 0),
    distance: null,
    status: openStatus,
    description: `${typeLabel} result from Google Places for ${destination || "your selected destination"}. Verify availability, pricing, and policies with the provider before booking.`,
    details: [
      `Source: Google Places`,
      place.userRatingCount ? `${place.userRatingCount.toLocaleString()} provider ratings` : "Provider ratings available",
      place.websiteUri ? "Official website available" : "Open map details for provider information"
    ],
    image: "",
    live: true,
    estimated: false,
    source: "google_places",
    sourceLabel: "Google Places",
    providerUrl: place.websiteUri || mapsUrl,
    actions: {
      details: mapsUrl,
      directions: mapsUrl,
      website: place.websiteUri || mapsUrl,
      book: place.websiteUri || mapsUrl
    }
  };
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!["GET", "POST"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST");
    return;
  }

  if (!allowRequest(request)) {
    response.status(429).json({ error: "Search rate limit reached. Try again in a minute." });
    return;
  }

  const body = request.method === "GET" ? request.query || {} : getRequestBody(request);
  const category = normalizeCategory(body.category);
  const destination = sanitizeText(body.destination, "", 160);
  const query = sanitizeText(body.q || body.query, "", 180);
  const provider = sanitizeText(body.provider, "duckduckgo", 32);
  if (provider === "in_app") {
    try { response.status(200).json(await searchTravelGuides({ query, destination, category })); }
    catch (error) { response.status(error.status || 502).json({ error: error.message || "Travel guides are unavailable." }); }
    return;
  }
  if (provider === "live" && !query && !destination) {
    response.status(400).json({ error: "Enter a destination or search term.", code: "missing_query" });
    return;
  }
  if (provider === "live" && ["flights", "trains", "rideshare", "shuttle"].includes(category)) {
    response.status(503).json({ error: "Live fares, ride quotes, and departure times are not connected yet. Browse destination guides for reference information instead.", code: "live_transport_not_connected", provider: "live" });
    return;
  }
  if (request.method === "GET" || provider === "duckduckgo") {
    const textQuery = [query || categoryQueries[category], destination].filter(Boolean).join(" in ");
    const searchUrl = new URL("https://duckduckgo.com/");
    searchUrl.searchParams.set("q", textQuery);
    if (request.method === "GET") {
      response.setHeader("Location", searchUrl.href);
      response.status(302).end();
      return;
    }
    response.status(200).json({
      provider: "duckduckgo",
      sourceLabel: "DuckDuckGo free web search",
      searchMode: "external_results",
      free: true,
      live: false,
      query: textQuery,
      searchUrl: searchUrl.href,
      results: []
    });
    return;
  }
  if (provider === "openai") {
    await aiPlanner({
      method: "POST",
      headers: request.headers,
      body: {
        query: `Search current web sources for ${query || categoryQueries[category]}${destination ? ` in ${destination}` : ""}. Give concise practical guidance with citations. Do not claim a booking, current room inventory, or live flight status has been confirmed.`,
        answers: { destination, interests: categoryQueries[category] }
      }
    }, response);
    return;
  }
  if (!["google_places", "live"].includes(provider)) {
    response.status(400).json({ error: "Unsupported search provider.", code: "invalid_provider" });
    return;
  }
  const maxResults = Math.min(Math.max(Number(body.limit || 8), 1), 12);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

  if (!apiKey) {
    response.status(503).json({
      error: "Live places search is not connected yet. The site owner must connect Google Places. Destination guides remain available separately.",
      code: "provider_not_configured",
      provider: "google_places"
    });
    return;
  }

  const textQuery = [query || categoryQueries[category], destination].filter(Boolean).join(" in ");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const upstream = await fetch(googlePlacesUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.types",
          "places.primaryTypeDisplayName",
          "places.websiteUri",
          "places.googleMapsUri",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.currentOpeningHours.openNow"
        ].join(",")
      },
      body: JSON.stringify({
        textQuery,
        pageSize: maxResults,
        languageCode: "en"
      })
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      response.status(upstream.status === 429 ? 429 : 502).json({
        error: "The live travel provider could not complete the search.",
        code: "provider_error",
        provider: "google_places",
        providerStatus: upstream.status
      });
      return;
    }

    response.status(200).json({
      provider: "google_places",
      sourceLabel: "Live Google Places results",
      live: true,
      liveAvailability: false,
      searchMode: "live_places",
      fetchedAt: new Date().toISOString(),
      query: textQuery,
      category,
      destination: destination || null,
      results: (payload.places || []).map((place) => mapPlace(place, category, destination))
    });
  } catch (error) {
    response.status(error.name === "AbortError" ? 504 : 502).json({
      error: "Live travel search timed out. Try again.",
      code: error.name === "AbortError" ? "provider_timeout" : "provider_unreachable",
      provider: "google_places"
    });
  } finally {
    clearTimeout(timeout);
  }
}
