const journeySearches = new Map();
let journeyMode = "flights";

function beginInAppSearch(target) {
  const next = (journeySearches.get(target) || 0) + 1;
  journeySearches.set(target, next);
  return next;
}
function isCurrentInAppSearch(target, requestId) { return journeySearches.get(target) === requestId; }
function resetJourneyWorkspace() {
  for (const [target, requestId] of journeySearches) journeySearches.set(target, requestId + 1);
  journeyMode = "flights";
  document.querySelectorAll(".journey-dashboard").forEach((workspace) => workspace.replaceChildren());
  document.querySelectorAll("#exploreLiveResultsGrid,#travelLiveResults,#journeyTransportResults").forEach((host) => { host.replaceChildren(); host.hidden = true; });
}
function journeyIcons() { window.lucide?.createIcons(); }
function journeyIcon(name) {
  const icon = document.createElement("i"); icon.dataset.lucide = name; icon.setAttribute("aria-hidden", "true"); return icon;
}
function journeyAction(label, icon, action) {
  const button = workspaceButton(label, action);
  button.prepend(journeyIcon(icon));
  return button;
}

function renderInAppTravelResults(target, result) {
  const routes = { explore: "exploreDrops", travel: "rideShareHub", privateDriver: "rideShareHub", transportation: "transportationPanel" };
  if (document.body.dataset.activeRoute !== routes[target]) return;
  const selector = { explore: "#exploreLiveResultsGrid", travel: "#travelLiveResults", privateDriver: "#privateDriverLiveList", transportation: "#journeyTransportResults" }[target];
  const container = document.querySelector(selector);
  if (!container) return;
  container.replaceChildren(); container.hidden = false;
  const live = result.provider === "google_places" && result.live === true;
  const heading = document.createElement("h3"); heading.textContent = live ? "Live places" : "Destination & transport guides";
  heading.tabIndex = -1;
  const note = document.createElement("p"); note.textContent = live ? `Checked ${new Date(result.fetchedAt).toLocaleString()}. Current place details from Google Places. Fares and booking availability are not included.` : `Updated ${new Date(result.fetchedAt).toLocaleString()}. Reference guides, not live prices, timetables, or booking availability.`;
  container.append(heading, note);
  container.append(workspaceButton("Back to search", () => container.closest(".has-journey-dashboard")?.querySelector(".journey-search input")?.focus()));
  for (const item of result.results || []) {
    const article = document.createElement("article"); article.className = "journey-guide";
    const title = document.createElement("h4"); title.textContent = item.title;
    if (live) {
      const details = document.createElement("p"); details.textContent = [item.location, item.status, item.price].filter(Boolean).join(" · ");
      const source = document.createElement("p"); source.textContent = "Source: Google Places";
      article.append(title, details, source); container.append(article); continue;
    }
    const text = document.createElement("p"); text.textContent = item.description.length > 280 ? `${item.description.slice(0, 277)}...` : item.description;
    if (item.description.length > 280) {
      const more = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = "Read more";
      const full = document.createElement("p"); full.textContent = item.description; more.append(summary, full); article.append(more);
    }
    const source = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = "Source & license";
    const credit = document.createElement("p"); credit.textContent = `${item.title} by Wikipedia contributors. ${item.sourceUrl} · Text excerpt under CC BY-SA: https://creativecommons.org/licenses/by-sa/4.0/`;
    source.append(summary, credit); article.prepend(title, text); article.append(source); container.append(article);
  }
  if (!result.results?.length) { const empty = document.createElement("p"); empty.textContent = "No guides found. Try a city and country or a station name."; container.append(empty); }
  container.scrollIntoView({ block: "start", behavior: "auto" });
  heading.focus({ preventScroll: true });
}

function getJourneyRecords(mode) {
  if (!state.session?.user || !state.accountData.activeTrip) return [];
  const records = state.accountData.records || {};
  if (mode === "flights") return (records.flights || []).map((record) => ({ ...record, journeyType: "flight" }));
  const types = { trains: /train|rail/i, rideshare: /ride|taxi|car|driver/i, shuttle: /shuttle|bus|transfer/i };
  return (records.transportation_records || []).filter((row) => types[mode]?.test(row.transportation_type || row.transport_type || "")).map((row) => ({ ...row, journeyType: "ground" }));
}

function renderJourneyDashboard(target) {
  if(target==='exploreDrops'){renderDestinationDiscovery();return;}
  if (!["exploreDrops", "transportationPanel", "rideShareHub"].includes(target) || document.body.classList.contains("corporate-employee-mode")) return;
  const panel = document.getElementById(target);
  if (!panel) return;
  panel.classList.remove("is-account-empty"); panel.classList.add("has-journey-dashboard");
  beginInAppSearch(`journey-${target}`);
  beginInAppSearch(target === "exploreDrops" ? "explore" : target === "rideShareHub" ? "travel" : "transportation");
  let workspace = panel.querySelector(".journey-dashboard");
  if (!workspace) { workspace = document.createElement("div"); workspace.className = "journey-dashboard"; panel.prepend(workspace); }
  // Preserve unsent search input while account records refresh.
  const previousQuery = workspace.querySelector('[name="destination"]')?.value || "";
  workspace.replaceChildren();
  const header = workspaceHeading(target === "exploreDrops" ? "Find travel" : "Transportation", "Your next move, all in one place.");
  workspace.append(header);
  const form = document.createElement("form"); form.className = "journey-search";
  const label = document.createElement("label"); label.textContent = "Destination or station";
  const input = document.createElement("input"); input.name = "destination"; input.type = "search"; input.placeholder = "Where are you going?"; input.required = true; input.maxLength = 160; input.value = previousQuery;
  const submit = document.createElement("button"); submit.type = "submit"; submit.className = "primary-button"; submit.textContent = "Search live"; submit.prepend(journeyIcon("search"));
  label.append(input); form.append(label, submit); workspace.append(form);
  const tabs = document.createElement("div"); tabs.className = "journey-modes"; tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Transportation type");
  for (const [key, title, icon] of [["flights", "Flights", "plane"], ["trains", "Trains", "train-front"], ["rideshare", "Ride share", "car-front"], ["shuttle", "Shuttle", "bus-front"], ["discover", "Discover", "compass"]]) {
    const button = journeyAction(title, icon, () => { journeyMode = key; renderJourneyDashboard(target); });
    button.setAttribute("aria-pressed", String(journeyMode === key)); tabs.append(button);
  }
  workspace.append(tabs); panel.classList.toggle("journey-discover", journeyMode === "discover");
  const status = document.createElement("p"); status.className = "journey-status"; status.setAttribute("role", "status"); workspace.append(status);
  const resultsHost = target === "exploreDrops" ? "#exploreLiveResultsGrid" : target === "rideShareHub" ? "#travelLiveResults" : "#journeyTransportResults";
  if (target === "transportationPanel" && !panel.querySelector(resultsHost)) { const results = document.createElement("div"); results.id = "journeyTransportResults"; results.className = "journey-inline-results"; panel.append(results); }
  const host = panel.querySelector(resultsHost);
  if (host && host.parentElement !== panel) panel.append(host);
  if (host) { host.replaceChildren(); host.hidden = true; }
  const search = async (query = "", destination = input.value.trim(), provider = "live") => {
    if (!destination && !query) { input.reportValidity(); input.focus(); return; }
    const token = beginInAppSearch(`journey-${target}`);
    status.textContent = provider === "live" ? "Checking live search..." : "Updating destination guides..."; submit.disabled = true;
    if (host) { host.replaceChildren(); host.hidden = true; }
    try {
      const result = await liveSearchApiRequest("/api/travel-search", { method: "POST", body: JSON.stringify({ category: journeyMode === "discover" ? getActiveExploreCategory() : journeyMode, destination, q: query, provider }) });
      if (!isCurrentInAppSearch(`journey-${target}`, token) || !workspace.isConnected || document.body.dataset.activeRoute !== target) return;
      if (result.skipped || !Array.isArray(result.results)) throw new Error("Guides could not be loaded. Please try again.");
      renderInAppTravelResults(target === "transportationPanel" ? "transportation" : target === "exploreDrops" ? "explore" : "travel", result);
      status.textContent = result.live ? `${result.results.length} current place results. No booking has been confirmed.` : `${result.results.length} guides updated. No fare or booking has been confirmed.`;
    } catch (error) { if (isCurrentInAppSearch(`journey-${target}`, token)) status.textContent = error.message; }
    finally { submit.disabled = false; }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); search(); });
  form.append(workspaceButton("Browse guides", () => search("", input.value.trim(), "in_app")));
  const title = document.createElement("h3"); title.textContent = "Your next move"; workspace.append(title);
  const records = getJourneyRecords(journeyMode).sort((a, b) => String(a.departs_at || a.pickup_at || "").localeCompare(String(b.departs_at || b.pickup_at || "")));
  const next = records.find((row) => new Date(row.departs_at || row.pickup_at).getTime() >= Date.now()) || records[0];
  const move = document.createElement("section"); move.className = "journey-next";
  move.append(journeyIcon(journeyMode === "flights" ? "plane-takeoff" : journeyMode === "trains" ? "train-front" : "car-front"));
  const info = document.createElement("div"); const route = document.createElement("h4");
  route.textContent = next ? [next.departure_airport || next.pickup_location, next.arrival_airport || next.dropoff_location].filter(Boolean).join(" to ") || next.provider_name || "Saved journey" : "Your next journey starts here";
  const detail = document.createElement("p");
  const starts = next?.departs_at || next?.pickup_at;
  detail.textContent = next ? `${starts ? new Date(starts).toLocaleString() : "Time not added"} · ${next.airline || next.provider_name || "Saved trip record"}` : "Saved flights and transport appear here after you add them to your trip.";
  info.append(route, detail); move.append(info); workspace.append(move);
  if (records.length > 1) {
    const list = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = `All saved journeys (${records.length})`; list.append(summary);
    for (const record of records) { const row = document.createElement("p"); row.textContent = [record.airline || record.provider_name, record.departure_airport || record.pickup_location, record.arrival_airport || record.dropoff_location, record.departs_at || record.pickup_at].filter(Boolean).join(" · "); list.append(row); }
    workspace.append(list);
  }
  const tools = document.createElement("div"); tools.className = "journey-tools";
  tools.append(journeyAction("Private driver & ride share", "car-taxi-front", () => { journeyMode = "rideshare"; renderJourneyDashboard(target); }), journeyAction("Compare transport guides", "route", () => search("public transport", input.value.trim(), "in_app")));
  workspace.append(tools);
  if (journeyMode === "rideshare") {
    const providers = document.createElement("div"); workspace.append(providers); renderFindTravelRideshare("rideshare", providers, (name) => search(`${name} ridesharing`, input.value.trim(), "in_app"));
  }
  const note = document.createElement("p"); note.className = "journey-provider-note"; note.textContent = "Guides update here. Live fares, pickup times, and ticket booking are not connected."; workspace.append(note);
  journeyIcons();
}

function initializeJourneyWallet() {
  const panel = document.querySelector("#walletPanel");
  if (!panel || panel.querySelector("#journeyWalletCard")) return;
  const menu = document.querySelector(".simple-main-menu");
  if (menu && !menu.querySelector('[data-target="transportationPanel"]')) {
    const nav = document.createElement("button"); nav.type = "button"; nav.dataset.target = "transportationPanel"; nav.dataset.consumerNav = ""; nav.textContent = "Transportation";
    menu.querySelector('[data-target="exploreDrops"]')?.after(nav);
  }
  panel.classList.add("journey-wallet");
  const card = document.createElement("section"); card.id = "journeyWalletCard"; card.setAttribute("aria-label", "Trip wallet overview");
  card.innerHTML = '<div class="journey-card-brand"><img src="icons/traveldrip-logo-icon.svg" alt=""><strong>Travel-Drip</strong><i data-lucide="nfc" aria-hidden="true"></i></div><i class="journey-card-chip" data-lucide="microchip" aria-hidden="true"></i><strong id="journeyCardNumber">Your trip wallet</strong><span id="journeyCardStatus">No payment card issued</span><i class="journey-card-palm" data-lucide="tree-palm" aria-hidden="true"></i>';
  panel.querySelector(".wallet-redesign-shell").before(card);
  const balance = panel.querySelector(".wallet-balance-hero");
  balance.querySelector(":scope > span").textContent = "Balance";
  const add = panel.querySelector('[data-wallet-action="Add Funds"]');
  if (add) balance.append(add);
  const contributions = document.createElement("section"); contributions.id = "journeyWalletContributions"; contributions.className = "journey-contributions";
  contributions.innerHTML = '<div><h3>Trip contributions</h3><strong id="journeyContributionTotal">Not connected</strong></div><p id="journeyContributionNote">Select a trip to view confirmed contributions.</p>';
  panel.querySelector(".wallet-redesign-shell").after(contributions);
  const actions = panel.querySelector(".wallet-smart-actions");
  for (const [selector, icon] of [['[data-workspace-action]', "split"], ['[data-wallet-action="Request Payment"]', "wallet-cards"], ['#walletHeaderVirtualCardButton', "credit-card"]]) {
    const button = actions.querySelector(selector); if (button) button.prepend(journeyIcon(icon));
  }
  actions.append(journeyAction("Recent activity", "history", () => { const details = panel.querySelector(".wallet-operations-panel")?.closest("details"); if (details) details.open = true; panel.querySelector("#sharedWalletLedger")?.scrollIntoView({ block: "center" }); }));
  actions.append(journeyAction("Refunds", "rotate-ccw", () => { const target = document.querySelector("#requestRefundButton"); const details = target?.closest("details"); if (details) details.open = true; target?.scrollIntoView({ block: "center" }); target?.focus(); }));
  journeyIcons();
}

function renderJourneyWallet() {
  const total = document.querySelector("#journeyContributionTotal"); if (!total) return;
  const access = state.walletAccess;
  document.querySelector("#walletHeading").textContent = "Wallet";
  const valid = Boolean(state.accountData.activeTrip && access.tripId === state.accountData.activeTrip.id && access.wallet);
  total.textContent = valid ? formatWalletMoney(access.wallet.totalContributionsCents || 0, access.wallet.currency) : "Not connected";
  document.querySelector("#journeyContributionNote").textContent = access.contributionVisibility === "restricted" ? "Financial details are restricted by your trip's permissions." : valid ? "Provider-confirmed contributions only. Pending payments are not counted." : "Select a trip to view confirmed contributions.";
  const lastFour = valid ? String(access.card?.maskedLastFour || "") : "";
  document.querySelector("#journeyCardNumber").textContent = /^\d{4}$/.test(lastFour) ? `Card ending ${lastFour}` : valid ? access.wallet.displayName || "Trip funds" : "Your trip wallet";
  document.querySelector("#journeyCardStatus").textContent = valid && access.card ? String(access.card.status || "Card status unavailable").replaceAll("_", " ") : "No payment card issued";
}
