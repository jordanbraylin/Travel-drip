import { applySecurityHeaders, getRequestBody, methodNotAllowed, sanitizeText } from "./_security.js";

const locations = new Map();
const forecasts = new Map();
const requests = new Map();
const pending = new Map();
const userAgent = "Travel-Drip/1.0 (https://travel-drip.com)";

function remember(cache, key, value) {
  if (cache.size >= 500) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

async function providerJson(url, headers = {}) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": userAgent, ...headers }, signal: AbortSignal.timeout(10000) });
  if (response.status === 304) return { response, data: null };
  if (!response.ok) throw new Error("Weather service is temporarily unavailable. Please try again.");
  return { response, data: await response.json() };
}

function weatherFromData(data) {
  const series = data.properties?.timeseries || [];
  const point = [...series].reverse().find((item) => new Date(item.time).getTime() <= Date.now()) || series[0];
  const details = point?.data?.instant?.details;
  if (!Number.isFinite(details?.air_temperature) || Math.abs(Date.now() - new Date(point.time).getTime()) > 3 * 3600000) throw new Error("Current weather is unavailable. Please try again later.");
  return {
    provider: "MET Norway", live: true, kind: "current_forecast",
    temperatureC: details.air_temperature,
    windSpeedMps: details.wind_speed ?? null,
    condition: point.data.next_1_hours?.summary?.symbol_code || point.data.next_6_hours?.summary?.symbol_code || "",
    validAt: point.time, updatedAt: data.properties.meta.updated_at, fetchedAt: new Date().toISOString()
  };
}

export async function getCurrentWeather(body) {
  const destination = sanitizeText(body.destination, "", 160);
  const hasCoordinates = body.latitude !== undefined || body.longitude !== undefined;
  let latitude = Number(body.latitude);
  let longitude = Number(body.longitude);
  let location = "Your approximate location";
  if (hasCoordinates) {
    if (body.latitude === null || body.longitude === null || body.latitude === "" || body.longitude === "" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw Object.assign(new Error("Valid latitude and longitude are required."), { status: 400 });
    }
  } else {
    if (destination.length < 2) throw Object.assign(new Error("Add a trip destination or choose Use my location."), { status: 400 });
    const key = destination.toLowerCase();
    let match = locations.get(key);
    if (!match || match.expires < Date.now()) {
      const endpoint = new URL(process.env.WEATHER_GEOCODING_URL || "https://photon.komoot.io/api/");
      endpoint.search = new URLSearchParams({ q: destination, limit: "3", lang: "en" }).toString();
      const { data } = await providerJson(endpoint);
      const features = data.features || [];
      const feature = features.find((item) => ["city", "town", "village", "municipality"].includes(item.properties?.osm_value)) || features[0];
      if (!feature?.geometry?.coordinates) throw Object.assign(new Error("Destination not found. Add a city and country to your trip."), { status: 404 });
      const [lon, lat] = feature.geometry.coordinates;
      const properties = feature.properties || {};
      match = { latitude: lat, longitude: lon, location: [properties.name, properties.state, properties.country].filter(Boolean).join(", "), expires: Date.now() + 86400000 };
      remember(locations, key, match);
    }
    ({ latitude, longitude, location } = match);
  }
  // Approximate coordinates are sufficient; do not retain a person's precise position.
  latitude = Number(Number(latitude).toFixed(2));
  longitude = Number(Number(longitude).toFixed(2));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Weather location could not be resolved.");
  const key = `${latitude},${longitude}`;
  const cached = forecasts.get(key);
  if (cached && cached.expires > Date.now()) return { ...weatherFromData(cached.source), location };
  if (pending.has(key)) return { ...await pending.get(key), location };
  const task = (async () => {
    const endpoint = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
    endpoint.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude) }).toString();
    const { data, response } = await providerJson(endpoint, cached?.lastModified ? { "If-Modified-Since": cached.lastModified } : {});
    if (response.status === 304 && cached) {
      remember(forecasts, key, { ...cached, expires: Math.max(Date.now() + 60000, Date.parse(response.headers.get("expires")) || Date.now() + 900000) });
      return weatherFromData(cached.source);
    }
    const weather = weatherFromData(data);
    const expires = Math.max(Date.now() + 60000, Date.parse(response.headers.get("expires")) || Date.now() + 900000);
    remember(forecasts, key, { weather, source: data, expires, lastModified: response.headers.get("last-modified") });
    return weather;
  })();
  pending.set(key, task);
  try { return { ...await task, location }; }
  finally { pending.delete(key); }
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") return methodNotAllowed(response, "POST");
  const ip = String(request.headers["x-forwarded-for"] || "unknown").split(",")[0];
  const entry = requests.get(ip);
  if (entry && entry.until > Date.now() && entry.count >= 30) return response.status(429).json({ error: "Too many weather requests. Please wait a minute." });
  remember(requests, ip, entry?.until > Date.now() ? { ...entry, count: entry.count + 1 } : { count: 1, until: Date.now() + 60000 });
  try { response.status(200).json(await getCurrentWeather(getRequestBody(request))); }
  catch (error) { response.status(error.status || 502).json({ error: error.message || "Weather is temporarily unavailable." }); }
}
