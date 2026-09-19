import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  sanitizeText
} from "./_security.js";

const aeroApiUrl = "https://aeroapi.flightaware.com/aeroapi";
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

function cleanIdent(value) {
  return sanitizeText(value, "", 40).replace(/[^a-z0-9@*? -]/gi, "").trim();
}

function toIsoDate(value) {
  const text = sanitizeText(value, "", 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function timestamp(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric * 1000).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function airportLabel(airport) {
  if (!airport) return null;
  if (typeof airport === "string") return airport;
  return airport.code_iata || airport.code || airport.name || null;
}

function matchesFlight(flight, { date, origin }) {
  const flightOrigin = airportLabel(flight.origin);
  const originMatches = !origin || String(flightOrigin || "").toLowerCase() === origin.toLowerCase();
  if (!originMatches) return false;
  if (!date) return true;
  const scheduled = timestamp(flight.scheduled_out);
  return scheduled ? scheduled.slice(0, 10) === date : true;
}

function normalizeFlight(flight) {
  const origin = airportLabel(flight.origin) || "Origin unavailable";
  const destination = airportLabel(flight.destination) || "Destination unavailable";
  const scheduledOut = timestamp(flight.scheduled_out);
  const estimatedOut = timestamp(flight.estimated_out);
  const actualOut = timestamp(flight.actual_out);
  const scheduledIn = timestamp(flight.scheduled_in);
  const estimatedIn = timestamp(flight.estimated_in);
  const actualIn = timestamp(flight.actual_in);
  return {
    id: flight.fa_flight_id || flight.ident,
    ident: flight.ident || flight.ident_iata || "Flight",
    operator: flight.operator || flight.operator_iata || "Airline unavailable",
    origin,
    destination,
    status: flight.status || "Status unavailable",
    scheduledOut,
    estimatedOut,
    actualOut,
    scheduledIn,
    estimatedIn,
    actualIn,
    gateOrigin: flight.gate_origin || null,
    gateDestination: flight.gate_destination || null,
    terminalOrigin: flight.terminal_origin || null,
    terminalDestination: flight.terminal_destination || null,
    progressPercent: Number.isFinite(Number(flight.progress_percent)) ? Number(flight.progress_percent) : null,
    aircraftType: flight.aircraft_type || null,
    lastPosition: flight.last_position || null,
    trackingUrl: flight.fa_flight_id
      ? `https://www.flightaware.com/live/flight/id/${encodeURIComponent(flight.fa_flight_id)}`
      : null
  };
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }

  if (!allowRequest(request)) {
    response.status(429).json({ error: "Flight tracking rate limit reached. Try again in a minute." });
    return;
  }

  const { user } = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const body = getRequestBody(request);
  const ident = cleanIdent(body.ident || body.flightNumber || body.flight);
  const date = toIsoDate(body.date || body.departureDate);
  const origin = cleanIdent(body.origin).toUpperCase();
  const apiKey = String(process.env.FLIGHTAWARE_API_KEY || process.env.FLIGHT_TRACKING_API_KEY || "").trim();

  if (!ident) {
    response.status(400).json({ error: "Enter a flight number such as DL241 or AAL100.", code: "missing_flight_ident" });
    return;
  }
  if (!apiKey) {
    response.status(503).json({
      error: "Live flight tracking is not configured.",
      code: "provider_not_configured",
      provider: "flightaware_aeroapi"
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const upstream = await fetch(`${aeroApiUrl}/flights/${encodeURIComponent(ident)}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "x-apikey": apiKey
      }
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      response.status(upstream.status === 429 ? 429 : 502).json({
        error: "The live flight provider could not complete the lookup.",
        code: "provider_error",
        provider: "flightaware_aeroapi",
        providerStatus: upstream.status
      });
      return;
    }

    const flights = Array.isArray(payload.flights) ? payload.flights : [];
    const flight = flights.find((candidate) => matchesFlight(candidate, { date, origin })) || flights[0];
    if (!flight) {
      response.status(404).json({
        error: "No matching flight was found. Check the flight number, date, and origin.",
        code: "flight_not_found",
        provider: "flightaware_aeroapi"
      });
      return;
    }

    response.status(200).json({
      provider: "flightaware_aeroapi",
      sourceLabel: "Live FlightAware status",
      query: { ident, date: date || null, origin: origin || null },
      flight: normalizeFlight(flight)
    });
  } catch (error) {
    response.status(error.name === "AbortError" ? 504 : 502).json({
      error: "Live flight tracking timed out. Try again.",
      code: error.name === "AbortError" ? "provider_timeout" : "provider_unreachable",
      provider: "flightaware_aeroapi"
    });
  } finally {
    clearTimeout(timeout);
  }
}
