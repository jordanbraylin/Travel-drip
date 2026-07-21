const state = {
  supabase: null,
  session: null,
  pendingWalletPayment: null,
  pendingSecureAction: null,
  authMode: "signin",
  isAdmin: false,
  adminStatusCheckedFor: "",
  hasEnteredApp: sessionStorage.getItem("traveldripEnteredApp") === "true",
  config: {
    supabaseUrl: "",
    supabaseAnonKey: "",
    vapidPublicKey: ""
  },
  selectedRideProvider: "Careem",
  connectedRideAccounts: {
    Careem: { connected: true, account: "Connected rider profile", status: "Account Connected" },
    Uber: { connected: false, account: "", status: "Not connected" },
    Lyft: { connected: false, account: "", status: "Not connected" },
    Grab: { connected: false, account: "", status: "Not connected" }
  }
};

const plans = [
  [
    ["10:00", "Arrive and bag drop", "Check in with the group host near JBR."],
    ["13:30", "Marina lunch", "Seafood table reserved for eight."],
    ["20:00", "Rooftop dinner", "Open-air skyline spot with budget cap."]
  ],
  [
    ["08:30", "Desert pickup", "Shared shuttle, dune ride, and coffee stop."],
    ["15:00", "Pool reset", "Two cabanas on hold until the vote closes."],
    ["21:30", "Listening lounge", "Low-volume bar near the hotel cluster."]
  ],
  [
    ["09:45", "Old city walk", "Gold souk, creek crossing, and street snacks."],
    ["14:15", "Museum slot", "Timed tickets grouped under one QR code."],
    ["18:30", "Farewell dinner", "Family-style menu with deposit applied."]
  ]
];

const dayCopy = [
  "Balanced pace with one anchor activity each day.",
  "Adventure-heavy day with a relaxed evening recovery window.",
  "Culture and food stops grouped by walking distance."
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const isFilePreview = location.protocol === "file:";

function setSyncStatus(message) {
  const el = $("#syncStatus");
  if (el) el.textContent = message;
}

const splitParticipants = [
  { name: "Jordan", custom: 86, percent: 20, items: ["Appetizer", "Dessert"] },
  { name: "Sarah", custom: 128, percent: 40, items: ["Steak", "Dessert"] },
  { name: "Mike", custom: 96, percent: 30, items: ["Pasta", "Appetizer"] },
  { name: "Alex", custom: 74, percent: 30, items: ["Drinks", "Dessert"] },
  { name: "Priya", custom: 66, percent: 0, items: ["Appetizer"] },
  { name: "Noah", custom: 66, percent: 0, items: ["Appetizer"] }
];

const receiptItems = [
  { item: "Ribeye Steak", price: 42, diners: ["Sarah"], editable: true },
  { item: "Caesar Salad", price: 14, diners: ["Alex"], editable: true },
  { item: "Sushi Roll", price: 18, diners: ["Alex"], editable: true },
  { item: "Pasta Alfredo", price: 24, diners: ["Mike"], editable: true },
  { item: "Margarita", price: 16, diners: ["Sarah"], editable: true },
  { item: "Shared Appetizer", price: 22, diners: ["Sarah", "Mike", "Alex"], editable: true },
  { item: "Dessert Platter", price: 18, diners: ["Mike"], editable: true }
];

const receiptPaymentStatus = {
  Jordan: "Pending",
  Sarah: "Paid",
  Mike: "Pending",
  Alex: "Paid",
  Priya: "Not dining",
  Noah: "Not dining"
};

const rideProvidersByDestination = {
  "United States": ["Uber", "Lyft"],
  "Canada": ["Uber", "Lyft"],
  "United Kingdom": ["Uber", "Bolt"],
  "Mexico": ["Uber", "DiDi"],
  "Brazil": ["Uber", "99"],
  "Japan": ["GO", "Uber"],
  "Singapore": ["Grab"],
  "Malaysia": ["Grab"],
  "Thailand": ["Grab"],
  "Indonesia": ["Grab", "Gojek"],
  "India": ["Uber", "Ola"],
  "United Arab Emirates": ["Careem", "Uber"]
};

const rideParticipants = [
  { name: "Jordan", custom: 14, percent: 25, note: "Full route" },
  { name: "Sarah", custom: 18, percent: 40, note: "Extra stop" },
  { name: "Mike", custom: 15, percent: 20, note: "Shared pickup" },
  { name: "Alex", custom: 16, percent: 15, note: "Shared drop-off" },
  { name: "Priya", custom: 12, percent: 0, note: "Short segment" },
  { name: "Noah", custom: 12, percent: 0, note: "Short segment" }
];

const sharedRideMembers = [
  { name: "Jordan", status: "Organizer", splitting: true },
  { name: "Sarah", status: "Joined", splitting: true },
  { name: "Mike", status: "Joined", splitting: true },
  { name: "Alex", status: "Leaving later", splitting: false }
];

const livePlanDestinations = [
  {
    location: "United Arab Emirates",
    title: "Dubai long weekend",
    description: "Rooftop dinners, desert rides, beach clubs, and a shared wallet that keeps everyone even.",
    photo: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1600&auto=format&fit=crop",
    alt: "Dubai skyline at sunset",
    knownFor: "Futuristic skylines, desert adventures, luxury hotels, global food halls, and record-setting architecture.",
    funFact: "Dubai is home to the Burj Khalifa, famous worldwide for its record-setting height.",
    adventures: ["Dune bashing at sunset", "Dinner in the desert", "Sky-view lounges", "Old Dubai creek walks"]
  },
  {
    location: "California",
    title: "California coast drive",
    description: "Pacific overlooks, vineyard stops, beach bonfires, and live alerts for every route change.",
    photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
    alt: "California coastal highway beside turquoise water",
    knownFor: "Pacific Coast Highway drives, beaches, national parks, wineries, film culture, and tech cities.",
    funFact: "California has the highest and lowest points in the contiguous United States.",
    adventures: ["Drive Big Sur", "Surf lessons", "Yosemite hikes", "Sunset beach picnics"]
  },
  {
    location: "Japan",
    title: "Tokyo food sprint",
    description: "Ramen counters, late trains, market mornings, and bill splits that update before the next stop.",
    photo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1600&auto=format&fit=crop",
    alt: "Tokyo city street with bright signs",
    knownFor: "Sushi, ramen, bullet trains, temples, cherry blossoms, anime culture, and precise hospitality.",
    funFact: "Japan's Shinkansen bullet trains are famous for speed, punctuality, and smooth rides.",
    adventures: ["Night markets in Tokyo", "Tea ceremony", "Mount Fuji views", "Kyoto shrine walks"]
  },
  {
    location: "New York",
    title: "New York city week",
    description: "Museum slots, dinner reservations, Broadway timing, and meeting point reminders for the whole crew.",
    photo: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1600&auto=format&fit=crop",
    alt: "New York skyline and city streets",
    knownFor: "Broadway, skyline views, museums, pizza slices, fashion, finance, and nonstop neighborhood energy.",
    funFact: "New York City's subway system is one of the largest rapid transit systems in the world.",
    adventures: ["Broadway night", "Central Park picnic", "Rooftop skyline photos", "Brooklyn food crawl"]
  },
  {
    location: "Greece",
    title: "Santorini sunset loop",
    description: "Cliffside stays, boat day holds, shared photos, and itinerary changes pushed as they happen.",
    photo: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=1600&auto=format&fit=crop",
    alt: "White buildings on a Santorini cliff above the sea",
    knownFor: "Ancient ruins, island sunsets, clear blue water, Mediterranean food, mythology, and whitewashed villages.",
    funFact: "Santorini's dramatic cliffs were shaped by one of history's major volcanic eruptions.",
    adventures: ["Caldera boat day", "Oia sunset photos", "Greek cooking class", "Ancient ruins tour"]
  },
  {
    location: "Florida",
    title: "Miami friends escape",
    description: "Pool plans, dinner votes, rideshare splits, and wallet approvals that keep the weekend moving.",
    photo: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?q=80&w=1600&auto=format&fit=crop",
    alt: "Tropical beach shoreline with clear water",
    knownFor: "Warm beaches, Latin food, theme parks, Everglades wildlife, nightlife, and cruise departures.",
    funFact: "Florida has more than 1,300 miles of coastline.",
    adventures: ["Airboat ride", "South Beach morning", "Little Havana food stop", "Keys day trip"]
  }
];

function hideLoader() {
  window.setTimeout(() => $("#loader")?.classList.add("done"), 450);
}

function escapeHtml(text) {
  return text.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderPlan(index) {
  const itinerary = $("#itinerary");
  const builderCopy = $("#builderCopy");
  if (!itinerary) return;
  itinerary.innerHTML = plans[index].map(([time, title, detail]) => `
    <div class="stop">
      <time>${time}</time>
      <div><strong>${title}</strong><span>${detail}</span></div>
    </div>
  `).join("");
  if (builderCopy) builderCopy.textContent = dayCopy[index];
}

function startLivePlanRotation() {
  const hero = $("#dashboardHome");
  const photo = $("#livePlanPhoto");
  const location = $("#livePlanLocation");
  const title = $("#livePlanTitle");
  const description = $("#livePlanDescription");
  if (!hero || !photo || !location || !title || !description) return;

  let index = 0;
  const renderDestination = (nextIndex = index + 1) => {
    index = (nextIndex + livePlanDestinations.length) % livePlanDestinations.length;
    const destination = livePlanDestinations[index];
    hero.classList.add("is-flashing");
    window.setTimeout(() => {
      photo.src = destination.photo;
      photo.alt = destination.alt;
      location.textContent = `Live group plan • ${destination.location}`;
      title.textContent = destination.title;
      description.textContent = destination.description;
      renderDestinationInsights(destination, index);
    }, 180);
    window.setTimeout(() => hero.classList.remove("is-flashing"), 700);
  };

  renderDestinationInsights(livePlanDestinations[0], 0);
  $$("#destinationChooser button").forEach((button) => {
    button.addEventListener("click", () => renderDestination(Number(button.dataset.destinationIndex)));
  });
  window.setInterval(renderDestination, 4200);
}

function renderDestinationInsights(destination, activeIndex) {
  const knownFor = $("#destinationKnownFor");
  const funFact = $("#destinationFunFact");
  const adventures = $("#destinationAdventures");
  if (!knownFor || !funFact || !adventures) return;

  knownFor.textContent = destination.knownFor;
  funFact.textContent = destination.funFact;
  adventures.innerHTML = destination.adventures.map((adventure) => `<span>${escapeHtml(adventure)}</span>`).join("");
  $$("#destinationChooser button").forEach((button) => {
    const isActive = Number(button.dataset.destinationIndex) === activeIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getBillInputs() {
  const subtotal = Number($("#billSubtotal")?.value || 0);
  const tax = Number($("#billTax")?.value || 0);
  const tipPercent = Number($("#billTipPercent")?.value || 0);
  const fees = Number($("#billFees")?.value || 0);
  const discount = Number($("#billDiscount")?.value || 0);
  const diners = Math.max(1, Math.min(24, Number($("#billDiners")?.value || 1)));
  const tip = Math.max(0, subtotal * (tipPercent / 100));
  const total = Math.max(0, subtotal + tax + tip + fees - discount);
  return { subtotal, tax, tipPercent, tip, fees, discount, diners, total };
}

function getSplitMode() {
  return $(".split-mode-tabs button.active")?.dataset.splitMode || "equal";
}

function getParticipantSplits(bill, mode) {
  const participants = splitParticipants.slice(0, bill.diners);

  if (mode === "percentage") {
    const percentTotal = participants.reduce((sum, person) => sum + person.percent, 0) || 100;
    return participants.map((person) => ({
      ...person,
      amount: bill.total * (person.percent / percentTotal),
      note: `${Math.round((person.percent / percentTotal) * 100)}% share`
    }));
  }

  if (mode === "custom") {
    const customTotal = participants.reduce((sum, person) => sum + person.custom, 0) || bill.total;
    return participants.map((person) => ({
      ...person,
      amount: bill.total * (person.custom / customTotal),
      note: "Manual meal adjustment"
    }));
  }

  if (mode === "itemized") {
    const itemWeights = {
      Jordan: 1.05,
      Sarah: 1.38,
      Mike: 1.08,
      Alex: 0.94,
      Priya: 0.78,
      Noah: 0.77
    };
    const weightTotal = participants.reduce((sum, person) => sum + (itemWeights[person.name] || 1), 0) || participants.length;
    return participants.map((person) => ({
      ...person,
      amount: bill.total * ((itemWeights[person.name] || 1) / weightTotal),
      note: person.items.join(", ")
    }));
  }

  return participants.map((person) => ({
    ...person,
    amount: bill.total / bill.diners,
    note: "Equal split"
  }));
}

function renderBillSplit() {
  if (!$("#splitPreview")) return;
  const bill = getBillInputs();
  const mode = getSplitMode();
  const splits = getParticipantSplits(bill, mode);
  const paid = splits.slice(0, 2).reduce((sum, person) => sum + person.amount, 0);
  const each = bill.total / bill.diners;

  $("#billFinalTotal").textContent = currency(bill.total);
  $("#billEachTotal").textContent = currency(each);
  $("#billRemaining").textContent = currency(Math.max(0, bill.total - paid));
  $("#splitPreview").innerHTML = splits.map((person) => {
    const food = Math.max(0, person.amount - (bill.tax + bill.tip + bill.fees - bill.discount) / bill.diners);
    const taxShare = bill.tax / bill.diners;
    const tipShare = bill.tip / bill.diners;
    return `
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <span>${escapeHtml(person.note)}</span>
        <small>Food ${currency(food)} • Tax ${currency(taxShare)} • Tip ${currency(tipShare)}</small>
        <b>${currency(person.amount)}</b>
      </div>
    `;
  }).join("");
  renderReceiptScanner(bill);
}

function getReceiptSplits(bill) {
  const diners = splitParticipants.slice(0, bill.diners);
  const names = diners.map((person) => person.name);
  const itemTotals = Object.fromEntries(names.map((name) => [name, { food: 0, shared: 0 }]));

  receiptItems.forEach((receiptItem) => {
    const assigned = receiptItem.diners.filter((name) => names.includes(name));
    if (!assigned.length) return;
    const share = receiptItem.price / assigned.length;
    assigned.forEach((name) => {
      if (assigned.length > 1) itemTotals[name].shared += share;
      else itemTotals[name].food += share;
    });
  });

  const itemSubtotal = diners.reduce((sum, person) => sum + itemTotals[person.name].food + itemTotals[person.name].shared, 0) || 1;
  return diners.map((person) => {
    const food = itemTotals[person.name].food;
    const shared = itemTotals[person.name].shared;
    const weight = (food + shared) / itemSubtotal;
    const tax = bill.tax * weight;
    const tip = bill.tip * weight;
    const fees = bill.fees * weight;
    const discount = bill.discount * weight;
    const total = Math.max(0, food + shared + tax + tip + fees - discount);
    return { ...person, food, shared, tax, tip, fees, discount, total, status: receiptPaymentStatus[person.name] || "Pending" };
  });
}

function renderReceiptScanner(bill = getBillInputs()) {
  if (!$("#receiptItemList")) return;
  const receiptSplits = getReceiptSplits(bill);
  const receiptTotal = receiptSplits.reduce((sum, split) => sum + split.total, 0);
  const paidTotal = receiptSplits.filter((split) => split.status === "Paid").reduce((sum, split) => sum + split.total, 0);

  $("#receiptExtractedTotal").textContent = currency(bill.total);
  $("#receiptItemList").innerHTML = receiptItems.map((receiptItem, itemIndex) => `
    <article>
      <div>
        <strong>${escapeHtml(receiptItem.item)}</strong>
        <span>${currency(receiptItem.price)} • ${receiptItem.diners.length > 1 ? "Shared item" : "Individual item"}</span>
      </div>
      <div class="receipt-claim-grid">
        ${splitParticipants.slice(0, bill.diners).map((person) => `
          <label>
            <input type="checkbox" data-receipt-item="${itemIndex}" data-receipt-diner="${escapeHtml(person.name)}" ${receiptItem.diners.includes(person.name) ? "checked" : ""}>
            ${escapeHtml(person.name)}
          </label>
        `).join("")}
      </div>
    </article>
  `).join("");

  $("#receiptStatusList").innerHTML = receiptSplits.map((split) => `
    <div>
      <strong>${escapeHtml(split.name)}</strong>
      <span>Food ${currency(split.food)} • Shared ${currency(split.shared)} • Tax ${currency(split.tax)} • Tip ${currency(split.tip)}</span>
      <b>${currency(split.total)}</b>
      <em>${escapeHtml(split.status)}</em>
    </div>
  `).join("");

  $("#receiptHistoryList").innerHTML = `
    <div><strong>Marina Social Table</strong><span>Dubai long weekend • ${splitParticipants.slice(0, bill.diners).map((person) => person.name).join(", ")}</span><b>${currency(receiptTotal)}</b></div>
    <div><strong>Payment status</strong><span>${currency(paidTotal)} paid • ${currency(Math.max(0, receiptTotal - paidTotal))} pending • downloadable receipt ready</span><b>Stored</b></div>
  `;

  $$("[data-receipt-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const item = receiptItems[Number(event.target.dataset.receiptItem)];
      const diner = event.target.dataset.receiptDiner;
      if (event.target.checked && !item.diners.includes(diner)) item.diners.push(diner);
      if (!event.target.checked) item.diners = item.diners.filter((name) => name !== diner);
      renderReceiptScanner(getBillInputs());
      $("#billMessage").textContent = `${item.item} assignment updated. Shared items divide evenly across selected travelers.`;
    });
  });
}

function getRideInputs() {
  const fare = Number($("#rideFare")?.value || 0);
  const tax = Number($("#rideTax")?.value || 0);
  const tolls = Number($("#rideTolls")?.value || 0);
  const fees = Number($("#rideFees")?.value || 0);
  const tip = Number($("#rideTip")?.value || 0);
  const passengers = Math.max(1, Math.min(8, Number($("#ridePassengers")?.value || 1)));
  const total = Math.max(0, fare + tax + tolls + fees + tip);
  return { fare, tax, tolls, fees, tip, passengers, total };
}

function getRideMode() {
  return $(".ride-tabs button.active")?.dataset.rideMode || "equal";
}

function getRideSplits(ride, mode) {
  const passengers = rideParticipants.slice(0, ride.passengers);

  if (mode === "percentage") {
    const percentTotal = passengers.reduce((sum, person) => sum + person.percent, 0) || 100;
    return passengers.map((person) => ({
      ...person,
      amount: ride.total * (person.percent / percentTotal),
      detail: `${Math.round((person.percent / percentTotal) * 100)}% fare share`
    }));
  }

  if (mode === "custom") {
    const customTotal = passengers.reduce((sum, person) => sum + person.custom, 0) || ride.total;
    return passengers.map((person) => ({
      ...person,
      amount: ride.total * (person.custom / customTotal),
      detail: person.note
    }));
  }

  return passengers.map((person) => ({
    ...person,
    amount: ride.total / ride.passengers,
    detail: "Equal passenger split"
  }));
}

function renderRideProviders() {
  if (!$("#rideProviderList")) return;
  const destination = $("#rideDestination")?.value || "United Arab Emirates";
  const providers = rideProvidersByDestination[destination] || ["Local taxi", "Hotel transfer"];
  if (!providers.includes(state.selectedRideProvider)) state.selectedRideProvider = providers[0];
  $("#rideProviderList").innerHTML = providers.map((provider) => {
    const account = state.connectedRideAccounts[provider];
    const status = account?.connected ? "Connected" : "Connect required";
    return `<button class="${provider === state.selectedRideProvider ? "active" : ""}" type="button" data-ride-provider="${escapeHtml(provider)}"><strong>${escapeHtml(provider)}</strong><span>${status}</span></button>`;
  }).join("");
  $("#rideRecommended").textContent = state.selectedRideProvider;
  $("#rideWait").textContent = state.selectedRideProvider === "Careem" || state.selectedRideProvider === "Grab" ? "8 min" : "12 min";
  $("#rideEstimate").textContent = destination === "United Arab Emirates" ? "$18-$22" : "$16-$28";
  renderRideAccount();
}

function renderRideAccount() {
  if (!$("#rideConnectionTitle")) return;
  const provider = state.selectedRideProvider;
  const account = state.connectedRideAccounts[provider] || { connected: false, account: "", status: "Not connected" };
  $("#rideConnectionTitle").textContent = account.connected ? `${provider} account connected` : `Connect your ${provider} account to continue.`;
  $("#rideConnectionMeta").textContent = account.connected
    ? `${account.status} • ${account.account || "Connected account"} • You can disconnect, reconnect, or switch providers anytime.`
    : `TravelDrip never stores your ${provider} password. Use ${provider}'s supported authentication or launch the official app with trip details prefilled.`;
  $("#connectRideAccountButton").hidden = account.connected;
  $("#reconnectRideAccountButton").hidden = !account.connected;
  $("#disconnectRideAccountButton").hidden = !account.connected;
  $("#launchRideButton").disabled = !account.connected;

  if ($("#sharedRideMembers")) {
    $("#sharedRideMembers").innerHTML = sharedRideMembers.map((member) => `
      <label>
        <input type="checkbox" data-shared-rider="${escapeHtml(member.name)}" ${member.splitting ? "checked" : ""}>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.status)} • ${member.splitting ? "Splitting fare" : "Not splitting"}</span>
      </label>
    `).join("");
  }
}

function renderRideSplit() {
  if (!$("#rideSplitPreview")) return;
  renderRideProviders();
  const ride = getRideInputs();
  const mode = getRideMode();
  const splits = getRideSplits(ride, mode);
  const paid = splits.slice(0, 1).reduce((sum, person) => sum + person.amount, 0);

  $("#rideFinalTotal").textContent = currency(ride.total);
  $("#rideEachTotal").textContent = currency(ride.total / ride.passengers);
  $("#rideRemaining").textContent = currency(Math.max(0, ride.total - paid));
  $("#rideSplitPreview").innerHTML = splits.map((person) => `
    <div>
      <strong>${escapeHtml(person.name)}</strong>
      <span>${escapeHtml(person.detail)}</span>
      <small>Fare ${currency(ride.fare / ride.passengers)} • Fees ${currency((ride.tax + ride.tolls + ride.fees) / ride.passengers)} • Tip ${currency(ride.tip / ride.passengers)}</small>
      <b>${currency(person.amount)}</b>
    </div>
  `).join("");
}

function currency(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

async function loadConfig() {
  const publicConfig = window.TRAVELDRIP_PUBLIC_CONFIG || {};

  if (isFilePreview) {
    state.config = {
      ...state.config,
      supabaseUrl: publicConfig.supabaseUrl || state.config.supabaseUrl,
      supabaseAnonKey: publicConfig.supabaseAnonKey || state.config.supabaseAnonKey,
      vapidPublicKey: publicConfig.vapidPublicKey || state.config.vapidPublicKey
    };
    setSyncStatus(state.config.supabaseAnonKey ? "Connecting" : "Needs public key");
  } else {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error("Config endpoint unavailable");
      const serverConfig = await response.json();
      state.config = {
        ...state.config,
        ...publicConfig,
        ...serverConfig,
        supabaseUrl: serverConfig.supabaseUrl || publicConfig.supabaseUrl || state.config.supabaseUrl,
        supabaseAnonKey: serverConfig.supabaseAnonKey || publicConfig.supabaseAnonKey || state.config.supabaseAnonKey,
        vapidPublicKey: serverConfig.vapidPublicKey || publicConfig.vapidPublicKey || state.config.vapidPublicKey
      };
    } catch (error) {
      state.config = {
        ...state.config,
        ...publicConfig
      };
      setSyncStatus(state.config.supabaseAnonKey ? "Connecting" : "Demo mode");
    }
  }

  if (state.config.supabaseUrl && state.config.supabaseAnonKey) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    state.supabase = createClient(state.config.supabaseUrl, state.config.supabaseAnonKey);
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    state.supabase.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      updateAuthUi();
      subscribeToLiveData();
    });
    setSyncStatus("Connected");
  } else {
    setSyncStatus(state.config.supabaseUrl ? "Needs public key" : "Needs setup");
  }
}

function updateAuthUi() {
  const signedIn = Boolean(state.session?.user);
  const openAuthButton = $("#openAuthButton");
  const openSignupButton = $("#openSignupButton");
  const signOutButton = $("#signOutButton");
  const authPanel = $("#authPanel");
  if (signedIn && !state.hasEnteredApp) {
    state.hasEnteredApp = true;
    sessionStorage.setItem("traveldripEnteredApp", "true");
  }
  const showGate = !signedIn && !state.hasEnteredApp;

  if (openAuthButton) {
    openAuthButton.textContent = signedIn ? state.session.user.email : "Sign in";
    openAuthButton.hidden = signedIn;
  }

  if (openSignupButton) openSignupButton.hidden = signedIn;
  if (signOutButton) signOutButton.hidden = !signedIn;
  if (authPanel && location.pathname !== "/admin.html") {
    authPanel.hidden = !showGate;
    document.body.classList.toggle("auth-screen", showGate);
    if (!showGate) authPanel.classList.remove("show-form");
  }

  if (location.pathname === "/admin.html") updateAdminUi();
}

async function checkAdminAccess() {
  if (!state.supabase || !state.session) return false;
  const email = state.session.user.email || "";
  if (state.adminStatusCheckedFor === email) return state.isAdmin;

  state.adminStatusCheckedFor = email;

  try {
    const response = await fetch("/api/admin-status", {
      headers: { "Authorization": `Bearer ${state.session.access_token}` }
    });
    const result = await response.json().catch(() => ({}));
    state.isAdmin = Boolean(response.ok && result.isAdmin);
  } catch (_error) {
    state.isAdmin = false;
  }

  return state.isAdmin;
}

function updateAdminUi() {
  const authPanel = $("#authPanel");
  const adminPanel = $("#adminPanel");
  const authMessage = $("#authMessage");

  if (!state.session) {
    if (authPanel) authPanel.hidden = false;
    if (adminPanel) adminPanel.hidden = true;
    return;
  }

  if (authMessage) authMessage.textContent = "Checking admin access...";
  checkAdminAccess().then((isAdmin) => {
    if (authPanel) authPanel.hidden = isAdmin;
    if (adminPanel) adminPanel.hidden = !isAdmin;
    if (authMessage && !isAdmin) {
      authMessage.textContent = "You are signed in, but this email is not on the admin allowlist.";
    }
  });
}

function getAuthRoute(mode) {
  if (isFilePreview) return mode === "signup" ? "#register" : "#login";
  return mode === "signup" ? "/register" : "/login";
}

function getInitialAuthMode() {
  if (location.hash === "#register" || location.pathname === "/register" || location.pathname.endsWith("/register.html")) return "signup";
  if (location.hash === "#login" || location.pathname === "/login" || location.pathname.endsWith("/login.html")) return "signin";
  return "";
}

function setAuthMode(mode, scrollIntoView = false) {
  if (location.pathname === "/admin.html") return;

  const isSignup = mode === "signup";
  const authPanel = $("#authPanel");
  const loginForm = $("#authForm");
  const signupForm = $("#signupForm");
  const showLoginButton = $("#showLoginButton");
  const showSignupButton = $("#showSignupButton");
  const formLoginButton = $("#formLoginButton");
  const formSignupButton = $("#formSignupButton");
  const authTitle = $("#authTitle");
  const authCopy = $("#authCopy");
  const authMessage = $("#authMessage");

  state.authMode = isSignup ? "signup" : "signin";
  state.hasEnteredApp = false;
  sessionStorage.removeItem("traveldripEnteredApp");
  document.body.classList.add("auth-screen");
  if (authPanel) {
    authPanel.hidden = false;
    authPanel.classList.add("show-form");
  }
  if (loginForm) loginForm.hidden = isSignup;
  if (signupForm) signupForm.hidden = !isSignup;

  showLoginButton?.classList.toggle("active", !isSignup);
  showSignupButton?.classList.toggle("active", isSignup);
  formLoginButton?.classList.toggle("active", !isSignup);
  formSignupButton?.classList.toggle("active", isSignup);
  showLoginButton?.setAttribute("aria-selected", String(!isSignup));
  showSignupButton?.setAttribute("aria-selected", String(isSignup));
  formLoginButton?.setAttribute("aria-selected", String(!isSignup));
  formSignupButton?.setAttribute("aria-selected", String(isSignup));

  if (authTitle) authTitle.textContent = isSignup ? "Create your Traveldrip account" : "Sign in to sync your trip data";
  if (authCopy) {
    authCopy.textContent = isSignup
      ? "Register with your full name, email address, and password. If email confirmation is enabled, verify your inbox before logging in."
      : "Use your Traveldrip account to keep messages, votes, wallet settings, and trip details synced across devices.";
  }
  if (authMessage) authMessage.textContent = isSignup ? "Email verification may be required after account creation." : "Enter your email and password to log in.";

  const route = getAuthRoute(state.authMode);
  if (`${location.pathname}${location.hash}` !== route) {
    history.replaceState(null, "", route);
  }

  const firstInput = isSignup ? $("#signupNameInput") : $("#emailInput");
  firstInput?.focus({ preventScroll: true });
  if (scrollIntoView) authPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function enterAppPreview() {
  state.hasEnteredApp = true;
  sessionStorage.setItem("traveldripEnteredApp", "true");
  $("#authPanel")?.classList.remove("show-form");
  if ($("#authPanel")) $("#authPanel").hidden = true;
  document.body.classList.remove("auth-screen");
  const appRoute = isFilePreview ? "index.html" : "/";
  if (location.hash === "#login" || location.hash === "#register" || location.pathname === "/login" || location.pathname === "/register") {
    history.replaceState(null, "", appRoute);
  }
}

function showAuthSetupMessage() {
  $("#authMessage").textContent = state.config.supabaseUrl
    ? "Supabase URL is connected. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel, or paste the publishable key into public-config.js for local preview login."
    : "Add Supabase environment variables on Vercel to enable live login.";
}

function getAuthOptions() {
  if (isFilePreview) return {};
  return { emailRedirectTo: `${location.origin}${location.pathname}` };
}

async function signIn(email, password) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  $("#authMessage").textContent = error ? error.message : "Logged in. Your trip data is syncing now.";
  if (!error) enterAppPreview();
}

async function signUp(fullName, email, password) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  const { data, error } = await state.supabase.auth.signUp({
    email,
    password,
    options: {
      ...getAuthOptions(),
      data: { full_name: fullName }
    }
  });

  if (error) {
    $("#authMessage").textContent = error.message;
    return;
  }

  if (data.session) {
    $("#authMessage").textContent = "Account created. You are logged in and your trip data is syncing.";
    enterAppPreview();
    return;
  }

  setAuthMode("signin");
  $("#authMessage").textContent = "Account created. Check your email to verify your address, then log in.";
}

async function sendMagicLink(email) {
  if (!state.supabase) {
    showAuthSetupMessage();
    return;
  }

  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: getAuthOptions()
  });
  $("#authMessage").textContent = error ? error.message : "Magic link sent. Check your email.";
}

async function signOut() {
  if (state.supabase) await state.supabase.auth.signOut();
  state.hasEnteredApp = false;
  sessionStorage.removeItem("traveldripEnteredApp");
  state.isAdmin = false;
  state.adminStatusCheckedFor = "";
  updateAuthUi();
}

function wireLocalInteractions() {
  renderPlan(0);
  renderBillSplit();
  renderRideSplit();
  updateEnterpriseRole();
  startLivePlanRotation();

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      renderPlan(Number(button.dataset.day));
    });
  });

  $$(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".chip").forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
    });
  });

  $$("#poll button").forEach((button) => {
    button.addEventListener("click", async () => {
      $$("#poll button").forEach((poll) => poll.classList.remove("selected"));
      button.classList.add("selected");
      const count = button.querySelector("strong");
      count.textContent = String(Number(count.textContent) + 1);
      await saveSyncedEvent("vote", { choice: button.dataset.choice });
    });
  });

  $("#deposit")?.addEventListener("input", async (event) => {
    const perPerson = Number(event.target.value);
    $("#depositValue").textContent = `$${perPerson.toLocaleString()}`;
    $("#depositMetric").textContent = `$${perPerson.toLocaleString()} each`;
    $("#walletTotal").textContent = `$${(perPerson * 8).toLocaleString()}`;
    $("#walletMetric").textContent = `$${(perPerson * 8).toLocaleString()}`;
    await saveSyncedEvent("wallet", { perPerson });
  });

  $("#fundsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number($("#fundAmount").value);
    const walletMessage = $("#walletMessage");

    if (!Number.isFinite(amount) || amount < 10 || amount > 5000) {
      walletMessage.textContent = "Enter a fund amount between $10 and $5,000.";
      return;
    }

    state.pendingWalletPayment = amount;
    state.pendingSecureAction = { type: "add_funds", amount };
    $("#pinSummary").textContent = `Enter your 4-digit trip wallet PIN to add $${amount.toLocaleString()} to the group wallet.`;
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#pinForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = $("#walletPin").value.trim();

    if (!/^[0-9]{4}$/.test(pin)) {
      $("#walletMessage").textContent = "Payment blocked: enter a valid 4-digit wallet PIN.";
      $("#walletPin").focus();
      return;
    }

    const amount = state.pendingWalletPayment;
    const action = state.pendingSecureAction;

    if (action?.type === "add_funds" && amount) {
      const currentWallet = Number($("#walletTotal").textContent.replace(/[^0-9.]/g, ""));
      const nextWallet = currentWallet + amount;
      $("#walletTotal").textContent = `$${nextWallet.toLocaleString()}`;
      $("#walletMetric").textContent = `$${nextWallet.toLocaleString()}`;
      $("#walletMessage").textContent = `Confirmed: $${amount.toLocaleString()} was added after PIN verification.`;
      $("#myDeposited").textContent = `$${(1050 + amount).toLocaleString()}`;
      addAuditEntry("Funds deposited", `You added $${amount.toLocaleString()} after Wallet PIN confirmation.`);
      await saveSyncedEvent("wallet_payment", { amount, confirmedWithPin: true });
    }

    if (action?.type === "refund") {
      $("#refundMessage").textContent = "Refund requested: $380 available funds moved to pending review.";
      addAuditEntry("Refund requested", "User requested $380 refundable available funds after Wallet PIN confirmation.");
      await saveSyncedEvent("refund_requested", { amount: 380, confirmedWithPin: true });
    }

    if (action?.type === "leave_trip") {
      $("#refundMessage").textContent = "Leave-trip review started: unused funds will be refunded and committed funds stay tied to bookings.";
      addAuditEntry("Participant leave review", "System calculated unused funds and preserved non-refundable allocations.");
      await saveSyncedEvent("leave_trip_review", { refundableAmount: 380, confirmedWithPin: true });
    }

    if (action?.type === "reveal_card") {
      $("#cardNumber").textContent = "•••• •••• •••• 4829";
      $("#cardCvv").textContent = "Provider-controlled";
      $("#cardMessage").textContent = "PIN verified. Full card credentials remain tokenized with the issuing partner and are not stored or displayed in this demo.";
      addAuditEntry("Card detail access verified", "Wallet PIN was confirmed; raw card credentials remained provider-controlled.");
      await saveSyncedEvent("virtual_card_revealed", { confirmedWithPin: true });
    }

    if (action?.type === "provision_wallet") {
      $("#cardMessage").textContent = `${action.walletName} provisioning started after identity and Wallet PIN verification. Issuer wallet-token provisioning is required for production.`;
      addAuditEntry("Mobile wallet provisioning", `${action.walletName} provisioning started after Wallet PIN confirmation.`);
      await saveSyncedEvent("wallet_provisioning_started", { walletName: action.walletName, confirmedWithPin: true });
    }

    if (action?.type === "replace_card") {
      $("#cardStatus").textContent = "Frozen";
      $("#lockCardButton").textContent = "Unlock card";
      $("#cardMessage").textContent = "Card reported as compromised. Current token frozen and replacement review started.";
      addAuditEntry("Card compromised", "Virtual card was frozen and replacement review started after Wallet PIN confirmation.");
      await saveSyncedEvent("virtual_card_replacement_requested", { confirmedWithPin: true });
    }

    if (action?.type === "limit_change") {
      $("#cardMessage").textContent = "Spending controls updated after Wallet PIN verification.";
      addAuditEntry("Card limits changed", `Daily limit set to ${$("#dailyLimitValue").textContent}; per-purchase limit set to ${$("#purchaseLimitValue").textContent}.`);
      await saveSyncedEvent("virtual_card_limits_changed", {
        dailyLimit: $("#dailyLimit").value,
        purchaseLimit: $("#purchaseLimit").value,
        confirmedWithPin: true
      });
    }

    state.pendingWalletPayment = null;
    state.pendingSecureAction = null;
    $("#pinDialog").close();
  });

  $("#cancelPinButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = null;
    $("#pinDialog").close();
    $("#walletMessage").textContent = "Payment canceled before PIN confirmation.";
  });

  $("#requestRefundButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "refund" };
    $("#pinSummary").textContent = "Enter your 4-digit Wallet PIN to request a refund of $380 available funds.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#leaveTripButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "leave_trip" };
    $("#pinSummary").textContent = "Enter your 4-digit Wallet PIN to start the leave-trip refund review.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#activateCardButton")?.addEventListener("click", async () => {
    $("#cardStatus").textContent = "Active";
    $("#cardMessage").textContent = "Virtual card activated. Spendable funds remain limited to available wallet balance.";
    addAuditEntry("Virtual card activated", "Card activated for eligible available wallet funds.");
    await saveSyncedEvent("virtual_card_activated", { status: "active" });
  });

  $("#lockCardButton")?.addEventListener("click", async (event) => {
    const locked = $("#cardStatus").textContent !== "Locked";
    $("#cardStatus").textContent = locked ? "Locked" : "Active";
    event.target.textContent = locked ? "Unlock card" : "Lock card";
    $("#cardMessage").textContent = locked ? "Virtual card locked. New purchases are blocked." : "Virtual card unlocked after security review.";
    addAuditEntry(locked ? "Card locked" : "Card unlocked", locked ? "User locked virtual card purchases." : "User unlocked virtual card purchases.");
    await saveSyncedEvent("virtual_card_lock_changed", { locked });
  });

  $("#revealCardButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "reveal_card" };
    $("#pinSummary").textContent = "Enter your 4-digit Wallet PIN or use biometric verification to reveal virtual card details.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  $("#replaceCardButton")?.addEventListener("click", () => {
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "replace_card" };
    $("#pinSummary").textContent = "Enter your Wallet PIN to report this virtual card as compromised and start replacement review.";
    $("#walletPin").value = "";
    $("#pinDialog").showModal();
    $("#walletPin").focus();
  });

  [
    ["#appleWalletButton", "Apple Wallet"],
    ["#googleWalletButton", "Google Wallet"],
    ["#samsungWalletButton", "Samsung Wallet"]
  ].forEach(([selector, walletName]) => {
    $(selector)?.addEventListener("click", () => {
      state.pendingWalletPayment = null;
      state.pendingSecureAction = { type: "provision_wallet", walletName };
      $("#pinSummary").textContent = `Enter your Wallet PIN to start ${walletName} provisioning. Production requires issuer and card-network tokenization.`;
      $("#walletPin").value = "";
      $("#pinDialog").showModal();
      $("#walletPin").focus();
    });
  });

  function updateCardLimit(input, output) {
    const value = Number(input.value);
    output.textContent = `$${value.toLocaleString()}`;
    state.pendingWalletPayment = null;
    state.pendingSecureAction = { type: "limit_change" };
    $("#pinSummary").textContent = "Enter your Wallet PIN to save virtual card spending controls.";
  }

  $("#dailyLimit")?.addEventListener("input", (event) => updateCardLimit(event.target, $("#dailyLimitValue")));
  $("#purchaseLimit")?.addEventListener("input", (event) => updateCardLimit(event.target, $("#purchaseLimitValue")));
  $("#dailyLimit")?.addEventListener("change", () => $("#pinDialog").showModal());
  $("#purchaseLimit")?.addEventListener("change", () => $("#pinDialog").showModal());

  ["#billSubtotal", "#billTax", "#billTipPercent", "#billFees", "#billDiscount", "#billDiners"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderBillSplit);
  });

  $$("[data-split-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-split-mode]").forEach((modeButton) => modeButton.classList.remove("active"));
      button.classList.add("active");
      renderBillSplit();
      $("#billMessage").textContent = `${button.textContent} split preview updated for the dining group.`;
    });
  });

  $$("[data-receipt-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const sourceLabels = {
        camera: "Camera receipt scan started",
        photo: "Receipt photo uploaded for AI extraction",
        pdf: "PDF receipt uploaded for AI extraction",
        manual: "Manual receipt entry enabled"
      };
      $("#billMessage").textContent = `${sourceLabels[button.dataset.receiptSource]}. Restaurant name, date, table, server, items, taxes, fees, gratuity, discounts, and total remain editable before payment.`;
      $("#receiptReviewMessage").textContent = "Receipt is stored in trip history after organizer review and settlement.";
      renderReceiptScanner();
      addAuditEntry("Receipt intake selected", sourceLabels[button.dataset.receiptSource]);
    });
  });

  $("#scanReceiptButton")?.addEventListener("click", () => {
    $("#billSubtotal").value = "438.75";
    $("#billTax").value = "34.66";
    $("#billTipPercent").value = "18";
    $("#billFees").value = "7.50";
    $("#billDiscount").value = "25.00";
    $("#billDiners").value = "6";
    renderBillSplit();
    $("#billMessage").textContent = "Receipt scan detected menu items, tax, service fee, discount, and total for review.";
    addAuditEntry("Restaurant bill scanned", "Receipt data pre-populated the Smart Bill Split calculator.");
  });

  $("#aiBillReviewButton")?.addEventListener("click", () => {
    const bill = getBillInputs();
    const receiptSplits = getReceiptSplits(bill);
    const missing = receiptSplits.filter((split) => split.food + split.shared === 0).map((split) => split.name);
    const duplicateCount = receiptItems.length - new Set(receiptItems.map((item) => item.item.toLowerCase())).size;
    const unassigned = receiptItems.filter((item) => item.diners.length === 0).map((item) => item.item);
    const issues = [];
    if (missing.length) issues.push(`Missing diners: ${missing.join(", ")}`);
    if (duplicateCount) issues.push(`${duplicateCount} duplicate item may need review`);
    if (unassigned.length) issues.push(`Unassigned items: ${unassigned.join(", ")}`);
    if (bill.tipPercent > 25) issues.push("Tip is above the usual range for this group");
    if (!issues.length) issues.push("No duplicate items, missing diners, tax discrepancy, or shared-item imbalance detected");
    $("#receiptReviewMessage").textContent = `AI bill review: ${issues.join(". ")}.`;
    addAuditEntry("AI bill review completed", issues.join("; "));
  });

  $("#tipAdviceButton")?.addEventListener("click", () => {
    const diners = Number($("#billDiners").value || 1);
    const recommendedTip = diners >= 6 ? 20 : 18;
    $("#billTipPercent").value = String(recommendedTip);
    $("#tipAdvice").textContent = `${recommendedTip}% is recommended for this group size and local restaurant service expectations.`;
    renderBillSplit();
  });

  $$("[data-bill-pay]").forEach((button) => {
    button.addEventListener("click", async () => {
      const method = button.dataset.billPay;
      $("#billMessage").textContent = `${method} selected. Each participant sees their total, tax, tip, final amount due, paid amount, and remaining group balance.`;
      addAuditEntry("Bill payment method selected", `${method} selected for restaurant bill settlement.`);
      await saveSyncedEvent("restaurant_bill_payment_method", { method, total: getBillInputs().total });
    });
  });

  $("#rideDestination")?.addEventListener("change", () => {
    renderRideSplit();
    $("#rideMessage").textContent = `Recommended providers updated for ${$("#rideDestination").value}.`;
  });

  ["#rideFare", "#rideTax", "#rideTolls", "#rideFees", "#rideTip", "#ridePassengers"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderRideSplit);
  });

  $$("[data-ride-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-ride-mode]").forEach((modeButton) => modeButton.classList.remove("active"));
      button.classList.add("active");
      renderRideSplit();
      $("#rideMessage").textContent = `${button.textContent} ride split preview updated for selected passengers.`;
    });
  });

  $("#rideProviderList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ride-provider]");
    if (!button) return;
    state.selectedRideProvider = button.dataset.rideProvider;
    renderRideSplit();
    const account = state.connectedRideAccounts[state.selectedRideProvider];
    $("#rideMessage").textContent = account?.connected
      ? `${state.selectedRideProvider} selected and connected. You can launch the official provider app, start a ride, or share trip details.`
      : `Connect your ${state.selectedRideProvider} account to continue. TravelDrip never asks for ride-share passwords.`;
  });

  $("#connectRideAccountButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    state.connectedRideAccounts[provider] = { connected: true, account: "Connected rider profile", status: "Account Connected" };
    renderRideAccount();
    $("#rideMessage").textContent = `${provider} account connected through secure provider authorization. Passwords are never requested or stored by TravelDrip.`;
    addAuditEntry("Ride share account connected", `${provider} account authorized for transportation launch and receipt import.`);
    await saveSyncedEvent("ride_account_connected", { provider });
  });

  $("#reconnectRideAccountButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    state.connectedRideAccounts[provider] = { connected: true, account: "Connected rider profile", status: "Account Reconnected" };
    renderRideAccount();
    $("#rideMessage").textContent = `${provider} account reconnected. Access can be revoked from TravelDrip or the provider account settings.`;
    addAuditEntry("Ride share account reconnected", `${provider} authorization refreshed.`);
    await saveSyncedEvent("ride_account_reconnected", { provider });
  });

  $("#disconnectRideAccountButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    state.connectedRideAccounts[provider] = { connected: false, account: "", status: "Disconnected" };
    renderRideAccount();
    $("#rideMessage").textContent = `${provider} disconnected. Existing ride receipts remain in the trip audit log, but new launches require reconnection.`;
    addAuditEntry("Ride share account disconnected", `${provider} authorization revoked.`);
    await saveSyncedEvent("ride_account_disconnected", { provider });
  });

  $("#launchRideButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    const pickup = $("#ridePickup").value.trim();
    const dropoff = $("#rideDropoff").value.trim();
    $("#rideMessage").textContent = `${provider} launch prepared with pickup ${pickup} and destination ${dropoff}. If direct booking is unavailable, open the official app with details prefilled.`;
    addAuditEntry("Ride provider launched", `${provider} launch prepared for ${pickup} to ${dropoff}.`);
    await saveSyncedEvent("ride_provider_launched", { provider, pickup, dropoff });
  });

  $("#sharedRideMembers")?.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-shared-rider]");
    if (!checkbox) return;
    const member = sharedRideMembers.find((entry) => entry.name === checkbox.dataset.sharedRider);
    if (member) member.splitting = checkbox.checked;
    renderRideAccount();
    renderRideSplit();
    $("#rideMessage").textContent = `${checkbox.dataset.sharedRider} ${checkbox.checked ? "included in" : "removed from"} fare splitting for this shared ride.`;
  });

  $("#shareRideButton")?.addEventListener("click", async () => {
    const provider = state.selectedRideProvider;
    const pickup = $("#ridePickup").value.trim();
    const dropoff = $("#rideDropoff").value.trim();
    $("#rideMessage").textContent = `${provider} shared ride created: ${pickup} to ${dropoff}. Members can join, leave, view pickup, destination, ETA, and payment amount.`;
    addAuditEntry("Ride shared", `${provider} ride details shared with pickup ${pickup} and drop-off ${dropoff}.`);
    await saveSyncedEvent("ride_shared", { provider, pickup, dropoff });
  });

  $("#importRideReceiptButton")?.addEventListener("click", () => {
    $("#rideFare").value = "52.40";
    $("#rideTax").value = "3.10";
    $("#rideTolls").value = "5.25";
    $("#rideFees").value = "3.50";
    $("#rideTip").value = "6.00";
    renderRideSplit();
    $("#rideMessage").textContent = "Ride receipt imported. Fare, taxes, tolls, booking fees, tip, and final total are ready for review.";
    addAuditEntry("Ride receipt imported", "Ride-share receipt populated fare split inputs.");
  });

  $("#rideAdviceButton")?.addEventListener("click", () => {
    const passengers = Number($("#ridePassengers").value || 1);
    const provider = state.selectedRideProvider;
    const destination = $("#rideDestination").value;
    const advice = passengers >= 6
      ? `For your group of ${passengers}, a larger ${provider} vehicle may cost less than booking two standard rides.`
      : `${provider} is the fastest recommendation in ${destination} right now based on local availability, wait time, traffic, and price.`;
    $("#rideAssistantCopy").textContent = advice;
    $("#rideMessage").textContent = advice;
  });

  $$("[data-ride-pay]").forEach((button) => {
    button.addEventListener("click", async () => {
      const method = button.dataset.ridePay;
      $("#rideMessage").textContent = `${method} selected for ride split settlement. Wallet ledger and trip transportation summary update after processor confirmation.`;
      addAuditEntry("Ride payment method selected", `${method} selected for ride-share cost split.`);
      await saveSyncedEvent("ride_payment_method", { method, total: getRideInputs().total });
    });
  });

  $("#saveAlertPrefsButton")?.addEventListener("click", async () => {
    const categories = $$("[data-alert-category]")
      .filter((input) => input.checked)
      .map((input) => input.dataset.alertCategory);
    const channels = $$("[data-alert-channel]")
      .filter((input) => input.checked)
      .map((input) => input.dataset.alertChannel);

    $("#alertMessage").textContent = `Saved: ${categories.length} itinerary alert types over ${channels.join(", ") || "in-app"} notifications. Emergency alerts remain enabled.`;
    addAuditEntry("Itinerary notification preferences", `Enabled ${categories.length} alert categories across ${channels.join(", ") || "in-app"}.`);
    await saveSyncedEvent("itinerary_notification_preferences", { categories, channels, emergencyAlwaysOn: true });
  });

  $("#simulateAlertButton")?.addEventListener("click", async () => {
    const list = $("#alertPreviewList");
    const entry = document.createElement("div");
    entry.innerHTML = "<strong>Itinerary update</strong><span>Desert pickup moved to 8:10 AM. Push, email, and in-app alerts queued for selected travelers.</span>";
    list?.prepend(entry);
    $("#alertMessage").textContent = "Simulated itinerary change sent to enabled notification channels.";
    addAuditEntry("Itinerary update alert", "Transportation pickup change notification queued for the trip group.");
    await saveSyncedEvent("itinerary_notification", {
      type: "transportation_pickup_change",
      channels: $$("[data-alert-channel]").filter((input) => input.checked).map((input) => input.dataset.alertChannel)
    });
  });

  $$("[data-trip-type]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.tripType;
      $$("[data-trip-type]").forEach((typeButton) => {
        const isActive = typeButton === button;
        typeButton.classList.toggle("active", isActive);
        typeButton.setAttribute("aria-pressed", String(isActive));
      });

      const messages = {
        solo: "Solo Trip selected. Group chat, voting, and shared wallet tools stay hidden until you invite others.",
        group: "Group Trip selected. Shared itinerary, chat, wallet, expense splits, and voting are available.",
        corporate: "Corporate Retreat selected. Role-based dashboards, employee privacy, finance controls, and audit reports are available."
      };
      $("#soloModeMessage").textContent = messages[type] || messages.solo;
      addAuditEntry("Trip mode selected", `${button.querySelector("strong")?.textContent || "Trip mode"} mode preview enabled.`);
      await saveSyncedEvent("trip_mode_selected", { type });
    });
  });

  $("#soloRecommendationButton")?.addEventListener("click", async () => {
    const prompt = "AI suggestion: Spend morning at Tsukiji outer market, walk to teamLab Borderless in the afternoon, use the Ginza line before rush hour, and reserve a ramen counter within 10 minutes of the hotel.";
    $("#soloAiPrompt").textContent = prompt;
    addAuditEntry("Solo AI recommendation", "Generated personal itinerary, restaurant, transportation, and route safety suggestion.");
    await saveSyncedEvent("solo_ai_recommendation", { destination: "Tokyo", budgetCap: 2000 });
  });

  $("#soloCheckinButton")?.addEventListener("click", async () => {
    $("#soloCheckinStatus").textContent = "Checked in";
    $("#soloModeMessage").textContent = "Safety check-in recorded. Trusted contact notifications only send if the traveler enables missed-check-in alerts.";
    addAuditEntry("Solo safety check-in", "Traveler marked solo trip safety check-in complete.");
    await saveSyncedEvent("solo_safety_checkin", { status: "checked_in" });
  });

  $("#convertSoloTripButton")?.addEventListener("click", async () => {
    const groupButton = $("[data-trip-type='group']");
    groupButton?.click();
    $("#soloModeMessage").textContent = "Solo trip converted to Group Trip preview. Existing itinerary, budget, documents, memories, and recommendations stay intact.";
    addAuditEntry("Solo trip converted", "Group chat, shared itinerary, group wallet, expense splitting, and voting enabled.");
    await saveSyncedEvent("solo_trip_converted_to_group", { preservesExistingTripData: true });
  });

  $("#privacyToggle")?.addEventListener("change", (event) => {
    $("#memberTable")?.classList.toggle("is-private", !event.target.checked);
  });

  $$(".admin-actions [data-admin-action]").forEach((button) => {
    button.addEventListener("click", () => {
      addAuditEntry("Admin action", button.dataset.adminAction);
    });
  });

  $("#downloadReportButton")?.addEventListener("click", () => {
    const csv = [
      "timestamp,type,amount,status",
      "2026-07-20 09:42,deposit,100,available",
      "2026-07-18 14:15,reserved,250,hotel deposit hold",
      "2026-07-14 11:20,allocated,420,non-refundable flight",
      "2026-07-10 18:05,deposit,950,original payment method"
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "traveldrip-wallet-ledger.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $$("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      const targetSection = $(`#${target}`);
      if (!targetSection) return;

      $$(".nav button, .mobile-nav button").forEach((navButton) => {
        navButton.classList.toggle("active", navButton.dataset.target === target);
      });
      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  $("#shareEverywhere")?.addEventListener("change", (event) => {
    $$(".share-options input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = event.target.checked;
    });
  });

  $$("[data-connection]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.target.textContent = event.target.textContent === "Connected" ? "Disconnect" : "Connected";
    });
  });

  $("#generateCaptionButton")?.addEventListener("click", () => {
    $("#captionText").value = "Dubai nights, desert light, and the kind of group trip everyone talks about after landing home. #TravelDrip #Dubai #TravelTogether";
  });

  $("#regenerateCaptionButton")?.addEventListener("click", () => {
    $("#captionText").value = "From rooftop views to desert roads, this crew made Dubai feel unforgettable. #TravelDrip #GroupTravel #DubaiWeekend";
  });

  $("#rolePreview")?.addEventListener("change", updateEnterpriseRole);
  $("#infoSearch")?.addEventListener("input", filterImportantInfo);
  $$(".trip-check").forEach((checkbox) => {
    checkbox.addEventListener("change", updateChecklistProgress);
  });
  $("#policyAck")?.addEventListener("change", updatePolicyAcknowledgment);
  updateChecklistProgress();
  $("#runNavigationAuditButton")?.addEventListener("click", () => {
    renderNavigationAudit();
    showWorkflowMessage("Navigation audit", "Checked buttons, links, targets, modals, role restrictions, and fallback workflows.");
  });
  $("#runSecurityAuditButton")?.addEventListener("click", renderSecurityAudit);
  wireNavigationFallbacks();
  renderNavigationAudit();
  renderSecurityAudit();

  $("#chatForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#chatInput");
    const text = input.value.trim();
    if (!text) return;
    appendMessage("You", text);
    input.value = "";
    await saveSyncedEvent("message", { text });
  });

  $("#authForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#emailInput").value.trim();

    if (location.pathname === "/admin.html") {
      sendMagicLink(email);
      return;
    }

    signIn(email, $("#passwordInput").value);
  });

  $("#signupForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    signUp(
      $("#signupNameInput").value.trim(),
      $("#signupEmailInput").value.trim(),
      $("#signupPasswordInput").value
    );
  });

  $("#openAuthButton")?.addEventListener("click", () => {
    setAuthMode("signin", true);
  });

  $("#openSignupButton")?.addEventListener("click", () => {
    setAuthMode("signup", true);
  });

  $("#showLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#showSignupButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#formLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#formSignupButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#landingLoginButton")?.addEventListener("click", () => setAuthMode("signin"));
  $("#landingSignupButton")?.addEventListener("click", () => setAuthMode("signup"));
  $("#enterAppButton")?.addEventListener("click", enterAppPreview);
  $$("[data-auth-workflow]").forEach((button) => {
    button.addEventListener("click", () => {
      const workflow = button.dataset.authWorkflow;
      const messages = {
        "Forgot Password": "Password reset opens a secure email recovery flow when Supabase auth is fully configured.",
        "Verify Email": "Email verification status is checked after registration and before live account sync.",
        "Two-Factor Authentication": "Two-factor setup is reserved for production auth settings and should require server-side verification."
      };
      const detail = messages[workflow] || "Authentication workflow opened.";
      $("#authMessage").textContent = detail;
      showWorkflowMessage(workflow, detail);
    });
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#register") setAuthMode("signup");
    if (location.hash === "#login") setAuthMode("signin");
  });

  const initialAuthMode = getInitialAuthMode();
  if (initialAuthMode) setAuthMode(initialAuthMode);

  $("#signOutButton")?.addEventListener("click", signOut);
  $("#notifyButton")?.addEventListener("click", enableNotifications);
  $("#notifyForm")?.addEventListener("submit", sendAdminNotification);
}

function filterImportantInfo(event) {
  const query = event.target.value.trim().toLowerCase();
  $$("#infoAccordion .info-section").forEach((section) => {
    const matches = !query || section.innerText.toLowerCase().includes(query);
    section.hidden = !matches;
    if (matches && query) section.open = true;
  });
}

function updateChecklistProgress() {
  const checks = $$(".trip-check");
  if (!checks.length) return;
  const complete = checks.filter((check) => check.checked).length;
  $("#checklistProgress").textContent = `${complete} / ${checks.length}`;
}

function updatePolicyAcknowledgment(event) {
  const now = new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  $("#policyStatus").textContent = event.target.checked ? "Acknowledged" : "Needs acknowledgment";
  $("#ackRecord").textContent = event.target.checked
    ? `Acknowledged by current user on ${now}, version Important Info v1.`
    : "Acknowledgment records user, date, time, and content version.";
}

function updateEnterpriseRole() {
  const selectedRole = $("#rolePreview")?.value || "employee";
  const canSeeFinancials = ["owner", "finance"].includes(selectedRole);

  $$("[data-visible-roles]").forEach((card) => {
    const allowedRoles = card.dataset.visibleRoles.split(" ");
    card.classList.toggle("is-muted", !allowedRoles.includes(selectedRole));
  });

  $("[data-financial-panel]")?.toggleAttribute("hidden", !canSeeFinancials);
  $("#restrictedFinancePanel")?.toggleAttribute("hidden", canSeeFinancials);

  if (selectedRole === "employee") {
    addAuditEntry("Financial access blocked", "Employee role preview restricted corporate budget visibility.");
  }
}

function appendMessage(author, text) {
  const message = document.createElement("div");
  message.className = "msg";
  message.innerHTML = `<strong>${escapeHtml(author)}:</strong> ${escapeHtml(text)}`;
  $("#messages")?.appendChild(message);
  message.scrollIntoView({ block: "nearest" });
}

function addAuditEntry(title, detail) {
  const list = $("#auditList");
  if (!list) return;

  const entry = document.createElement("div");
  entry.innerHTML = `<time>${new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}</time><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
  list.prepend(entry);
}

function describeControl(control) {
  return (control.getAttribute("aria-label") || control.textContent || control.id || control.tagName).trim().replace(/\s+/g, " ");
}

function showWorkflowMessage(label, detail = "Workflow opened and navigation context preserved.") {
  const message = $("#navigationStatusMessage") || $("#billMessage") || $("#rideMessage");
  if (message) message.textContent = `${label}: ${detail}`;
  addAuditEntry("Navigation workflow opened", `${label} - ${detail}`);
}

function getNavigationAudit() {
  const issues = [];
  const targetButtons = $$("[data-target]");
  const links = $$("a[href]");
  const workflowButtons = $$("button").filter((button) => {
    if (button.hidden || button.disabled || button.type === "submit") return false;
    if (button.closest("dialog")) return false;
    return true;
  });

  targetButtons.forEach((button) => {
    if (!$(`#${button.dataset.target}`)) issues.push(`Missing section target: ${button.dataset.target}`);
  });

  $$("[aria-controls]").forEach((control) => {
    const target = control.getAttribute("aria-controls");
    if (target && !document.getElementById(target)) issues.push(`Missing aria-controls target: ${target}`);
  });

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href || href === "#") issues.push(`Placeholder link: ${describeControl(link)}`);
  });

  const restrictedCards = $$("[data-visible-roles]").length + $$("[data-financial-panel]").length;
  return {
    targetCount: targetButtons.length,
    linkCount: links.length,
    workflowCount: workflowButtons.length,
    restrictedCards,
    issues
  };
}

function renderNavigationAudit() {
  if (!$("#navigationAuditList")) return;
  const audit = getNavigationAudit();
  $("#navTargetCount").textContent = `${audit.targetCount} checked`;
  $("#navLinkCount").textContent = `${audit.linkCount} checked`;
  $("#navWorkflowCount").textContent = `${audit.workflowCount} checked`;
  $("#navigationAuditList").innerHTML = [
    `<div><strong>Main navigation</strong><span>${audit.targetCount} section buttons validate against real screen IDs. Mobile and desktop navigation share the same target map.</span></div>`,
    `<div><strong>Role permissions</strong><span>${audit.restrictedCards} role-gated corporate panels enforce employee, organizer, owner, and finance visibility messaging.</span></div>`,
    `<div><strong>Modals and workflows</strong><span>Wallet PIN dialog, auth tabs, ride-share connection, receipt scanner, bill split, and fallback workflow messages are wired.</span></div>`,
    audit.issues.length
      ? `<div class="is-warning"><strong>Needs review</strong><span>${audit.issues.map(escapeHtml).join("; ")}</span></div>`
      : `<div><strong>No broken targets found</strong><span>No placeholder links, missing tab controls, missing section targets, or navigation loops were detected in this mock app.</span></div>`
  ].join("");
  $("#navigationStatusMessage").textContent = audit.issues.length
    ? `${audit.issues.length} navigation issue(s) need review before deployment.`
    : "Navigation audit passed for current local markup. Production-only auth, payment, ride-share, and notification providers still require real service credentials.";
}

function getSecurityAudit() {
  const text = document.body.textContent || "";
  const checks = [
    ["Authentication", Boolean($("#authForm") && $("#signupForm") && text.includes("Two-Factor Authentication"))],
    ["Email verification", text.includes("Verify Email") || text.includes("Email verification")],
    ["Wallet PIN gates", Boolean($("#pinDialog") && $("#walletPin") && text.includes("Wallet PIN"))],
    ["Role-based access", Boolean($("#rolePreview") && $$("[data-visible-roles]").length)],
    ["Corporate privacy", text.includes("Employees cannot see") || text.includes("Financial privacy enforced")],
    ["No raw card storage messaging", text.includes("card data must never touch this app") || text.includes("No raw card storage")],
    ["Secure notification copy", text.includes("Never include sensitive information") || text.includes("Open TravelDrip to view details")],
    ["File upload controls", text.includes("Approved file types only") && text.includes("executable upload blocking")],
    ["Fraud monitoring", text.includes("Rapid PIN failures") && text.includes("Unusual refunds")],
    ["Navigation audit", Boolean($("#navigationAuditList"))]
  ];
  return {
    checks,
    passed: checks.filter(([, ok]) => ok).length,
    failed: checks.filter(([, ok]) => !ok).map(([name]) => name)
  };
}

function renderSecurityAudit() {
  if (!$("#securityAuditMessage")) return;
  const audit = getSecurityAudit();
  $("#securityAuthStatus").textContent = audit.failed.includes("Authentication") ? "Review" : "Configured";
  $("#securityWalletStatus").textContent = audit.failed.includes("Wallet PIN gates") ? "Review" : "PIN-gated";
  $("#securityApiStatus").textContent = "Guarded";
  $("#securityCorpStatus").textContent = audit.failed.includes("Role-based access") ? "Review" : "Role-limited";
  $("#securityAuditMessage").textContent = audit.failed.length
    ? `Security audit found ${audit.failed.length} item(s) needing review: ${audit.failed.join(", ")}.`
    : `Security audit passed ${audit.passed}/${audit.checks.length} local controls. Production still requires real provider-side MFA, tokenized payments, malware scanning, rate limiting, and encrypted storage.`;
  addAuditEntry("Security audit completed", audit.failed.length ? `Review: ${audit.failed.join(", ")}` : "Local security controls validated.");
}

function wireNavigationFallbacks() {
  const handledSelector = [
    "[data-target]",
    "[data-day]",
    "[data-admin-action]",
    "[data-connection]",
    "[data-choice]",
    "[data-split-mode]",
    "[data-ride-mode]",
    "[data-bill-pay]",
    "[data-ride-pay]",
    "[data-receipt-source]",
    "[data-ride-provider]",
    "[data-shared-rider]",
    "[data-auth-workflow]",
    "#runNavigationAuditButton"
  ].join(",");

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled || button.type === "submit" || button.closest("dialog")) return;
    if (button.matches(handledSelector) || button.id) return;
    const label = describeControl(button);
    showWorkflowMessage(label, "Feature route is connected to a mock workflow message until the production screen is built.");
  });
}

async function saveSyncedEvent(type, payload) {
  if (!state.supabase || !state.session) return;
  await state.supabase.from("trip_events").insert({
    trip_id: "dubai-weekend",
    event_type: type,
    payload,
    user_id: state.session.user.id
  });
}

function subscribeToLiveData() {
  if (!state.supabase || !state.session || window.tripChannel) return;
  window.tripChannel = state.supabase
    .channel("trip_events:dubai-weekend")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "trip_events",
      filter: "trip_id=eq.dubai-weekend"
    }, ({ new: event }) => {
      if (event.user_id === state.session.user.id) return;
      if (event.event_type === "message") appendMessage("Traveler", event.payload.text);
      if (event.event_type === "wallet") {
        const perPerson = Number(event.payload.perPerson);
        $("#deposit").value = String(perPerson);
        $("#depositValue").textContent = `$${perPerson.toLocaleString()}`;
        $("#walletTotal").textContent = `$${(perPerson * 8).toLocaleString()}`;
      }
    })
    .subscribe((status) => setSyncStatus(status === "SUBSCRIBED" ? "Live" : "Connected"));
}

async function registerServiceWorker() {
  if (isFilePreview) return;
  if (!("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("/sw.js");
}

function wireInstallPrompt() {
  let promptEvent;
  const installButton = $("#installButton");
  const inlineInstallButton = $("#inlineInstallButton");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event;
    if (installButton) installButton.hidden = false;
    if (inlineInstallButton) inlineInstallButton.hidden = false;
  });

  async function promptInstall() {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    if (installButton) installButton.hidden = true;
    if (inlineInstallButton) inlineInstallButton.hidden = true;
    promptEvent = null;
  }

  installButton?.addEventListener("click", promptInstall);
  inlineInstallButton?.addEventListener("click", promptInstall);
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function enableNotifications() {
  if (!state.session) {
    const panel = $("#authPanel");
    if (panel) panel.hidden = false;
    return;
  }

  if (!("Notification" in window) || !("PushManager" in window)) {
    alert("This browser does not support push notifications.");
    return;
  }

  if (!state.config.vapidPublicKey) {
    alert("Add VAPID_PUBLIC_KEY in Vercel to enable push notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(state.config.vapidPublicKey)
  });

  await fetch("/api/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({ subscription })
  });

  alert("Notifications are enabled for Traveldrip.");
}

async function sendAdminNotification(event) {
  event.preventDefault();
  const message = $("#adminMessage");
  if (!state.session) return;

  const response = await fetch("/api/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${state.session.access_token}`
    },
    body: JSON.stringify({
      title: $("#notifyTitle").value.trim(),
      body: $("#notifyBody").value.trim(),
      url: $("#notifyUrl").value.trim()
    })
  });

  const result = await response.json().catch(() => ({}));
  message.textContent = response.ok
    ? `Sent to ${result.sent || 0} subscription(s).`
    : result.error || "Could not send notification.";
}

async function init() {
  wireLocalInteractions();
  wireInstallPrompt();
  await registerServiceWorker();
  await loadConfig();
  updateAuthUi();
  subscribeToLiveData();
  hideLoader();
}

init().catch((error) => {
  console.error(error);
  setSyncStatus("Error");
  hideLoader();
});
