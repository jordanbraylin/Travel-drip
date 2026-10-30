function addDisclosure(parent, label, elements) {
  const items = elements.filter(Boolean);
  if (!parent || !items.length) return null;
  const details = document.createElement("details");
  details.className = "simple-disclosure";
  const summary = document.createElement("summary");
  summary.textContent = label;
  details.append(summary);
  items.forEach((element) => details.append(element));
  parent.append(details);
  return details;
}

function selectAccountSettings(requested = "account", { focus = false } = {}) {
  const aliases = { socialMediaHub: "integrations", backendReadiness: "system", goLiveReadiness: "system", myProfile: "profile", "connected-accounts": "integrations", "ride-share-connections": "integrations", "social-media-connections": "integrations", "wallet-settings": "payments", "app-preferences": "app", "data-management": "data", "password-security": "security" };
  const key = aliases[requested] || requested;
  const root = getRouteComponentById("adminPanel");
  const panels = root ? Array.from(root.querySelectorAll("[data-settings-panel]")) : [];
  const section = panels.some((panel) => panel.dataset.settingsPanel === key) ? key : "account";
  panels.forEach((panel) => {
    const active = panel.dataset.settingsPanel === section;
    panel.classList.toggle("active", active);
    setVisibilityWithoutCssLeaks(panel, active);
  });
  root?.querySelectorAll(".settings-nav-panel [data-settings-section]").forEach((tab) => {
    const active = tab.dataset.settingsSection === section;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  const picker = root?.querySelector("#accountSectionSelect");
  if (picker) picker.value = section;
  if (document.body.dataset.activeRoute === "adminPanel" && location.protocol !== "file:") {
    history.replaceState({ ...history.state, target: "adminPanel", settingsFocus: section }, "", `/account/${section}`);
    if (root?.isConnected) root.scrollIntoView({ behavior: "auto", block: "start" });
  }
  return section;
}

function applyReadingPreferences() {
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem("traveldripReadingPreferences") || "{}"); } catch (_error) { /* Use readable defaults. */ }
  document.documentElement.dataset.textSize = ["large", "extra-large"].includes(preferences.textSize) ? preferences.textSize : "default";
  document.documentElement.dataset.highContrast = String(Boolean(preferences.highContrast));
  document.documentElement.dataset.reduceMotion = String(Boolean(preferences.reduceMotion));
  for (const [id, key] of [["readingTextSize", "textSize"], ["readingHighContrast", "highContrast"], ["readingReduceMotion", "reduceMotion"]]) {
    const input = document.getElementById(id);
    if (!input) continue;
    if (input.type === "checkbox") input.checked = Boolean(preferences[key]);
    else input.value = document.documentElement.dataset.textSize;
    input.onchange = () => {
      preferences[key] = input.type === "checkbox" ? input.checked : input.value;
      try { localStorage.setItem("traveldripReadingPreferences", JSON.stringify(preferences)); } catch (_error) { /* Apply for this page even if storage is unavailable. */ }
      applyReadingPreferences();
    };
  }
}

function initializeSimpleExperience() {
  const account = document.getElementById("adminPanel");
  if (!account || account.dataset.simplified) return;
  account.dataset.simplified = "true";
  const menu = document.querySelector(".grouped-nav");
  const company = menu.querySelector(".corporate-entry-nav");
  const admin = menu.querySelector("[data-admin-only]");
  const help = menu.querySelector('[data-target="copyrightPolicy"]');
  const destinations = [
    ["Home", '[data-main-nav-id="dashboard"]'],
    ["My trips", '[data-target="tripsPanel"]'],
    ["Find travel", '[data-main-nav-id="travel"]'],
    ["Trip plan", '[data-main-nav-id="itinerary"]'],
    ["Wallet", '[data-main-nav-id="wallet"]'],
    ["Messages", '[data-main-nav-id="chat"]'],
    ["Photos", '[data-main-nav-id="memories"]'],
    ["Events", '[data-main-nav-id="events"]'],
    ["Account", '[data-main-nav-id="settings"]']
  ].map(([label, selector]) => {
    const button = menu.querySelector(selector);
    if (label !== "Home" && button.closest("[data-consumer-nav]")) button.dataset.consumerNav = "";
    button.textContent = label;
    button.setAttribute("aria-label", label);
    if (label === "Find travel") {
      button.removeAttribute("data-main-nav-id");
      button.removeAttribute("data-travel-section");
      button.dataset.target = "exploreDrops";
    }
    return button;
  });
  menu.replaceChildren(...destinations);
  const accountPanel = account.querySelector('[data-settings-panel="account"]');
  if (company) account.querySelector('[data-settings-panel="corporate"]')?.append(company);
  if (accountPanel && admin) accountPanel.append(admin);
  menu.classList.add("simple-main-menu");
  const accountButton = document.querySelector(".profile-avatar-button");
  accountButton.dataset.target = "adminPanel";
  accountButton.setAttribute("aria-label", "Account");
  accountButton.append(document.createTextNode("Account"));
  const tripPicker = document.createElement("button");
  tripPicker.type = "button";
  tripPicker.className = "ghost-button";
  tripPicker.textContent = "Plan a trip";
  tripPicker.dataset.target = "letsPlan";
  tripPicker.dataset.consumerNav = "";
  menu.querySelector('[data-target="tripsPanel"]').after(tripPicker);
  const panel = (key) => account.querySelector(`[data-settings-panel="${key}"]`);
  if (help) panel("account").append(help);
  const move = (selector, key, label = "") => {
    const element = document.querySelector(selector);
    if (!element || !panel(key)) return;
    element.removeAttribute("data-route-support");
    element.removeAttribute("data-route-extract");
    element.removeAttribute("data-dashboard-only");
    if (label) addDisclosure(panel(key), label, [element]);
    else panel(key).append(element);
  };

  const profile = document.getElementById("myProfile");
  if (profile) {
    panel("profile").append(...Array.from(profile.children));
    panel("profile").classList.add("my-profile-panel");
    const basic = panel("profile").querySelector(".profile-personal-grid");
    const photo = panel("profile").querySelector(".profile-photo-manager");
    const extras = Array.from(panel("profile").children).filter((item) => item !== basic && item !== photo);
    if (basic) panel("profile").prepend(basic);
    if (basic) {
      const optional = Array.from(basic.querySelectorAll(":scope > article")).slice(1);
      addDisclosure(basic, "Optional profile details", optional);
    }
    addDisclosure(panel("profile"), "Profile photo", [photo]);
    addDisclosure(panel("profile"), "Profile preview and travel interests", extras);
  }
  move(".photo-audience-card", "privacy", "Profile photo privacy");
  move(".theme-studio", "app", "Theme choices");
  move(".pwa-panel", "app", "Install Travel-Drip");
  move(".install-card", "app");
  move(".dashboard-controls", "app", "Home page preferences");
  move("#socialMediaHub", "integrations", "Social accounts");
  move(".ride-account-panel", "integrations", "Ride-share accounts");
  move(".itinerary-preferences-widget", "notifications", "Trip alerts");
  move(".reservation-preferences-grid", "notifications", "Booking reminders");
  move(".memory-settings-card", "notifications", "Photo reminders");
  move(".sharing-settings-panel", "privacy", "Sharing preferences");
  move("#ownershipTransferPanel", "roles", "Transfer trip ownership");
  move("#notifyButton", "notifications");
  move("#signOutButton", "account");
  for (const [selector, label] of [[".security-status-grid", "Security summary"], [".security-control-grid", "Security practices"], [".fraud-signal-list", "Security checks"], ["#securityAuditMessage", "Audit results"], ["#runSecurityAuditButton", "Run a security check"], ["#backendReadiness", "Backend status"], ["#goLiveReadiness", "Production checks"], [".navigation-audit-panel", "Link checks"]]) {
    move(selector, "system", label);
  }
  const diagnostics = panel("system");
  diagnostics.removeAttribute("data-settings-panel");
  diagnostics.id = "internalServiceDiagnostics";
  setVisibilityWithoutCssLeaks(diagnostics, false);
  move(".wallet-section-widget--payment-methods", "payments", "Payment methods");
  document.querySelectorAll(".wallet-dashboard-sections > .wallet-section-widget").forEach((widget) => {
    const details = document.createElement("details");
    details.className = "simple-disclosure";
    details.name = "wallet-sections";
    const summary = document.createElement("summary");
    summary.textContent = widget.querySelector(".eyebrow")?.textContent || "Wallet details";
    widget.before(details);
    details.append(summary, widget);
  });
  addDisclosure(document.getElementById("walletPanel"), "Add funds and contribution history", [document.querySelector(".wallet-operations-panel")]);
  // These modules are account settings even when their previous route is opened directly.
  document.querySelectorAll('[data-settings-focus="socialMediaHub"]').forEach((button) => { button.dataset.settingsFocus = "integrations"; });

  const nav = account.querySelector(".settings-nav-panel");
  const headings = { account: "Your account", security: "Password and sign-in", roles: "Trip permissions", notifications: "Notifications", privacy: "Privacy", payments: "Payments", app: "App preferences", accessibility: "Reading and motion", integrations: "Connected services", data: "Your data" };
  for (const [key, text] of Object.entries(headings)) {
    const heading = panel(key)?.querySelector("h3");
    if (heading) heading.textContent = text;
  }
  account.querySelectorAll(".settings-row").forEach((row) => {
    const label = row.querySelector("strong")?.textContent;
    row.querySelectorAll("input, select").forEach((input) => {
      if (label && !input.getAttribute("aria-label")) input.setAttribute("aria-label", label);
    });
  });
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "Account settings");
  nav.setAttribute("aria-orientation", "vertical");
  nav.querySelectorAll("[data-settings-section]").forEach((tab) => {
    const key = tab.dataset.settingsSection;
    const labels = { security: "Password & sign-in", roles: "Trip access", payments: "Payments", app: "Appearance", integrations: "Connected services", data: "Your data" };
    if (labels[key]) tab.textContent = labels[key];
    tab.id = `account-tab-${key}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `account-panel-${key}`);
    const content = panel(key);
    content.id = `account-panel-${key}`;
    content.setAttribute("role", "tabpanel");
    content.setAttribute("aria-labelledby", tab.id);
    tab.addEventListener("keydown", (event) => {
      const tabs = Array.from(nav.querySelectorAll('[role="tab"]')).filter((item) => !item.hidden);
      const index = tabs.indexOf(tab);
      const next = { ArrowDown: (index + 1) % tabs.length, ArrowUp: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectAccountSettings(tabs[next].dataset.settingsSection, { focus: true });
    });
  });
  const picker = document.createElement("label");
  picker.className = "account-section-picker";
  picker.textContent = "Account section";
  const select = document.createElement("select");
  select.id = "accountSectionSelect";
  nav.querySelectorAll("[data-settings-section]").forEach((tab) => {
    const option = document.createElement("option");
    option.value = tab.dataset.settingsSection;
    option.textContent = tab.textContent;
    select.append(option);
  });
  picker.append(select);
  account.querySelector(".settings-shell").before(picker);
  select.addEventListener("change", () => selectAccountSettings(select.value));

  const grid = document.getElementById("widgetGrid");
  addDisclosure(document.getElementById("accountLiveDashboard"), "Saved trip information", [document.querySelector(".account-live-counts"), document.getElementById("accountLiveDataStatus")]);
  const extraWidgets = Array.from(grid.querySelectorAll("[data-widget]")).filter((widget) => !["upcoming", "budget", "weather"].includes(widget.dataset.widget));
  const extraGrid = document.createElement("div");
  extraGrid.className = "widget-grid";
  extraWidgets.forEach((widget) => extraGrid.append(widget));
  addDisclosure(document.getElementById("dashboardWidgets"), "More trip information", [extraGrid]);

  const invitations = document.getElementById("invitationSetupStep");
  addDisclosure(invitations, "Invitation message and RSVP details", [invitations.querySelector(".invitation-builder-grid"), invitations.querySelector(".invitation-options-grid")]);
  const planner = document.getElementById("aiTravelPlanner");
  addDisclosure(planner, "Your saved planning answers", [planner.querySelector(".ai-planner-summary")]);
  addDisclosure(planner, "Review trip draft and research", [document.getElementById("aiGeneratedTrip")]);
  const event = document.getElementById("eventsPanel");
  addDisclosure(event, "Invitation design", [document.getElementById("eventInviteStudio")]);
  document.querySelectorAll('.main-stack > [data-route-support], .right-stack > [data-route-support]').forEach((element) => {
    const disclosure = document.createElement("details");
    disclosure.className = "simple-disclosure route-extra-details";
    disclosure.dataset.routeSupport = element.dataset.routeSupport;
    const summary = document.createElement("summary");
    summary.textContent = element.querySelector("h2, h3")?.textContent || "More trip details";
    element.before(disclosure);
    disclosure.append(summary, element);
  });
  document.querySelectorAll('.mobile-nav [data-main-nav-id="dashboard"]').forEach((button) => { button.textContent = "Home"; });
  document.querySelectorAll('.mobile-nav [data-main-nav-id="planning"]').forEach((button) => { button.textContent = "Plan"; });
  document.querySelectorAll('[data-target="adminPanel"]:not([data-settings-focus])').forEach((button) => { button.dataset.settingsFocus = "account"; });
  document.querySelectorAll('.settings-section [data-target="rideShareHub"]').forEach((button) => {
    button.dataset.target = "adminPanel";
    button.dataset.settingsFocus = "integrations";
  });
  applyReadingPreferences();
  selectAccountSettings("account");
}
