const journeySearches = new Map();
let journeyMode = "flights";
const journeyComparisons = new Map();

function beginInAppSearch(target) {
  const next = (journeySearches.get(target) || 0) + 1;
  journeySearches.set(target, next);
  return next;
}
function isCurrentInAppSearch(target, requestId) { return journeySearches.get(target) === requestId; }
function resetJourneyWorkspace() {
  journeyComparisons.clear();
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
  const heading = document.createElement("h3"); heading.textContent = live ? "Live places" : result.provider === "openstreetmap" ? "Places to explore" : "Destination & transport guides";
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
    const credit = document.createElement("p"); credit.textContent = `${item.title} · ${item.sourceLabel || "Wikipedia contributors"}. ${item.sourceUrl} · ${item.license || "CC BY-SA"}: ${item.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/"}`;
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
  renderJourneyCostComparison(workspace, target);
  const form = document.createElement("form"); form.className = "journey-search";
  const label = document.createElement("label"); label.textContent = "Destination or station";
  const input = document.createElement("input"); input.name = "destination"; input.type = "search"; input.placeholder = "Where are you going?"; input.required = true; input.maxLength = 160; input.value = previousQuery;
  const submit = document.createElement("button"); submit.type = "submit"; submit.className = "primary-button"; submit.textContent = "Search"; submit.prepend(journeyIcon("search"));
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
  const search = async (query = "", destination = input.value.trim(), provider = "auto") => {
    if (!destination && !query) { input.reportValidity(); input.focus(); return; }
    const token = beginInAppSearch(`journey-${target}`);
    status.textContent = provider === "live" ? "Checking Google Places..." : "Searching destinations..."; submit.disabled = true;
    if (host) { host.replaceChildren(); host.hidden = true; }
    try {
      const result = await searchTravelWithGuides({ category: journeyMode === "discover" ? getActiveExploreCategory() : journeyMode, destination, q: query, provider });
      if (!isCurrentInAppSearch(`journey-${target}`, token) || !workspace.isConnected || document.body.dataset.activeRoute !== target) return;
      if (result.skipped || !Array.isArray(result.results)) throw new Error("Guides could not be loaded. Please try again.");
      renderInAppTravelResults(target === "transportationPanel" ? "transportation" : target === "exploreDrops" ? "explore" : "travel", result);
      status.textContent = result.live ? `${result.results.length} current place results. No booking has been confirmed.` : `${result.fallbackReason ? "Live search is not connected. " : ""}${result.results.length ? `${result.results.length} ${result.provider === "openstreetmap" ? "map listings" : "reference guides"} found. Not live fares, timetables, or booking availability.` : "No guides found. Try a city and country or a broader search."}`;
    } catch (error) { if (isCurrentInAppSearch(`journey-${target}`, token)) status.textContent = error.message; }
    finally { submit.disabled = false; }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); search(); });
  form.append(workspaceButton("Browse guides", () => search("", input.value.trim(), "in_app")));
  if (journeyMode === "discover") form.append(workspaceButton("Check live places", () => search("", input.value.trim(), "live")));
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

function transportQuoteTotal(amount, basis, travelers, currency) {
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 50) throw new Error('Choose between 1 and 50 travelers.');
  if (!['person','group'].includes(basis)) throw new Error('Choose a price per person or for the group.');
  if (!Intl.supportedValuesOf('currency').includes(currency)) throw new Error('Enter a supported three-letter currency code.');
  const digits=new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;
  const text=String(amount).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text) || (text.split('.')[1]?.length || 0)>digits) throw new Error(`Enter a valid amount with at most ${digits} decimal places.`);
  const units=Math.round(Number(text)*10**digits);
  if(!Number.isSafeInteger(units)||units<0||units>1000000000)throw new Error('Enter a valid quoted price.');
  return {totalUnits:units*(basis==='person'?travelers:1),scale:10**digits};
}

function renderJourneyCostComparison(host,target) {
  const saved=journeyComparisons.get(target)||{route:null,quotes:[],draft:{}};
  journeyComparisons.set(target,saved);
  const section=document.createElement('section');section.className='journey-cost-comparison';section.setAttribute('aria-label','Route price comparison');
  const heading=document.createElement('h3');heading.textContent='Compare the cost of your journey';
  const note=document.createElement('p');note.textContent='Choose your route and date. Live pricing is not connected. Add prices you have received to compare them here; no sample prices are shown.';
  const form=document.createElement('form');form.className='journey-cost-route';
  const fields={};
  for(const [name,label,type,placeholder] of [['from','From','text','City, airport, or station'],['to','To','text','Destination city or station'],['date','Travel date','date',''],['travelers','Travelers','number','Number of people'],['currency','Currency','text','USD, EUR, GBP…']]){
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement('input');input.name=name;input.type=type;input.required=true;input.placeholder=placeholder;
    if(type==='text')input.maxLength=name==='currency'?3:160;
    if(name==='travelers'){input.min='1';input.max='50';input.step='1';}
    if(name==='currency'){input.pattern='[A-Za-z]{3}';input.autocapitalize='characters';}
    input.value=saved.draft[name]||'';fields[name]=input;wrap.append(input);form.append(wrap);
  }
  const submit=document.createElement('button');submit.type='submit';submit.className='primary-button';submit.textContent='Compare costs';form.append(submit);
  const status=document.createElement('p');status.setAttribute('role','status');
  const results=document.createElement('div');results.className='journey-cost-results';
  const money=(value,currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(value);
  function draw(){
    results.replaceChildren();if(!saved.route)return;
    const {from,to,date,travelers,currency}=saved.route;
    const title=document.createElement('h4');title.textContent=`${from} → ${to} · ${date} · ${travelers} traveler${travelers===1?'':'s'}`;results.append(title);
    const disclaimer=document.createElement('p');disclaimer.textContent='User-entered prices for this route and date. Check taxes, luggage, transfers, and cancellation terms with each provider. These are not live quotes or confirmed bookings.';results.append(disclaimer);
    const list=document.createElement('div');list.className='journey-cost-options';
    const ranked=[...saved.quotes].sort((a,b)=>a.totalUnits-b.totalUnits);
    const best=ranked.length>1?ranked[0].totalUnits:null;
    for(const mode of ['Flight','Train','Bus / coach','Ride share / taxi','Private transfer','Cruise / ferry']){
      const row=document.createElement('article');row.className='journey-guide';const name=document.createElement('h4');name.textContent=mode;row.append(name);
      const quotes=saved.quotes.filter(x=>x.mode===mode).sort((a,b)=>a.totalUnits-b.totalUnits);
      if(!quotes.length){const empty=document.createElement('p');empty.textContent='Price unavailable — no live pricing connection or entered quote.';row.append(empty);}
      for(const quote of quotes){const text=document.createElement('p');text.textContent=`${quote.provider}: ${money(quote.totalUnits/quote.scale,currency)} total · ${money(quote.totalUnits/quote.scale/travelers,currency)} per person${best!==null&&quote.totalUnits===best?' · Lowest entered total':''}`;const remove=workspaceButton('Remove quote',()=>{saved.quotes=saved.quotes.filter(x=>x!==quote);draw();});row.append(text,remove);}
      const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Add a price';detail.append(summary);
      const quoteForm=document.createElement('form');quoteForm.className='journey-quote-entry';
      const providerLabel=document.createElement('label');providerLabel.textContent='Provider';const provider=document.createElement('input');provider.required=true;provider.maxLength=100;provider.placeholder='Airline or transport company';providerLabel.append(provider);
      const priceLabel=document.createElement('label');priceLabel.textContent=`Quoted amount (${currency})`;const amount=document.createElement('input');amount.type='number';amount.required=true;amount.min='0';amount.step='any';priceLabel.append(amount);
      const basisLabel=document.createElement('label');basisLabel.textContent='Price applies to';const basis=document.createElement('select');for(const [value,label]of [['person','One person'],['group','Entire group']]){const option=document.createElement('option');option.value=value;option.textContent=label;basis.append(option);}basisLabel.append(basis);
      const add=document.createElement('button');add.type='submit';add.textContent='Add to comparison';const error=document.createElement('p');error.setAttribute('role','status');quoteForm.append(providerLabel,priceLabel,basisLabel,add,error);
      quoteForm.addEventListener('submit',event=>{event.preventDefault();try{const totals=transportQuoteTotal(amount.value,basis.value,travelers,currency);if(!provider.value.trim())throw new Error('Enter a provider name.');saved.quotes.push({mode,provider:provider.value.trim(),...totals});draw();}catch(e){error.textContent=e.message;}});
      detail.append(quoteForm);row.append(detail);list.append(row);
    }
    results.append(list);
  }
  form.addEventListener('input',()=>{for(const [key,input]of Object.entries(fields))saved.draft[key]=input.value;saved.route=null;saved.quotes=[];results.replaceChildren();status.textContent='Compare again to use the updated route, date, travelers, or currency.';});
  form.addEventListener('submit',event=>{event.preventDefault();try{
    const from=fields.from.value.trim(),to=fields.to.value.trim(),date=fields.date.value,travelers=Number(fields.travelers.value),currency=fields.currency.value.toUpperCase();
    if(!from||!to||from.toLowerCase()===to.toLowerCase())throw new Error('Enter different starting and destination points.');
    transportQuoteTotal('0','group',travelers,currency);saved.route={from,to,date,travelers,currency};status.textContent='Route ready. Add provider prices below to compare costs.';draw();
  }catch(e){status.textContent=e.message;}});
  section.append(heading,note,form,status,results);host.append(section);draw();
}
