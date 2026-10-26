let weatherContext = null;
let weatherResult = null;
let weatherMessage = "Add a trip destination or choose Use my location.";
let weatherTripId = "";
let weatherRequest = 0;

function weatherMarkup() {
  return '<h3>Weather now</h3><div class="current-weather-output" aria-live="polite"></div><div class="button-row"><button type="button" data-weather-action="destination">Trip destination</button><button type="button" data-weather-action="location">Use my location</button><button type="button" data-weather-action="refresh">Refresh</button></div><small>Current forecast: <a href="https://www.met.no/en/free-meteorological-data" target="_blank" rel="noopener noreferrer">MET Norway</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>). Place names: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</small>';
}

function renderCurrentWeather() {
  let unit = "F";
  try { unit = localStorage.getItem("traveldripWeatherUnit") || "F"; } catch (_error) { /* Use Fahrenheit. */ }
  document.querySelectorAll(".current-weather-output").forEach((output) => {
    output.replaceChildren();
    if (weatherResult) {
      const location = document.createElement("strong");
      location.textContent = weatherResult.location;
      const temperature = document.createElement("p");
      const value = unit === "C" ? weatherResult.temperatureC : weatherResult.temperatureC * 9 / 5 + 32;
      const symbol = (weatherResult.condition || "").replace(/_(day|night|polartwilight)$/, "");
      const descriptions = { clearsky: "Clear skies", fair: "Mostly clear", partlycloudy: "Partly cloudy", cloudy: "Cloudy", fog: "Fog", lightrain: "Light rain", rain: "Rain", heavyrain: "Heavy rain", lightrainshowers: "Light rain showers", rainshowers: "Rain showers", heavyrainshowers: "Heavy rain showers", lightsnow: "Light snow", snow: "Snow", heavysnow: "Heavy snow", sleet: "Sleet", snowshowers: "Snow showers", rainandthunder: "Rain and thunderstorms" };
      const condition = descriptions[symbol] || "";
      temperature.textContent = `${Math.round(value)}°${unit}${condition ? ` - ${condition}` : ""}`;
      const time = document.createElement("small");
      time.textContent = `Forecast for ${new Date(weatherResult.validAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Updated ${new Date(weatherResult.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
      output.append(location, temperature, time);
    }
    if (weatherMessage) {
      const status = document.createElement("p");
      status.textContent = weatherMessage;
      output.append(status);
    }
  });
}

function clearTripWeather() {
  weatherRequest++;
  weatherContext = null;
  weatherResult = null;
  weatherTripId = "";
  weatherMessage = "Add a trip destination or choose Use my location.";
  renderCurrentWeather();
}

async function refreshCurrentWeather() {
  if (!weatherContext) { renderCurrentWeather(); return; }
  const request = ++weatherRequest;
  const userId = state.session?.user?.id;
  weatherMessage = "Updating weather...";
  renderCurrentWeather();
  try {
    const result = await liveSearchApiRequest("/api/weather", { method: "POST", body: JSON.stringify(weatherContext) });
    if (request !== weatherRequest || state.session?.user?.id !== userId) return;
    if (!result.live || !Number.isFinite(result.temperatureC)) throw new Error("Current weather is unavailable.");
    weatherResult = result;
    weatherMessage = "";
  } catch (error) {
    if (request !== weatherRequest) return;
    weatherMessage = weatherResult ? "Could not refresh. Showing the previously loaded forecast." : error.message;
  }
  renderCurrentWeather();
}

function refreshTripWeather(force = false) {
  const trip = state.accountData.activeTrip;
  const changed = weatherTripId !== (trip?.id || "");
  if (changed || force || !weatherContext) {
    weatherRequest++;
    weatherTripId = trip?.id || "";
    weatherResult = null;
    weatherContext = trip?.destination ? { destination: trip.destination } : null;
    weatherMessage = weatherContext ? "Updating weather..." : "Add a trip destination or choose Use my location.";
    refreshCurrentWeather();
  }
}

function showTravelWeather(section) {
  const root = getRouteComponentById("rideShareHub");
  if (!root) return;
  let view = root.querySelector("#travelCurrentWeather");
  if (!view) {
    view = document.createElement("section");
    view.id = "travelCurrentWeather";
    view.className = "current-weather-view";
    view.innerHTML = weatherMarkup();
    root.append(view);
  }
  setVisibilityWithoutCssLeaks(view, section === "weather");
  if (section === "weather") {
    renderCurrentWeather();
    refreshTripWeather();
    view.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function initializeLiveWeather() {
  const widget = document.querySelector('[data-widget="weather"]');
  if (!widget) return;
  widget.innerHTML = weatherMarkup();
  const units = document.querySelector('select[aria-label="Weather units"]');
  if (units) {
    try { units.value = localStorage.getItem("traveldripWeatherUnit") === "C" ? "Celsius" : "Fahrenheit"; } catch (_error) { /* Keep the default. */ }
    units.addEventListener("change", () => {
      try { localStorage.setItem("traveldripWeatherUnit", units.value === "Celsius" ? "C" : "F"); } catch (_error) { /* Keep weather visible if storage is unavailable. */ }
      renderCurrentWeather();
    });
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-weather-action]");
    if (!button) return;
    if (button.dataset.weatherAction === "destination") { refreshTripWeather(true); return; }
    if (button.dataset.weatherAction === "refresh") { refreshCurrentWeather(); return; }
    if (!navigator.geolocation) { weatherMessage = "Location is unavailable in this browser. Use a trip destination instead."; renderCurrentWeather(); return; }
    weatherMessage = "Waiting for location permission...";
    renderCurrentWeather();
    const userId = state.session?.user?.id;
    navigator.geolocation.getCurrentPosition((position) => {
      if (state.session?.user?.id !== userId) return;
      weatherContext = { latitude: Number(position.coords.latitude.toFixed(2)), longitude: Number(position.coords.longitude.toFixed(2)) };
      weatherResult = null;
      refreshCurrentWeather();
    }, () => { weatherMessage = "Location was not available. You can still use your trip destination."; renderCurrentWeather(); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && state.session?.user && ["dashboardHome", "rideShareHub"].includes(document.body.dataset.activeRoute)) refreshCurrentWeather();
  }, 15 * 60 * 1000 + Math.floor(Math.random() * 30000));
  renderCurrentWeather();
}
