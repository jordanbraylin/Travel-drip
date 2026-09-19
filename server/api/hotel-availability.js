import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  sanitizeText
} from "./_security.js";

const requestWindow = new Map();
const MAX_REQUESTS_PER_WINDOW = 12;
const WINDOW_MS = 60_000;

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

function isoDate(value, fallback = "") {
  const text = sanitizeText(value, fallback, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function cleanCityCode(value) {
  return sanitizeText(value, "TYO", 3).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

function cleanHotelId(value) {
  return sanitizeText(value, "", 24).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

function cleanAdults(value) {
  const adults = Math.round(Number(value || 1));
  return String(Math.min(Math.max(adults, 1), 9));
}

async function getAmadeusToken(baseUrl, clientId, clientSecret, signal) {
  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const error = new Error("Hotel provider authentication failed.");
    error.providerStatus = response.status;
    throw error;
  }
  return payload.access_token;
}

async function amadeusGet(baseUrl, token, path, signal) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal,
    headers: {
      Accept: "application/vnd.amadeus+json",
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Hotel provider request failed.");
    error.providerStatus = response.status;
    throw error;
  }
  return payload;
}

function mapOffer(item, cityCode, checkInDate, checkOutDate) {
  const hotel = item.hotel || {};
  const offer = Array.isArray(item.offers) ? item.offers[0] : null;
  if (!offer) return null;
  const cancellation = offer.policies?.cancellations?.[0];
  const address = hotel.address?.lines?.join(", ") || cityCode;
  return {
    id: hotel.hotelId || offer.id,
    title: hotel.name || "Hotel stay",
    location: address,
    cityCode,
    checkInDate,
    checkOutDate,
    room: offer.room?.description?.text || offer.room?.typeEstimated?.category || "Room details available",
    board: offer.boardType || "Room only",
    price: offer.price?.total || "Price unavailable",
    currency: offer.price?.currency || "USD",
    cancellation: cancellation?.description?.text || (cancellation ? "Cancellation policy available" : "Policy available from provider"),
    lastUpdated: new Date().toISOString(),
    live: true,
    estimated: false,
    source: "amadeus_hotel_search",
    sourceLabel: "Live Amadeus hotel availability",
    providerUrl: "https://developers.amadeus.com/"
  };
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }

  if (!allowRequest(request)) {
    response.status(429).json({ error: "Hotel availability rate limit reached. Try again in a minute." });
    return;
  }

  const { user } = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const body = getRequestBody(request);
  const cityCode = cleanCityCode(body.cityCode || body.destination);
  const checkInDate = isoDate(body.checkInDate, "2026-08-20");
  const checkOutDate = isoDate(body.checkOutDate, "2026-08-24");
  const adults = cleanAdults(body.adults);
  const hotelId = cleanHotelId(body.hotelId);
  const clientId = String(process.env.AMADEUS_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.AMADEUS_CLIENT_SECRET || "").trim();
  const baseUrl = String(process.env.AMADEUS_API_BASE_URL || "https://api.amadeus.com").trim().replace(/\/$/, "");

  if (!/^[A-Z]{3}$/.test(cityCode)) {
    response.status(400).json({ error: "Enter a three-letter IATA city code such as TYO or MIA.", code: "invalid_city_code" });
    return;
  }
  if (checkInDate >= checkOutDate) {
    response.status(400).json({ error: "Check-out must be after check-in.", code: "invalid_date_range" });
    return;
  }
  if (!clientId || !clientSecret) {
    response.status(503).json({
      error: "Live hotel availability is not configured.",
      code: "provider_not_configured",
      provider: "amadeus"
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const token = await getAmadeusToken(baseUrl, clientId, clientSecret, controller.signal);
    let hotelIds = hotelId ? [hotelId] : [];
    if (!hotelIds.length) {
      const hotelList = await amadeusGet(
        baseUrl,
        token,
        `/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(cityCode)}&radius=20&radiusUnit=KM&hotelSource=ALL`,
        controller.signal
      );
      hotelIds = (hotelList.data || []).map((hotel) => hotel.hotelId).filter(Boolean).slice(0, 5);
    }
    if (!hotelIds.length) {
      response.status(404).json({ error: "No hotels were found for that destination.", code: "hotel_not_found", provider: "amadeus" });
      return;
    }

    const offerPayloads = await Promise.allSettled(hotelIds.map((id) => amadeusGet(
      baseUrl,
      token,
      `/v3/shopping/hotel-offers?hotelIds=${encodeURIComponent(id)}&adults=${adults}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&roomQuantity=1`,
      controller.signal
    )));
    const results = offerPayloads
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value.data || [])
      .map((item) => mapOffer(item, cityCode, checkInDate, checkOutDate))
      .filter(Boolean)
      .slice(0, 8);

    response.status(200).json({
      provider: "amadeus",
      sourceLabel: "Live Amadeus hotel availability",
      query: { cityCode, checkInDate, checkOutDate, adults, hotelId: hotelId || null },
      results
    });
  } catch (error) {
    response.status(error.name === "AbortError" ? 504 : error.providerStatus === 429 ? 429 : 502).json({
      error: error.name === "AbortError" ? "Live hotel availability timed out. Try again." : error.message || "Hotel provider unavailable.",
      code: error.name === "AbortError" ? "provider_timeout" : "provider_error",
      provider: "amadeus"
    });
  } finally {
    clearTimeout(timeout);
  }
}
