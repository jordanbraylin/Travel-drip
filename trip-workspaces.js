function tripWorkspacePhoto(trip) {
  const destination = String(trip?.destination || "").toLowerCase();
  const match = destination.length > 2 && livePlanDestinations.find((place) =>
    destination.includes(place.city.toLowerCase()) && place.city !== "Big Sur");
  return { src: match?.photo || "icons/planning-coast.jpg", alt: match?.alt || "Coastal travel inspiration", inspiration: !match };
}

function tripWorkspaceDates(trip) {
  const format = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
    return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };
  return [...new Set([format(trip?.starts_on), format(trip?.ends_on)].filter(Boolean))].join(" to ") || "Dates to dream about";
}

function workspaceButton(label, action, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "primary-button" : "ghost-button";
  button.textContent = label;
  button.dataset.workspaceAction = "";
  button.addEventListener("click", action);
  return button;
}

function workspaceHeading(title, copy) {
  const header = document.createElement("header");
  header.className = "trip-workspace-heading";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const description = document.createElement("p");
  description.textContent = copy;
  header.append(heading, description);
  return header;
}

function openWorkspacePlanning() { document.querySelector("#letsPlanButton")?.click(); }

function renderVisualTripList(container) {
  renderTripJoy(container);
}

function renderTripItinerary(section) {
  let workspace = section.querySelector(".trip-itinerary-workspace");
  if (!workspace) { workspace = document.createElement("div"); workspace.className = "trip-itinerary-workspace"; section.prepend(workspace); }
  const trip = state.session?.user ? state.accountData.activeTrip : null;
  workspace.replaceChildren();
  const banner = document.createElement("div");
  banner.className = "trip-plan-banner";
  const image = document.createElement("img");
  const photo = tripWorkspacePhoto(trip);
  image.src = photo.src;
  image.alt = photo.alt;
  image.onerror = () => { image.onerror = null; image.src = "icons/planning-coast.jpg"; };
  const copy = workspaceHeading(trip?.title || "Your next adventure", trip ? `${trip.destination || "Destination to come"} · ${tripWorkspaceDates(trip)}` : "A little inspiration. A plan that's completely yours.");
  copy.append(workspaceButton("Let's plan", openWorkspacePlanning, true));
  const credit = document.createElement("small"); credit.textContent = "Destination inspiration"; copy.append(credit);
  banner.append(image, copy);
  workspace.append(banner);
  const steps = document.createElement("div"); steps.className = "journey-planning-steps";
  for (const [name, value] of [["Destination", trip?.destination], ["Dates", trip?.starts_on && trip?.ends_on], ["Activities", state.accountData.records?.schedule_items?.length]]) {
    const step = document.createElement("span"); step.textContent = name; step.classList.toggle("complete", Boolean(value)); step.setAttribute("aria-label", `${name}: ${value ? "added" : "not added"}`); steps.append(step);
  }
  workspace.append(steps);
  if (!trip) { renderDetailedTripItinerary(workspace,null); return; }
  const actions = document.createElement("div"); actions.className = "trip-workspace-actions";
  actions.append(workspaceButton("Find something fun", () => navigateSafely("exploreDrops", { updateHistory: true })), workspaceButton("Invite people", openTripInviteDialog), workspaceButton("Trip funds", () => navigateSafely("walletPanel", { updateHistory: true })));
  workspace.append(actions);
  const selector = document.createElement("label");
  selector.textContent = "Trip";
  const picker = document.createElement("select");
  for (const saved of state.accountData.trips || []) {
    const option = document.createElement("option"); option.value = saved.id; option.textContent = saved.title || saved.destination || "Untitled trip"; option.selected = saved.id === trip.id; picker.append(option);
  }
  picker.addEventListener("change", async () => { picker.disabled = true; try { await selectAccountTrip(picker.value); } finally { picker.disabled = false; } });
  selector.append(picker); workspace.append(selector);
  renderTripTravelTools(workspace,trip);
  renderDetailedTripItinerary(workspace,trip);
  const manager = trip.owner_user_id === state.session?.user?.id || ["owner", "admin", "organizer", "team_lead"].includes(trip.myRole);
  if (!manager) return;
  const details = document.createElement("details"); details.className = "simple-disclosure";
  const summary = document.createElement("summary"); summary.textContent = "Add an activity";
  const form = document.createElement("form"); form.className = "trip-activity-form";
  form.innerHTML = '<label>Activity<input name="title" maxlength="160" required placeholder="What would you like to do?"></label><label>Date and time<input name="startsAt" type="datetime-local" required></label><label>Place<input name="locationName" maxlength="180" placeholder="Optional"></label><button class="primary-button" type="submit">Save activity</button><p role="status"></p>';
  const userId = state.session?.user?.id;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || state.session?.user?.id !== userId || state.accountData.activeTrip?.id !== trip.id) return;
    const button = form.querySelector("button"); const status = form.querySelector('[role="status"]');
    button.disabled = true; status.textContent = "Saving your activity...";
    try {
      const values = new FormData(form);
      const result = await apiRequest("/api/schedule", { method: "POST", body: JSON.stringify({ tripId: trip.id, title: values.get("title"), startsAt: new Date(values.get("startsAt")).toISOString(), locationName: values.get("locationName") }) });
      if (result.skipped || !result.scheduleItem?.id) throw new Error("Your activity wasn't saved. Please try again.");
      if (state.session?.user?.id !== userId || state.accountData.activeTrip?.id !== trip.id) return;
      await loadAccountData();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  details.append(summary, form); workspace.append(details);
}

function calculateWalletSplit(total, people) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(String(total)) || !Number.isInteger(people) || people < 1 || people > 50) throw new Error("Enter an amount with up to two decimal places and 1 to 50 people.");
  const [whole, fraction = ""] = String(total).split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0) throw new Error("Enter an amount greater than zero.");
  return Array.from({ length: people }, (_, index) => Math.floor(cents / people) + (index < cents % people ? 1 : 0));
}

function initializeWalletSplitter() {
  const panel = document.querySelector("#walletPanel");
  if (!panel || panel.querySelector("#walletInlineSplitter")) return;
  const balanceHero = panel.querySelector(".wallet-balance-hero");
  const photo = document.createElement("img"); photo.id = "walletDestinationPhoto";
  photo.src = "icons/planning-coast.jpg"; photo.alt = "Coastal travel inspiration";
  photo.onerror = () => { photo.onerror = null; photo.src = "icons/planning-coast.jpg"; };
  const credit = document.createElement("small"); credit.className = "wallet-photo-credit"; credit.textContent = "Destination inspiration";
  balanceHero.prepend(photo); balanceHero.append(credit);
  panel.querySelector(".wallet-redesign-shell").after(panel.querySelector(".wallet-smart-actions"));
  const splitter = document.createElement("section"); splitter.id = "walletInlineSplitter";
  splitter.setAttribute("aria-label", "Split a bill");
  splitter.innerHTML = '<h3>Split a bill</h3><form id="walletSplitForm"><label>Total bill<input name="total" type="number" min="0.01" max="9999999.99" step="0.01" inputmode="decimal" placeholder="0.00" required></label><label>People<input name="people" type="number" min="1" max="50" step="1" value="2" required></label><label>Currency<select name="currency"><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option></select></label><button class="primary-button" type="submit">Calculate split</button></form><p class="small">Calculation only. No money is moved or payment request sent.</p><div id="walletSplitResult" role="status" aria-live="polite"></div>';
  panel.querySelector(".wallet-smart-actions").after(splitter);
  const form = splitter.querySelector("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = splitter.querySelector("#walletSplitResult"); result.replaceChildren();
    try {
      const values = new FormData(form);
      const shares = calculateWalletSplit(values.get("total"), Number(values.get("people")));
      const format = (cents) => (cents / 100).toLocaleString(undefined, { style: "currency", currency: values.get("currency") });
      const heading = document.createElement("strong"); heading.textContent = `${format(shares.reduce((sum, value) => sum + value, 0))} split between ${shares.length}`; result.append(heading);
      shares.forEach((cents, index) => { const row = document.createElement("p"); row.textContent = `Person ${index + 1}: ${format(cents)}`; result.append(row); });
    } catch (error) { result.textContent = error.message; }
  });
  form.addEventListener("input", () => { splitter.querySelector("#walletSplitResult").replaceChildren(); });
  panel.querySelectorAll('[data-target="splitBill"], [data-wallet-section="splitBills"]').forEach((button) => {
    button.removeAttribute("data-target"); button.removeAttribute("data-wallet-section");
    button.dataset.workspaceAction = "";
    button.addEventListener("click", () => { splitter.scrollIntoView({ behavior: document.documentElement.dataset.reduceMotion === "true" ? "auto" : "smooth", block: "start" }); form.elements.total.focus({ preventScroll: true }); });
  });
}

function renderTripWorkspaces(target) {
  if (document.body.classList.contains("corporate-employee-mode")) return;
  if (["itineraryAlerts", "walletPanel"].includes(target)) {
    document.getElementById(target)?.classList.remove("is-account-empty");
  }
  if (target === "tripsPanel" && !state.accountData.showCreation) {
    const panel = document.querySelector("#tripsPanel");
    let workspace = panel.querySelector(".visual-trips-workspace");
    if (!workspace) { workspace = document.createElement("div"); workspace.className = "visual-trips-workspace"; panel.prepend(workspace); }
    renderVisualTripList(workspace);
  }
  if (target === "itineraryAlerts") renderTripItinerary(document.querySelector("#itineraryAlerts"));
  if (target === "walletPanel") renderWalletWorkspaceStatus();
  renderJourneyDashboard(target);
}

function renderWalletWorkspaceStatus() {
  const access = state.walletAccess;
  const balance = document.querySelector("#tripAvailableBalance");
  const copy = document.querySelector("#tripAvailableBalanceCopy");
  if (!balance || !copy) return;
  const image = document.querySelector("#walletDestinationPhoto");
  if (image) {
    const photo = tripWorkspacePhoto(state.accountData.activeTrip);
    if (image.getAttribute("src") !== photo.src) image.src = photo.src;
    image.alt = photo.alt;
  }
  if (access.status === "loading") { balance.textContent = "Loading..."; copy.textContent = "Checking your trip wallet."; }
  else if (!access.wallet || !state.accountData.activeTrip || (access.tripId && access.tripId !== state.accountData.activeTrip.id)) { balance.textContent = "Not connected"; copy.textContent = "Select a trip and set up its wallet to see confirmed funds."; }
  else { balance.textContent = formatWalletMoney(access.wallet.availableCents || 0, access.wallet.currency); copy.textContent = "Provider-confirmed funds available for this trip."; }
  renderJourneyWallet();
}

function renderFindTravelRideshare(category, targetContainer = null, onProvider = null) {
  if (category !== "rideshare") return;
  const results = targetContainer || document.querySelector("#exploreResultsGrid");
  if (!results) return;
  const section = document.createElement("section"); section.className = "rideshare-options";
  const destination = document.querySelector("#exploreDestinationInput")?.value.trim();
  section.append(workspaceHeading("Find your ride", destination ? `Rideshare options to check for ${destination}` : "City rides, airport pickups, and getting everyone there together."));
  const note = document.createElement("p"); note.className = "small";
  note.textContent = "Read service guides here. Live fares, pickup times, and booking are not connected.";
  section.append(note);
  const table = document.createElement("table");
  table.innerHTML = '<caption>Rideshare providers</caption><thead><tr><th scope="col">Provider</th><th scope="col">Options</th><th scope="col">Details</th></tr></thead>';
  const body = document.createElement("tbody");
  for (const [name, description] of [
    ["Uber", "City and airport rides"],
    ["Lyft", "City and airport rides"],
    ["Bolt", "City and airport rides"],
    ["Grab", "Car and taxi services"]
  ]) {
    const row = document.createElement("tr");
    const provider = document.createElement("th"); provider.scope = "row"; provider.textContent = name;
    const options = document.createElement("td"); options.textContent = description;
    const action = document.createElement("td");
    const details = workspaceButton(`About ${name}`, () => onProvider ? onProvider(name) : searchLiveTravelPlaces({ category: "rideshare", query: `${name} ridesharing`, destination: "", target: "explore" }));
    action.append(details); row.append(provider, options, action); body.append(row);
  }
  table.append(body); section.append(table);
  section.append(workspaceButton("Search local rides and taxis", () => onProvider ? onProvider("local taxis") : searchLiveTravelPlaces({ category: "rideshare", query: "", destination: document.querySelector("#exploreDestinationInput")?.value.trim() || "", target: "explore" }), true));
  results.replaceChildren(section);
}
