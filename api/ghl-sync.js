import {
  applySecurityHeaders,
  getRequestBody,
  requireAuthenticatedUser,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_VERSION = "v3";

function getAdminEmails() {
  return (process.env.SUPABASE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getGhlConfig() {
  return {
    apiKey: process.env.GHL_API_KEY || "",
    locationId: process.env.GHL_LOCATION_ID || "",
    pipelineId: process.env.GHL_PIPELINE_ID || "",
    pipelineStageId: process.env.GHL_PIPELINE_STAGE_ID || "",
    workflowId: process.env.GHL_DEFAULT_WORKFLOW_ID || "",
    webhookSecret: process.env.GHL_WEBHOOK_SECRET || ""
  };
}

function isAdmin(user) {
  return Boolean(user?.email && getAdminEmails().includes(user.email.toLowerCase()));
}

function configStatus(config) {
  return {
    configured: Boolean(config.apiKey && config.locationId),
    locationIdConfigured: Boolean(config.locationId),
    pipelineConfigured: Boolean(config.pipelineId),
    workflowConfigured: Boolean(config.workflowId),
    webhookSecretConfigured: Boolean(config.webhookSecret)
  };
}

async function ghlRequest(path, method, config, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${GHL_BASE_URL}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          Version: GHL_VERSION
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      const error = new Error(payload.message || payload.error || `GoHighLevel request failed (${response.status})`);
      error.status = response.status;
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error.status && error.status < 500 && error.status !== 429) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError || new Error("GoHighLevel request failed");
}

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || "TravelDrip",
    lastName: parts.join(" ")
  };
}

function normalizeTags(tags = []) {
  return [...new Set(tags.map((tag) => sanitizeText(tag, "", 48)).filter(Boolean))].slice(0, 25);
}

function buildContact(user, input, config) {
  const name = sanitizeText(input.fullName || user.user_metadata?.full_name || user.email?.split("@")[0] || "TravelDrip traveler", "TravelDrip traveler", 120);
  const { firstName, lastName } = splitName(name);
  const email = sanitizeText(input.email || user.email, "", 160).toLowerCase();
  const tripType = sanitizeText(input.tripType || "", "", 60);
  const tags = normalizeTags(["TravelDrip User", "New Traveler", tripType, ...(input.tags || [])]);
  const customFields = Object.entries({
    username: input.username,
    user_type: input.userType,
    trip_type: tripType,
    destination: input.destination,
    trip_name: input.tripName,
    departure_date: input.departureDate,
    return_date: input.returnDate,
    traveler_count: input.travelerCount,
    trip_status: input.tripStatus,
    budget: input.budget,
    amount_contributed: input.amountContributed,
    outstanding_balance: input.outstandingBalance,
    event_type: input.eventCategory || input.eventType,
    corporate_account: input.corporateAccount,
    preferred_notification_method: input.preferredNotificationMethod,
    last_traveldrip_activity: new Date().toISOString()
  }).filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({ key, fieldValue: String(value).slice(0, 240) }));

  return {
    firstName,
    lastName,
    name,
    email,
    phone: sanitizeText(input.phone, "", 40) || undefined,
    locationId: config.locationId,
    tags,
    customFields,
    source: "TravelDrip",
    createNewIfDuplicateAllowed: false
  };
}

async function writeSyncLog(supabase, userId, status, input, error = "") {
  if (!supabase) return;
  await supabase.from("ghl_sync_logs").insert({
    user_id: userId,
    event_type: sanitizeText(input.eventType || "manual_sync", "manual_sync", 80),
    status,
    error_message: error ? sanitizeText(error, "", 500) : null,
    metadata: {
      tripType: sanitizeText(input.tripType, "", 60),
      destination: sanitizeText(input.destination, "", 120),
      syncedAt: new Date().toISOString()
    }
  }).catch(() => {});
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const config = getGhlConfig();
  if (request.method === "GET") {
    if (!isAdmin(user)) {
      response.status(403).json({ error: "Admin access required" });
      return;
    }
    const { data: logs } = await supabase
      .from("ghl_sync_logs")
      .select("created_at,status,error_message,event_type")
      .order("created_at", { ascending: false })
      .limit(20);
    const recentLogs = logs || [];
    response.status(200).json({
      ...configStatus(config),
      lastSuccessfulSync: recentLogs.find((log) => log.status === "success")?.created_at || null,
      recentErrors: recentLogs.filter((log) => log.status === "failed").slice(0, 5)
    });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const input = getRequestBody(request);
  if (input.action === "test-connection") {
    if (!isAdmin(user)) {
      response.status(403).json({ error: "Admin access required" });
      return;
    }
    if (!config.apiKey || !config.locationId) {
      response.status(503).json({ error: "GHL_API_KEY and GHL_LOCATION_ID are required", ...configStatus(config) });
      return;
    }
    try {
      await ghlRequest(`/locations/${encodeURIComponent(config.locationId)}`, "GET", config);
      response.status(200).json({ ok: true, message: "GoHighLevel connection verified.", ...configStatus(config) });
    } catch (error) {
      response.status(502).json({ error: error.message, ...configStatus(config) });
    }
    return;
  }

  if (!config.apiKey || !config.locationId) {
    response.status(503).json({ error: "GoHighLevel is not configured on the server." });
    return;
  }

  const contact = buildContact(user, input, config);
  if (!contact.email) {
    response.status(400).json({ error: "An email address is required to sync a contact." });
    return;
  }

  try {
    const contactResult = await ghlRequest("/contacts/upsert", "POST", config, contact);
    const contactId = contactResult.contact?.id || contactResult.contact?.contactId || contactResult.id;
    let opportunityResult = null;
    let workflowResult = null;

    if (contactId && config.pipelineId && input.tripName) {
      opportunityResult = await ghlRequest("/opportunities/upsert", "POST", config, {
        pipelineId: config.pipelineId,
        pipelineStageId: config.pipelineStageId || undefined,
        locationId: config.locationId,
        name: sanitizeText(input.tripName, "TravelDrip trip", 120),
        status: "open",
        contactId,
        monetaryValue: Number(input.budget || 0) || undefined
      }).catch((error) => ({ error: error.message }));
    }

    if (contactId && config.workflowId) {
      workflowResult = await ghlRequest(`/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(config.workflowId)}`, "POST", config, {}).catch((error) => ({ error: error.message }));
    }

    await writeSyncLog(supabase, user.id, "success", input);
    await writeAuditLog(supabase, {
      actorUserId: user.id,
      action: "ghl_sync_completed",
      entityType: "crm_contact",
      metadata: { eventType: input.eventType || "manual_sync", contactIdPresent: Boolean(contactId) }
    });
    response.status(200).json({ ok: true, contactId: contactId || null, opportunity: opportunityResult, workflow: workflowResult, syncedAt: new Date().toISOString() });
  } catch (error) {
    await writeSyncLog(supabase, user.id, "failed", input, error.message);
    response.status(502).json({ error: "GoHighLevel sync failed. The TravelDrip workflow was not blocked; retry from Admin." });
  }
}
