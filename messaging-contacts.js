let messagingContacts = { userId: "", rows: [], loading: false, loaded: false, nextOffset: null, generation: 0 };
let selectedMessagingContact = null;

function resetMessagingContacts() {
  messagingContacts = { userId: "", rows: [], loading: false, loaded: false, nextOffset: null, generation: messagingContacts.generation + 1 };
  selectedMessagingContact = null;
  document.querySelectorAll("#messagingContactDialog, #contactMessageDialog").forEach((dialog) => dialog.close());
  document.querySelector("#messagingContactForm")?.reset();
  const search = document.querySelector("#messagingContactSearch");
  if (search) search.value = "";
  const body = document.querySelector("#contactMessageBody");
  if (body) body.value = "";
  const recipient = document.querySelector("#contactMessageRecipient");
  if (recipient) recipient.textContent = "";
  document.querySelectorAll("#contactMessage-sms, #contactMessage-email").forEach((link) => { link.removeAttribute("href"); link.hidden = true; });
  renderMessagingContacts();
}

function contactMessageLinks(contact, body = "") {
  const phone = String(contact?.phone || "").replace(/[\s().-]/g, "");
  const email = String(contact?.email || "");
  return {
    sms: /^\+?[0-9]{7,15}$/.test(phone) ? `sms:${phone}?body=${encodeURIComponent(body)}` : "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${encodeURIComponent(email)}?body=${encodeURIComponent(body)}` : ""
  };
}

function renderMessagingContacts() {
  const list = document.querySelector("#messagingContactList");
  if (!list) return;
  const query = (document.querySelector("#messagingContactSearch")?.value || "").trim().toLowerCase();
  const contacts = messagingContacts.rows.filter((contact) => [contact.name, contact.phone, contact.email, contact.relationship].join(" ").toLowerCase().includes(query));
  list.replaceChildren();
  for (const contact of contacts) {
    const row = document.createElement("article");
    row.className = "messaging-contact-row";
    const avatar = document.createElement("span");
    avatar.className = "contact-initials";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initialsFromName(contact.name);
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = contact.name;
    const details = document.createElement("small");
    details.textContent = contact.phone;
    const relation = document.createElement("small");
    relation.textContent = contact.relationship || "Contact";
    copy.append(name, details, relation);
    const actions = document.createElement("div");
    actions.className = "contact-row-actions";
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = "Start message";
    start.className = "contact-start-button";
    start.setAttribute("aria-label", `Start message to ${contact.name}`);
    start.addEventListener("click", () => openContactMessage(contact));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit ${contact.name}`);
    edit.addEventListener("click", () => openMessagingContact(contact));
    actions.append(start, edit);
    row.append(avatar, copy, actions);
    list.append(row);
  }
  const status = document.querySelector("#messagingContactsStatus");
  if (status) status.textContent = messagingContacts.loading ? "Loading your contacts..." : !messagingContacts.loaded ? "Your saved contacts appear here." : contacts.length ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : query ? "No matching contacts in the loaded address book." : "No saved contacts yet. Add a friend to get started.";
  const more = document.querySelector("#moreMessagingContactsButton");
  if (more) { more.hidden = messagingContacts.nextOffset === null; more.disabled = messagingContacts.loading; }
}

async function loadMessagingContacts({ more = false, refresh = false } = {}) {
  const userId = state.session?.user?.id;
  if (!userId || !state.session?.access_token || isFilePreview) return;
  if (messagingContacts.userId && messagingContacts.userId !== userId) resetMessagingContacts();
  if (messagingContacts.loading || (messagingContacts.loaded && !more && !refresh)) return;
  messagingContacts.userId = userId;
  messagingContacts.loading = true;
  const generation = messagingContacts.generation;
  const offset = more ? messagingContacts.nextOffset : 0;
  if (offset === null) { messagingContacts.loading = false; return; }
  const retry = document.querySelector("#retryMessagingContactsButton");
  if (retry) retry.hidden = true;
  renderMessagingContacts();
  try {
    const result = await apiRequest(`/api/contacts?offset=${offset}`);
    if (generation !== messagingContacts.generation || userId !== state.session?.user?.id) return;
    const rows = more ? [...messagingContacts.rows, ...(result.contacts || [])] : result.contacts || [];
    messagingContacts.rows = [...new Map(rows.map((contact) => [contact.id, contact])).values()].sort((a, b) => a.name.localeCompare(b.name));
    messagingContacts.nextOffset = result.nextOffset ?? null;
    messagingContacts.loaded = true;
  } catch (error) {
    if (generation !== messagingContacts.generation || userId !== state.session?.user?.id) return;
    messagingContacts.loading = false;
    renderMessagingContacts();
    const status = document.querySelector("#messagingContactsStatus");
    if (status) status.textContent = "Your contacts could not be refreshed. Please try again.";
    if (retry) retry.hidden = false;
    return;
  } finally {
    if (generation === messagingContacts.generation && userId === state.session?.user?.id) messagingContacts.loading = false;
  }
  renderMessagingContacts();
}

function openMessagingContact(contact = null) {
  const form = document.querySelector("#messagingContactForm");
  if (!form || !state.session?.user) return;
  form.reset();
  form.elements.contactId.value = contact?.id || "";
  for (const key of ["name", "phone", "email", "relationship"]) form.elements[key].value = contact?.[key] || "";
  document.querySelector("#messagingContactDialogTitle").textContent = contact ? "Edit contact" : "Add a friend or contact";
  document.querySelector("#messagingContactSaveStatus").textContent = "";
  document.querySelector("#messagingContactDialog").showModal();
  form.elements.name.focus();
}

function updateContactMessageLinks() {
  const body = document.querySelector("#contactMessageBody")?.value || "";
  const links = contactMessageLinks(selectedMessagingContact, body);
  for (const channel of ["sms", "email"]) {
    const link = document.querySelector(`#contactMessage-${channel}`);
    link.hidden = !links[channel];
    if (links[channel]) link.href = links[channel];
    else link.removeAttribute("href");
  }
  document.querySelector("#contactMessageUnavailable").hidden = Boolean(links.sms || links.email);
}

function openContactMessage(contact) {
  selectedMessagingContact = contact;
  document.querySelector("#contactMessageDialogTitle").textContent = `Message ${contact.name}`;
  document.querySelector("#contactMessageRecipient").textContent = [contact.phone, contact.email].filter(Boolean).join(" · ");
  document.querySelector("#contactMessageBody").value = "";
  updateContactMessageLinks();
  document.querySelector("#contactMessageDialog").showModal();
  document.querySelector("#contactMessageBody").focus();
}

function initializeMessagingContacts() {
  if (!document.querySelector("#messagingContactList")) return;
  if (document.querySelector("#messagingContactDialog")) return;
  const dialogs = document.createElement("div");
  dialogs.innerHTML = `
    <dialog id="messagingContactDialog" class="messaging-dialog" aria-labelledby="messagingContactDialogTitle">
      <form id="messagingContactForm">
        <div class="messaging-dialog-heading"><h2 id="messagingContactDialogTitle">Add a friend or contact</h2><button type="button" data-close-messaging-dialog="messagingContactDialog" aria-label="Close contact">Close</button></div>
        <input type="hidden" name="contactId">
        <label>Name<input name="name" autocomplete="off" maxlength="120" required></label>
        <label>Mobile number<input name="phone" type="tel" autocomplete="off" maxlength="40" placeholder="Include country code, e.g. +1" required></label>
        <label>Email (optional)<input name="email" type="email" autocomplete="off" maxlength="254"></label>
        <label>Relationship (optional)<input name="relationship" autocomplete="off" maxlength="80" placeholder="Friend, family, or travel companion"></label>
        <p id="messagingContactSaveStatus" role="status"></p>
        <div class="messaging-dialog-actions"><button type="button" data-close-messaging-dialog="messagingContactDialog">Cancel</button><button class="primary-button" type="submit">Save contact</button></div>
      </form>
    </dialog>
    <dialog id="contactMessageDialog" class="messaging-dialog" aria-labelledby="contactMessageDialogTitle">
      <div class="messaging-dialog-heading"><h2 id="contactMessageDialogTitle">Start message</h2><button type="button" data-close-messaging-dialog="contactMessageDialog" aria-label="Close message">Close</button></div>
      <p id="contactMessageRecipient"></p>
      <label>Message<textarea id="contactMessageBody" rows="5" maxlength="4000" placeholder="Write your message"></textarea></label>
      <p>Review and send in your text or email app. Replies stay in that app, not in your trip chat.</p>
      <p id="contactMessageUnavailable" hidden>Add a valid mobile number or email to this contact first.</p>
      <div class="messaging-dialog-actions"><a id="contactMessage-sms" class="contact-channel-link">Open text message</a><a id="contactMessage-email" class="contact-channel-link">Open email</a></div>
    </dialog>`;
  document.body.append(dialogs);
  document.querySelectorAll("[data-messaging-view]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector("#socialHub .messages-hub").dataset.mobileView = button.dataset.messagingView;
    document.querySelectorAll("[data-messaging-view]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  }));
  dialogs.querySelectorAll("[data-close-messaging-dialog]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.closeMessagingDialog).close()));
  document.querySelector("#addMessagingContactButton")?.addEventListener("click", () => openMessagingContact());
  document.querySelector("#messagingContactSearch")?.addEventListener("input", renderMessagingContacts);
  document.querySelector("#contactMessageBody")?.addEventListener("input", updateContactMessageLinks);
  document.querySelector("#moreMessagingContactsButton")?.addEventListener("click", () => loadMessagingContacts({ more: true }));
  document.querySelector("#retryMessagingContactsButton")?.addEventListener("click", () => loadMessagingContacts({ refresh: true }));
  document.querySelector("#refreshMessagingButton")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await Promise.all([loadTripChatData(), loadMessagingContacts({ refresh: true })]); }
    finally { button.disabled = false; }
  });
  document.querySelector("#messagingContactForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type=submit]");
    const status = document.querySelector("#messagingContactSaveStatus");
    const generation = messagingContacts.generation;
    const userId = state.session?.user?.id;
    const id = form.elements.contactId.value;
    submit.disabled = true;
    status.textContent = "Saving contact...";
    try {
      const result = await apiRequest("/api/contacts", { method: id ? "PATCH" : "POST", body: JSON.stringify({ id, name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value, relationship: form.elements.relationship.value }) });
      if (generation !== messagingContacts.generation || userId !== state.session?.user?.id) return;
      messagingContacts.rows = [...messagingContacts.rows.filter((contact) => contact.id !== result.contact.id), result.contact].sort((a, b) => a.name.localeCompare(b.name));
      messagingContacts.loaded = true;
      document.querySelector("#messagingContactSearch").value = "";
      renderMessagingContacts();
      document.querySelector("#messagingContactDialog").close();
      status.textContent = "";
      document.querySelector("#messagingContactsStatus").textContent = `${result.contact.name} saved to your address book.`;
    } catch (error) {
      if (generation === messagingContacts.generation && userId === state.session?.user?.id) status.textContent = error.message || "Contact could not be saved. Please try again.";
    } finally { submit.disabled = false; }
  });
  let refreshing = false;
  window.setInterval(async () => {
    if (refreshing || document.hidden || getTargetFromRoute() !== "socialHub" || !state.session?.access_token) return;
    refreshing = true;
    try { await loadTripChatData(); }
    finally { refreshing = false; }
  }, 15000);
}
