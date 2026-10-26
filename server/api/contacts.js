import { applySecurityHeaders, getRequestBody, methodNotAllowed, requireAuthenticatedUser, sanitizeText } from "./_security.js";

const fields = "id, name, relationship, phone, email";

export async function saveContact(response, supabase, user, body, editing = false) {
  const name = sanitizeText(body.name, "", 120);
  const relationship = sanitizeText(body.relationship, "Friend", 80);
  const phone = sanitizeText(body.phone, "", 40).replace(/[\s().-]/g, "");
  const email = sanitizeText(body.email, "", 254).toLowerCase();
  const id = sanitizeText(body.id, "", 80);
  if (!name || !/^\+?[0-9]{7,15}$/.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (editing && !id)) {
    response.status(400).json({ error: "Enter a name, a valid mobile number, and a valid email if provided." });
    return;
  }
  const values = { name, relationship, phone, email: email || null };
  const query = editing
    ? supabase.from("trusted_contacts").update(values).eq("id", id).eq("user_id", user.id)
    : supabase.from("trusted_contacts").insert({ ...values, user_id: user.id, metadata: { contactKind: "address_book" } });
  const { data, error } = await query.select(fields).maybeSingle();
  if (error) { response.status(503).json({ error: "Your contact could not be saved. Please try again." }); return; }
  if (!data) { response.status(404).json({ error: "Contact not found in your address book." }); return; }
  response.status(editing ? 200 : 201).json({ contact: data });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!["GET", "POST", "PATCH"].includes(request.method)) { methodNotAllowed(response, "GET, POST, PATCH"); return; }
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;
  try {
    if (request.method !== "GET") return await saveContact(response, supabase, user, getRequestBody(request), request.method === "PATCH");
    const url = new URL(request.url, "https://traveldrip.local");
    const offset = Math.max(0, Math.min(100000, Number.parseInt(url.searchParams.get("offset"), 10) || 0));
    const { data, error } = await supabase.from("trusted_contacts").select(fields).eq("user_id", user.id).order("name").order("id").range(offset, offset + 99);
    if (error) { response.status(503).json({ error: "Your address book could not be loaded. Please try again." }); return; }
    response.status(200).json({ contacts: data || [], nextOffset: data?.length === 100 ? offset + 100 : null });
  } catch {
    response.status(503).json({ error: "Your address book is temporarily unavailable. Please try again." });
  }
}
