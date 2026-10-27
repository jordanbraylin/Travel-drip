let quickPlanStep = 0;
let quickPlanOwner = null;
let quickPlanTransferred = false;
const quickPlanTypes = ["solo", "group", "special_event", "corporate", "cruise"];
const quickPlanVibes = ["Food", "Beaches", "Nature", "Culture", "Relaxation", "Nightlife"];
const quickPlanFields = { destination: "letsPlanDestinationInput", start: "letsPlanStartDateInput", end: "letsPlanEndDateInput", travelers: "letsPlanTravelersInput", type: "letsPlanTypeInput", budget: "letsPlanBudgetInput", notes: "letsPlanInterestsInput" };

function quickPlanStorageKey() {
  return state.session?.user?.id ? `traveldripQuickPlan:${state.session.user.id}` : null;
}

function readQuickPlanningDraft() {
  const key = quickPlanStorageKey();
  if (!key) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved || saved.version !== 1 || typeof saved.fields !== "object" || !saved.fields) return null;
    return saved;
  } catch { return null; }
}

function resetQuickPlanningSession() {
  document.querySelector("#letsPlanDialog")?.close();
  document.querySelector("#letsPlanForm")?.reset();
  quickPlanStep = 0;
  quickPlanOwner = null;
  quickPlanTransferred = false;
}

function renderQuickPlanningStep({ focus = false } = {}) {
  const dialog = document.querySelector("#letsPlanDialog");
  if (!dialog) return;
  dialog.querySelectorAll("[data-quick-plan-step]").forEach((section) => {
    section.hidden = Number(section.dataset.quickPlanStep) !== quickPlanStep;
    section.inert = section.hidden;
  });
  dialog.querySelectorAll("[data-quick-plan-indicator]").forEach((item) => {
    if (Number(item.dataset.quickPlanIndicator) === quickPlanStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
    item.classList.toggle("complete", Number(item.dataset.quickPlanIndicator) < quickPlanStep);
  });
  document.querySelector("#letsPlanDialogTitle").textContent = ["Where shall we go?", "Make it a date.", "Your kind of fun."][quickPlanStep];
  document.querySelector("#quickPlanNextButton").textContent = ["Next: the details", "Next: the fun part", "Review my trip"][quickPlanStep];
  document.querySelector("#quickPlanBackButton").hidden = quickPlanStep === 0;
  document.querySelector("#letsPlanDialogMessage").textContent = "";
  updateQuickPlanningSummary();
  if (focus) dialog.querySelector(`[data-quick-plan-step="${quickPlanStep}"] input`)?.focus();
}

function prepareQuickPlanning() {
  const owner = state.session?.user?.id || "guest";
  if (quickPlanOwner !== owner) {
    document.querySelector("#letsPlanForm")?.reset();
    quickPlanOwner = owner;
    quickPlanStep = 0;
    const draft = readQuickPlanningDraft();
    if (draft) {
      for (const [key, id] of Object.entries(quickPlanFields)) {
        const input = document.getElementById(id);
        if (input) input.value = String(draft.fields[key] ?? "").slice(0, key === "notes" ? 2000 : 160);
      }
      const type = document.querySelector("#letsPlanTypeInput").value;
      document.querySelectorAll('[name="quickPlanType"]').forEach((input) => { input.checked = input.value === type; });
      document.querySelectorAll('[name="quickPlanVibe"]').forEach((input) => { input.checked = Array.isArray(draft.vibes) && draft.vibes.includes(input.value); });
      quickPlanStep = Number.isInteger(draft.step) ? Math.max(0, Math.min(2, draft.step)) : 0;
    }
  }
  renderQuickPlanningStep();
}

function updateQuickPlanningSummary() {
  const output = document.querySelector("#quickPlanSummary");
  if (!output) return;
  const destination = document.querySelector("#letsPlanDestinationInput").value.trim();
  const travelers = document.querySelector("#letsPlanTravelersInput").value;
  const date = (id) => {
    const value = document.getElementById(id).value;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
  };
  const budget = document.querySelector("#letsPlanBudgetInput").value;
  const pieces = [destination, `${travelers || 1} traveler${Number(travelers) === 1 ? "" : "s"}`, [date("letsPlanStartDateInput"), date("letsPlanEndDateInput")].filter(Boolean).join(" to ")];
  if (budget) pieces.push(`${Number(budget).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} total budget`);
  output.textContent = pieces.filter(Boolean).join(" · ");
}

function validateQuickPlanningStep() {
  const message = document.querySelector("#letsPlanDialogMessage");
  const ids = quickPlanStep === 0 ? ["letsPlanDestinationInput"] : quickPlanStep === 1 ? ["letsPlanStartDateInput", "letsPlanEndDateInput", "letsPlanTravelersInput"] : ["letsPlanBudgetInput"];
  for (const id of ids) {
    const input = document.getElementById(id);
    if (!input.checkValidity()) { input.closest?.("details")?.setAttribute("open", ""); input.reportValidity(); return false; }
  }
  if (quickPlanStep === 0 && (!document.querySelector("#letsPlanDestinationInput").value.trim() || !quickPlanTypes.includes(document.querySelector("#letsPlanTypeInput").value))) {
    message.textContent = "Add a destination and choose who's coming along.";
    return false;
  }
  if (quickPlanStep === 1 && document.querySelector("#letsPlanEndDateInput").value < document.querySelector("#letsPlanStartDateInput").value) {
    message.textContent = "Your end date needs to be on or after your start date.";
    return false;
  }
  return true;
}

function clearQuickPlanningDraft() {
  if (!quickPlanTransferred || quickPlanOwner !== state.session?.user?.id) return;
  try { const key = quickPlanStorageKey(); if (key) localStorage.removeItem(key); } catch { /* The saved trip remains available from the server. */ }
  resetQuickPlanningSession();
}

function getQuickPlanningInterests() {
  const vibes = Array.from(document.querySelectorAll('[name="quickPlanVibe"]:checked')).map((input) => input.value);
  const notes = document.querySelector("#letsPlanInterestsInput")?.value || "";
  return [...new Set([...vibes, ...notes.split(",").map((value) => value.trim()).filter(Boolean)])].join(", ");
}

function renderPlanningStudio() {
  const list = document.querySelector("#planningStudioTrips");
  if (!list) return;
  const draft = readQuickPlanningDraft();
  const draftRow = document.querySelector("#planningStudioDraft");
  draftRow.hidden = !draft;
  document.querySelector("#planningStudioDraftTitle").textContent = draft?.fields?.destination ? `Your idea for ${String(draft.fields.destination).slice(0, 160)}` : "Your unfinished plan";
  list.replaceChildren();
  const trips = state.session?.user ? state.accountData.trips || [] : [];
  for (const trip of trips) {
    const item = document.createElement("article");
    item.className = "planning-saved-trip";
    const status = document.createElement("span");
    status.className = "planning-trip-status";
    status.textContent = String(trip.status || "draft").replaceAll("_", " ");
    const title = document.createElement("h3");
    title.textContent = trip.title || "Untitled trip";
    const destination = document.createElement("p");
    destination.textContent = trip.destination || "Destination not added yet";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open plan";
    open.className = "ghost-button";
    open.addEventListener("click", async () => {
      open.disabled = true;
      try { await selectAccountTrip(trip.id); navigateSafely("itineraryAlerts", { updateHistory: true }); }
      finally { open.disabled = false; }
    });
    item.append(status, title, destination, open);
    list.append(item);
  }
  document.querySelector("#planningStudioEmpty").hidden = trips.length > 0;
  document.querySelector("#planningStudioEmpty").textContent = state.accountData.loading ? "Loading your saved trips..." : "Your next adventure belongs here. Start a plan, then save your trip when you're ready.";
}

function initializePlanningStudio() {
  const form = document.querySelector("#letsPlanForm");
  const hub = document.querySelector("#letsPlan");
  if (!form || !hub || hub.dataset.studioReady) return;
  hub.dataset.studioReady = "true";
  const content = document.createElement("div");
  content.className = "planning-studio-content";
  content.innerHTML = `
    <header class="planning-studio-header">
      <p class="eyebrow">A little daydream. A real adventure.</p><h2>Your planning space</h2>
      <div class="button-row"><button class="primary-button" type="button" data-open-quick-plan>Let's plan</button><button class="ghost-button" type="button" data-target="aiTravelPlanner">Chat planner</button><button class="ghost-button" type="button" data-target="tripsPanel">My trips</button></div>
    </header>
    <section id="planningStudioDraft" class="planning-studio-draft" hidden><div><p>Pick up where you left off</p><h3 id="planningStudioDraftTitle"></h3><small>Draft saved on this browser. Save the trip to sync it to your account.</small></div><button class="ghost-button" type="button" data-open-quick-plan>Resume planning</button></section>
    <section class="planning-studio-saved"><h3>Your saved adventures</h3><p id="planningStudioEmpty"></p><div id="planningStudioTrips"></div></section>`;
  hub.prepend(content);
  content.querySelectorAll("[data-open-quick-plan]").forEach((button) => button.addEventListener("click", () => document.querySelector("#letsPlanButton").click()));
  form.querySelectorAll('[name="quickPlanType"]').forEach((input) => input.addEventListener("change", () => { document.querySelector("#letsPlanTypeInput").value = input.value; }));
  form.addEventListener("input", updateQuickPlanningSummary);
  form.addEventListener("submit", (event) => {
    if (!validateQuickPlanningStep()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (quickPlanStep < 2) {
      event.preventDefault(); event.stopImmediatePropagation();
      quickPlanStep++;
      renderQuickPlanningStep({ focus: true });
      return;
    }
    quickPlanTransferred = true;
  }, true);
  document.querySelector("#quickPlanBackButton").addEventListener("click", () => { quickPlanStep = Math.max(0, quickPlanStep - 1); renderQuickPlanningStep({ focus: true }); });
  document.querySelector("#saveQuickPlanDraftButton").addEventListener("click", () => {
    const key = quickPlanStorageKey();
    const message = document.querySelector("#letsPlanDialogMessage");
    if (!key) { message.textContent = "Sign in before saving a planning draft."; return; }
    const fields = Object.fromEntries(Object.entries(quickPlanFields).map(([key, id]) => [key, document.getElementById(id).value]));
    const vibes = Array.from(form.querySelectorAll('[name="quickPlanVibe"]:checked')).map((input) => input.value).filter((value) => quickPlanVibes.includes(value));
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, step: quickPlanStep, fields, vibes }));
      document.querySelector("#letsPlanDialog").close();
      navigateSafely("letsPlan", { updateHistory: true });
      renderPlanningStudio();
    } catch { message.textContent = "This browser couldn't save the draft. Your answers are still here."; }
  });
}
