import crypto from "node:crypto";
import {
  applySecurityHeaders,
  createSupabaseAdminClient,
  getBearerToken,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

const sessionTtlMs = 1000 * 60 * 60 * 4;
const genericVerifyError = "We could not verify your access information. Check your details or contact your event organizer.";
const weakAccessCodes = new Set(["1234", "PASSWORD", "COMPANY", "TRAVEL", "RETREAT", "WELCOME", "EVENTCODE"]);

function getPepper() {
  return String(process.env.GUEST_ACCESS_PEPPER || "").trim();
}

function isGuestAccessConfigured() {
  return getPepper().length >= 32;
}

function normalizeSecret(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function hashValue(value, scope = "guest") {
  return crypto
    .createHash("sha256")
    .update(`${scope}:${normalizeSecret(value)}:${getPepper()}`)
    .digest("hex");
}

function randomCode() {
  return `TD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function isSecureAccessCode(code) {
  const normalized = normalizeSecret(code);
  return normalized.length >= 8
    && /[A-Z]/.test(normalized)
    && /\d/.test(normalized)
    && !weakAccessCodes.has(normalized);
}

function randomToken() {
  return crypto.randomBytes(40).toString("base64url");
}

function maskIdentifier(value) {
  const raw = String(value || "").trim();
  const suffix = raw.slice(-4) || "0000";
  return `••••${suffix}`;
}

function getIpHash(request) {
  const ip = request.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || request.socket?.remoteAddress
    || "";
  return ip ? hashValue(ip, "ip") : "";
}

function getDeviceInformation(request) {
  return {
    userAgent: sanitizeText(request.headers["user-agent"], "", 260),
    acceptLanguage: sanitizeText(request.headers["accept-language"], "", 120)
  };
}

async function logGuestAccess(supabase, request, event) {
  await supabase.from("guest_access_events").insert({
    ...event,
    device_information: getDeviceInformation(request),
    ip_hash: getIpHash(request)
  });
}

async function createAccessCode(request, response, body) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const tripId = body.tripId || body.trip_id;
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Corporate access admin required" });
    return;
  }

  const { data: trip } = await supabase.from("trips").select("organization_id").eq("id", tripId).single();
  const organizationId = body.organizationId || body.organization_id || trip?.organization_id || null;
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  if (metadata.accessMode === "persistent" && !organizationId) {
    response.status(409).json({ error: "Reusable employee access requires this corporate trip to belong to an organization." });
    return;
  }
  const code = sanitizeText(body.code, "", 80) || randomCode();
  if (!isSecureAccessCode(code)) {
    response.status(400).json({ error: "Access codes must be at least 8 characters and include letters and numbers." });
    return;
  }
  const expiresAt = body.expiresAt || body.expires_at || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const { data, error } = await supabase
    .from("corporate_access_codes")
    .insert({
      trip_id: tripId,
      organization_id: organizationId,
      code_hash: hashValue(code, "access-code"),
      code_hint: code.slice(-4),
      code_type: sanitizeText(body.codeType || body.code_type, "shared_event", 40),
      assigned_role: sanitizeText(body.assignedRole || body.assigned_role, "employee", 40),
      assigned_attendee_id: body.assignedAttendeeId || body.assigned_attendee_id || null,
      assigned_department: sanitizeText(body.assignedDepartment || body.assigned_department, "", 120),
      assigned_team_id: sanitizeText(body.assignedTeamId || body.assigned_team_id, "", 120),
      allowed_start_at: body.allowedStartAt || body.allowed_start_at || null,
      allowed_end_at: body.allowedEndAt || body.allowed_end_at || null,
      expires_at: expiresAt,
      usage_limit: Math.max(0, Number(body.usageLimit || body.usage_limit || 0)),
      requires_employee_id: body.requiresEmployeeId !== false,
      requires_last_name: body.requiresLastName !== false && body.requires_last_name !== false,
      requires_company_domain: Boolean(body.requiresCompanyDomain || body.requires_company_domain),
      company_domain: sanitizeText(body.companyDomain || body.company_domain, "", 180).toLowerCase().replace(/^@/, ""),
      remember_device_allowed: Boolean(body.rememberDeviceAllowed || body.remember_device_allowed),
      minimum_code_length: Math.max(8, Number(body.minimumCodeLength || body.minimum_code_length || 8)),
      max_failed_attempts: Math.max(1, Number(body.maxFailedAttempts || body.max_failed_attempts || 5)),
      requires_email_verification: Boolean(body.requiresEmailVerification || body.requires_email_verification),
      requires_otp: Boolean(body.requiresOtp || body.requires_otp),
      created_by: user.id,
      metadata
    })
    .select("id, trip_id, code_type, assigned_role, assigned_department, assigned_team_id, expires_at, usage_limit, usage_count, requires_employee_id, requires_email_verification, requires_otp, status, code_hint")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "guest_access_code.created",
    entityType: "corporate_access_code",
    entityId: data.id,
    metadata: { codeType: data.code_type, assignedRole: data.assigned_role }
  });

  response.status(201).json({ accessCode: data, plainCode: code });
}

async function upsertAttendee(request, response, body) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const tripId = body.tripId || body.trip_id;
  const employeeId = sanitizeText(body.employeeId || body.employee_id || body.attendeeId || body.attendee_id, "", 120);
  const fullName = sanitizeText(body.fullName || body.full_name, "", 180);
  if (!tripId || !employeeId || !fullName) {
    response.status(400).json({ error: "tripId, employeeId, and fullName are required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Corporate attendee admin required" });
    return;
  }

  const { data: trip } = await supabase.from("trips").select("organization_id").eq("id", tripId).single();
  const organizationId = body.organizationId || body.organization_id || trip?.organization_id || null;
  const employeeIdHash = hashValue(employeeId, "employee-id");
  const { data: linkedEmployee } = organizationId
    ? await supabase
      .from("corporate_attendees")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("employee_id_hash", employeeIdHash)
      .not("user_id", "is", null)
      .in("access_status", ["active", "upgraded"])
      .limit(1)
      .maybeSingle()
    : { data: null };

  const nameParts = fullName.split(/\s+/);
  const lastName = sanitizeText(body.lastName || body.last_name || nameParts[nameParts.length - 1], "", 100);
  const { data, error } = await supabase
    .from("corporate_attendees")
    .upsert({
      trip_id: tripId,
      organization_id: organizationId,
      ...(linkedEmployee?.user_id ? { user_id: linkedEmployee.user_id } : {}),
      employee_id_hash: employeeIdHash,
      employee_id_masked: maskIdentifier(employeeId),
      attendee_reference: sanitizeText(body.attendeeReference || body.attendee_reference, maskIdentifier(employeeId), 120),
      full_name: fullName,
      last_name: lastName.toLowerCase(),
      company_email: sanitizeText(body.companyEmail || body.company_email, "", 180).toLowerCase(),
      department: sanitizeText(body.department, "", 120),
      job_title: sanitizeText(body.jobTitle || body.job_title, "", 140),
      manager_name: sanitizeText(body.managerName || body.manager_name, "", 140),
      role: sanitizeText(body.role, "employee", 40),
      access_status: sanitizeText(body.accessStatus || body.access_status, "active", 40),
      accessibility_requirements: sanitizeText(body.accessibilityRequirements || body.accessibility_requirements, "", 240),
      dietary_preferences: sanitizeText(body.dietaryPreferences || body.dietary_preferences, "", 240),
      metadata: body.metadata || {}
    }, { onConflict: "trip_id,employee_id_hash" })
    .select("id, trip_id, employee_id_masked, attendee_reference, full_name, company_email, department, role, access_status")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "corporate_attendee.upserted",
    entityType: "corporate_attendee",
    entityId: data.id,
    metadata: { role: data.role, department: data.department }
  });

  response.status(200).json({ attendee: data });
}

async function listCorporateInvites(request, response) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const url = new URL(request.url, "https://traveldrip.local");
  const tripId = sanitizeText(url.searchParams.get("tripId"), "", 120);
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Corporate attendee admin required" });
    return;
  }

  const { data: attendees, error: attendeeError } = await supabase
    .from("corporate_attendees")
    .select("id, created_at, user_id, employee_id_masked, full_name, company_email, department, role, access_status")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (attendeeError) {
    response.status(500).json({ error: attendeeError.message });
    return;
  }

  const attendeeIds = (attendees || []).map((attendee) => attendee.id);
  let accessCodes = [];
  if (attendeeIds.length) {
    const { data, error } = await supabase
      .from("corporate_access_codes")
      .select("id, created_at, assigned_attendee_id, assigned_role, expires_at, status, code_hint, metadata")
      .eq("trip_id", tripId)
      .eq("code_type", "individual")
      .in("assigned_attendee_id", attendeeIds)
      .order("created_at", { ascending: false });
    if (error) {
      response.status(500).json({ error: error.message });
      return;
    }
    accessCodes = data || [];
  }

  const latestCodeByAttendee = new Map();
  accessCodes.forEach((code) => {
    if (!latestCodeByAttendee.has(code.assigned_attendee_id)) latestCodeByAttendee.set(code.assigned_attendee_id, code);
  });

  const invitations = (attendees || []).map((attendee) => {
    const code = latestCodeByAttendee.get(attendee.id);
    return {
      id: code?.id || attendee.id,
      attendee_id: attendee.id,
      invitee_name: attendee.full_name,
      invitee_email: attendee.company_email,
      employee_id_masked: attendee.employee_id_masked,
      department: attendee.department,
      role: code?.assigned_role || attendee.role,
      status: code?.status || attendee.access_status,
      expires_at: code?.expires_at || null,
      code_hint: code?.code_hint || "",
      access_mode: code?.metadata?.accessMode || "temporary",
      account_type: attendee.user_id ? "personal_account_linked" : "corporate_guest_only"
    };
  });

  response.status(200).json({ invitations });
}

async function revokeAccessCode(request, response, body) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const tripId = body.tripId || body.trip_id;
  const accessCodeId = body.accessCodeId || body.access_code_id;
  if (!tripId || !accessCodeId) {
    response.status(400).json({ error: "tripId and accessCodeId are required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Corporate access admin required" });
    return;
  }

  const { data, error } = await supabase
    .from("corporate_access_codes")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", accessCodeId)
    .eq("trip_id", tripId)
    .select("id, status, revoked_at")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "guest_access_code.revoked",
    entityType: "corporate_access_code",
    entityId: accessCodeId
  });

  response.status(200).json({ accessCode: data });
}

async function removeAttendeeAccess(request, response, body) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const tripId = body.tripId || body.trip_id;
  const attendeeId = body.attendeeId || body.attendee_id;
  const requestedScope = sanitizeText(body.scope, "event", 40);
  if (!tripId || !attendeeId) {
    response.status(400).json({ error: "tripId and attendeeId are required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Corporate attendee admin required" });
    return;
  }

  const { data: selectedAttendee, error: attendeeError } = await supabase
    .from("corporate_attendees")
    .select("id, trip_id, organization_id, user_id, employee_id_hash, full_name")
    .eq("id", attendeeId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (attendeeError || !selectedAttendee) {
    response.status(404).json({ error: "Corporate attendee not found" });
    return;
  }

  let organizationWide = false;
  if (requestedScope === "organization" && selectedAttendee.organization_id) {
    const { data: orgAdmin } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", selectedAttendee.organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!orgAdmin) {
      response.status(403).json({ error: "Organization owner or admin access is required to remove all employee access" });
      return;
    }
    organizationWide = true;
  }

  let attendeeQuery = supabase
    .from("corporate_attendees")
    .select("id, trip_id, user_id")
    .eq("employee_id_hash", selectedAttendee.employee_id_hash);
  attendeeQuery = organizationWide
    ? attendeeQuery.eq("organization_id", selectedAttendee.organization_id)
    : attendeeQuery.eq("id", selectedAttendee.id);
  const { data: attendees, error: attendeesError } = await attendeeQuery;
  if (attendeesError || !attendees?.length) {
    response.status(500).json({ error: attendeesError?.message || "Employee access records could not be loaded" });
    return;
  }

  const attendeeIds = attendees.map((attendee) => attendee.id);
  const tripIds = [...new Set(attendees.map((attendee) => attendee.trip_id).filter(Boolean))];
  const linkedUserIds = [...new Set(attendees.map((attendee) => attendee.user_id).filter(Boolean))];
  const revokedAt = new Date().toISOString();

  const operations = [
    supabase.from("corporate_attendees").update({ access_status: "revoked" }).in("id", attendeeIds),
    supabase.from("corporate_access_codes").update({ status: "revoked", revoked_at: revokedAt, revoked_by: user.id }).in("assigned_attendee_id", attendeeIds),
    supabase.from("guest_sessions").update({ status: "revoked", revoked_at: revokedAt }).in("attendee_id", attendeeIds)
  ];
  if (linkedUserIds.length && tripIds.length) {
    operations.push(supabase.from("trip_members").update({ status: "removed" }).in("trip_id", tripIds).in("user_id", linkedUserIds));
  }
  if (organizationWide && linkedUserIds.length) {
    operations.push(supabase.from("organization_members").update({ status: "removed" }).eq("organization_id", selectedAttendee.organization_id).in("user_id", linkedUserIds));
  }
  const results = await Promise.all(operations);
  const operationError = results.find((result) => result.error)?.error;
  if (operationError) {
    response.status(500).json({ error: operationError.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    organizationId: selectedAttendee.organization_id,
    action: organizationWide ? "corporate_employee.access_removed" : "corporate_attendee.access_removed",
    entityType: "corporate_attendee",
    entityId: selectedAttendee.id,
    metadata: { scope: organizationWide ? "organization" : "event", revokedAttendeeCount: attendeeIds.length }
  });

  response.status(200).json({
    ok: true,
    scope: organizationWide ? "organization" : "event",
    revokedAttendeeCount: attendeeIds.length,
    message: organizationWide
      ? "Employee corporate access, reusable codes, event memberships, and active sessions were revoked."
      : "Employee access to this event and active sessions were revoked."
  });
}

async function updateAccessCode(request, response, body) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const tripId = body.tripId || body.trip_id;
  const accessCodeId = body.accessCodeId || body.access_code_id;
  if (!tripId || !accessCodeId) {
    response.status(400).json({ error: "tripId and accessCodeId are required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer", "finance_admin"]);
  if (!canManage) {
    response.status(403).json({ error: "Corporate access admin required" });
    return;
  }

  const updates = { updated_at: new Date().toISOString() };
  if (body.expiresAt || body.expires_at) updates.expires_at = body.expiresAt || body.expires_at;
  if (body.allowedStartAt || body.allowed_start_at) updates.allowed_start_at = body.allowedStartAt || body.allowed_start_at;
  if (body.allowedEndAt || body.allowed_end_at) updates.allowed_end_at = body.allowedEndAt || body.allowed_end_at;
  if (body.usageLimit !== undefined || body.usage_limit !== undefined) updates.usage_limit = Math.max(0, Number(body.usageLimit ?? body.usage_limit));
  if (body.status) updates.status = sanitizeText(body.status, "active", 40);
  if (body.code) {
    const code = sanitizeText(body.code, "", 80);
    if (!isSecureAccessCode(code)) {
      response.status(400).json({ error: "Access codes must be at least 8 characters and include letters and numbers." });
      return;
    }
    updates.code_hash = hashValue(code, "access-code");
    updates.code_hint = code.slice(-4);
    updates.failed_attempt_count = 0;
    updates.locked_until = null;
  }
  if (body.assignedRole || body.assigned_role) updates.assigned_role = sanitizeText(body.assignedRole || body.assigned_role, "employee", 40);
  if (body.assignedDepartment || body.assigned_department) updates.assigned_department = sanitizeText(body.assignedDepartment || body.assigned_department, "", 120);
  if (body.requiresLastName !== undefined || body.requires_last_name !== undefined) updates.requires_last_name = Boolean(body.requiresLastName ?? body.requires_last_name);
  if (body.requiresCompanyDomain !== undefined || body.requires_company_domain !== undefined) updates.requires_company_domain = Boolean(body.requiresCompanyDomain ?? body.requires_company_domain);
  if (body.companyDomain !== undefined || body.company_domain !== undefined) updates.company_domain = sanitizeText(body.companyDomain || body.company_domain, "", 180).toLowerCase().replace(/^@/, "");
  if (body.rememberDeviceAllowed !== undefined || body.remember_device_allowed !== undefined) updates.remember_device_allowed = Boolean(body.rememberDeviceAllowed ?? body.remember_device_allowed);
  if (body.maxFailedAttempts !== undefined || body.max_failed_attempts !== undefined) updates.max_failed_attempts = Math.max(1, Number(body.maxFailedAttempts ?? body.max_failed_attempts));
  if (body.metadata) updates.metadata = body.metadata;

  const { data, error } = await supabase
    .from("corporate_access_codes")
    .update(updates)
    .eq("id", accessCodeId)
    .eq("trip_id", tripId)
    .select("id, trip_id, code_type, assigned_role, assigned_department, expires_at, usage_limit, usage_count, status")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "guest_access_code.updated",
    entityType: "corporate_access_code",
    entityId: accessCodeId,
    metadata: updates
  });

  response.status(200).json({ accessCode: data });
}

async function chooseCurrentCorporateAttendee(supabase, attendees = []) {
  const tripIds = [...new Set(attendees.map((record) => record.trip_id).filter(Boolean))];
  if (!tripIds.length) return null;
  const { data: trips } = await supabase
    .from("trips")
    .select("id, starts_on, ends_on, status")
    .in("id", tripIds)
    .neq("status", "cancelled");
  const tripById = new Map((trips || []).map((trip) => [trip.id, trip]));
  const now = Date.now();
  const rank = (trip) => {
    const start = trip?.starts_on ? new Date(trip.starts_on).getTime() : now;
    const end = trip?.ends_on ? new Date(trip.ends_on).getTime() : start;
    if (start <= now && end >= now) return 0;
    if (start > now) return 1;
    return 2;
  };
  return attendees
    .filter((record) => tripById.has(record.trip_id))
    .sort((a, b) => {
      const aTrip = tripById.get(a.trip_id);
      const bTrip = tripById.get(b.trip_id);
      const rankDifference = rank(aTrip) - rank(bTrip);
      if (rankDifference) return rankDifference;
      const aStart = new Date(aTrip.starts_on || 0).getTime();
      const bStart = new Date(bTrip.starts_on || 0).getTime();
      return rank(aTrip) === 2 ? bStart - aStart : aStart - bStart;
    })[0] || null;
}

async function buildGuestPortal(supabase, attendee, session) {
  let historyAttendeeQuery = supabase
    .from("corporate_attendees")
    .select("id, trip_id, access_status, metadata, created_at")
    .eq("employee_id_hash", attendee.employee_id_hash)
    .in("access_status", ["active", "upgraded"]);
  historyAttendeeQuery = attendee.organization_id
    ? historyAttendeeQuery.eq("organization_id", attendee.organization_id)
    : historyAttendeeQuery.eq("trip_id", attendee.trip_id);
  let assignedFlightsQuery = supabase
    .from("flights")
    .select("airline, flight_number, departure_airport, arrival_airport, departs_at, arrives_at, status, details")
    .eq("trip_id", attendee.trip_id);
  assignedFlightsQuery = attendee.travel_record_id
    ? assignedFlightsQuery.eq("id", attendee.travel_record_id)
    : assignedFlightsQuery.eq("user_id", attendee.user_id || "00000000-0000-0000-0000-000000000000");

  const [tripResult, flightsResult, hotelsResult, transportationResult, scheduleResult, infoResult, mediaResult, historyAttendeesResult, walletResult, eventAttendeesResult] = await Promise.all([
    supabase.from("trips").select("id, title, destination, starts_on, ends_on, trip_type").eq("id", attendee.trip_id).single(),
    assignedFlightsQuery,
    supabase.from("hotels").select("hotel_name, address, check_in_at, check_out_at, confirmation_number, details").eq("trip_id", attendee.trip_id).eq("id", attendee.hotel_record_id || "00000000-0000-0000-0000-000000000000"),
    supabase.from("transportation_records").select("provider_name, transportation_type, pickup_location, dropoff_location, pickup_at, status, details").eq("trip_id", attendee.trip_id).eq("id", attendee.transportation_record_id || "00000000-0000-0000-0000-000000000000").in("transportation_type", ["ride_share", "rideshare", "ride-share"]),
    supabase.from("schedule_items").select("title, item_type, starts_at, ends_at, location_name, location_address, details").eq("trip_id", attendee.trip_id).in("visibility", ["members", "employees", "public"]).order("starts_at", { ascending: true }).limit(30),
    supabase.from("information_sections").select("section_type, title, body, pinned, requires_acknowledgment, version").eq("trip_id", attendee.trip_id).order("pinned", { ascending: false }).limit(30),
    supabase.from("media").select("storage_path, media_type, caption, metadata").eq("trip_id", attendee.trip_id).eq("visibility", "members").limit(16),
    historyAttendeeQuery,
    supabase.from("trip_virtual_wallets").select("id, currency, status, available_cents, settings").eq("trip_id", attendee.trip_id).maybeSingle(),
    supabase
      .from("corporate_attendees")
      .select("id, full_name, department, role, access_status, metadata")
      .eq("trip_id", attendee.trip_id)
      .in("access_status", ["active", "upgraded"])
      .limit(100)
  ]);

  const historyAttendees = historyAttendeesResult.data || [];
  const historyTripIds = [...new Set(historyAttendees.map((record) => record.trip_id).filter(Boolean))];
  const { data: historyTrips } = historyTripIds.length
    ? await supabase.from("trips").select("id, title, destination, starts_on, ends_on, trip_type, status").in("id", historyTripIds).order("starts_on", { ascending: false })
    : { data: [] };
  const historyAttendanceByTrip = new Map(historyAttendees.map((record) => [record.trip_id, record.metadata?.attendanceStatus || "attending"]));

  const wallet = walletResult.data || null;
  const { data: card } = wallet?.id
    ? await supabase.from("trip_wallet_cards").select("card_status, masked_last_four, tokenization_status, spend_controls, metadata").eq("trip_wallet_id", wallet.id).maybeSingle()
    : { data: null };
  const { data: personalContributions } = wallet?.id && attendee.user_id
    ? await supabase.from("trip_wallet_contributions").select("amount_cents, refundable_cents, status").eq("trip_wallet_id", wallet.id).eq("user_id", attendee.user_id).in("status", ["processing", "completed", "review_required"])
    : { data: [] };
  const personalFundsCents = (personalContributions || []).reduce((sum, contribution) => sum + Number(contribution.amount_cents || 0), 0);
  const stipendCents = Number(attendee.metadata?.stipendCents || wallet?.settings?.employee_stipend_cents || 0);

  return {
    session: {
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_at,
      permissions: session.permissions
    },
    attendee: {
      id: attendee.id,
      attendeeReference: attendee.attendee_reference,
      employeeIdMasked: attendee.employee_id_masked,
      fullName: attendee.full_name,
      department: attendee.department,
      role: attendee.role,
      accessStatus: attendee.access_status,
      attendanceStatus: attendee.metadata?.attendanceStatus || "attending",
      accountLinked: Boolean(attendee.user_id)
    },
    event: tripResult.data || null,
    myTravel: {
      flights: flightsResult.data || [],
      hotels: hotelsResult.data || [],
      transportation: transportationResult.data || []
    },
    myEvent: {
      schedule: scheduleResult.data || []
    },
    wallet: {
      currency: wallet?.currency || "USD",
      status: wallet?.status || "provider_required",
      stipendCents,
      personalFundsCents,
      card: card ? {
        status: card.card_status,
        maskedLastFour: card.masked_last_four,
        tokenizationStatus: card.tokenization_status,
        allowedCategories: card.spend_controls?.allowedCategories || []
      } : null,
      canAddFunds: Boolean(attendee.user_id && wallet?.status === "active")
    },
    eventHistory: (historyTrips || [])
      .filter((trip) => {
        if (trip.status === "cancelled") return false;
        if (!trip.ends_on && !trip.starts_on) return false;
        const eventEnd = new Date(trip.ends_on || trip.starts_on).getTime();
        const attendance = historyAttendanceByTrip.get(trip.id) || "attending";
        return trip.id !== attendee.trip_id
          && Number.isFinite(eventEnd)
          && eventEnd < Date.now()
          && !["declined", "cancelled", "not_attending"].includes(attendance);
      })
      .map((trip) => ({
        ...trip,
        attendanceStatus: ["attending", "confirmed"].includes(historyAttendanceByTrip.get(trip.id))
          ? "attended"
          : historyAttendanceByTrip.get(trip.id) || "attended"
      })),
    eventAttendees: (eventAttendeesResult.data || [])
      .filter((record) => record.metadata?.showInDirectory !== false
        && !["declined", "cancelled", "not_attending"].includes(record.metadata?.attendanceStatus))
      .map((record) => ({
        id: record.id,
        fullName: record.full_name,
        department: record.department,
        role: record.role,
        attendanceStatus: record.metadata?.attendanceStatus || "attending"
      })),
    importantInformation: infoResult.data || [],
    sharedPhotos: mediaResult.data || []
  };
}

async function verifyGuest(request, response, body) {
  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const accessCode = sanitizeText(body.accessCode || body.access_code, "", 100);
  const employeeId = sanitizeText(body.employeeId || body.employee_id || body.attendeeId || body.attendee_id, "", 120);
  const lastName = sanitizeText(body.lastName || body.last_name, "", 100).toLowerCase();
  const companyEmail = sanitizeText(body.companyEmail || body.company_email, "", 180).toLowerCase();

  if (!accessCode || !employeeId || !isSecureAccessCode(accessCode)) {
    response.status(400).json({ error: genericVerifyError });
    return;
  }

  const { data: code } = await supabase
    .from("corporate_access_codes")
    .select("*")
    .eq("code_hash", hashValue(accessCode, "access-code"))
    .maybeSingle();

  const now = new Date();
  const codeBlocked = !code
    || code.status !== "active"
    || new Date(code.expires_at) <= now
    || (code.allowed_start_at && new Date(code.allowed_start_at) > now)
    || (code.allowed_end_at && new Date(code.allowed_end_at) < now)
    || (code.usage_limit > 0 && code.usage_count >= code.usage_limit)
    || (code.locked_until && new Date(code.locked_until) > now);

  if (codeBlocked) {
    await logGuestAccess(supabase, request, {
      trip_id: code?.trip_id || null,
      organization_id: code?.organization_id || null,
      access_code_id: code?.id || null,
      action: "guest.verify",
      result: code?.status === "revoked" ? "revoked" : "failed",
      risk_status: "watch",
      metadata: { reason: "code_not_active" }
    });
    response.status(401).json({ error: genericVerifyError });
    return;
  }

  const registerFailedAttempt = async (reason, attendeeId = null) => {
    const failedCount = Number(code.failed_attempt_count || 0) + 1;
    const lockThreshold = Math.max(1, Number(code.max_failed_attempts || 5));
    const locksCode = failedCount >= lockThreshold;
    await supabase
      .from("corporate_access_codes")
      .update({
        failed_attempt_count: failedCount,
        locked_until: locksCode ? new Date(Date.now() + 1000 * 60 * 15).toISOString() : code.locked_until || null,
        status: code.status
      })
      .eq("id", code.id);
    await logGuestAccess(supabase, request, {
      trip_id: code.trip_id,
      organization_id: code.organization_id,
      access_code_id: code.id,
      attendee_id: attendeeId,
      action: "guest.verify",
      result: locksCode ? "blocked" : "failed",
      risk_status: locksCode ? "locked" : "watch",
      metadata: { reason, failedAttemptCount: failedCount }
    });
  };

  let { data: attendee } = await supabase
    .from("corporate_attendees")
    .select("*")
    .eq("trip_id", code.trip_id)
    .eq("employee_id_hash", hashValue(employeeId, "employee-id"))
    .maybeSingle();

  const emailRequired = Boolean(code.requires_email_verification);
  const lastNameRequired = code.requires_last_name !== false;
  const domainRequired = Boolean(code.requires_company_domain && code.company_domain);
  const emailDomain = companyEmail.includes("@") ? companyEmail.split("@").pop() : "";
  const attendeeMatches = attendee
    && ["active", "upgraded"].includes(attendee.access_status)
    && (!lastNameRequired || attendee.last_name === lastName)
    && (!emailRequired || attendee.company_email === companyEmail)
    && (!domainRequired || emailDomain === code.company_domain)
    && (!code.assigned_attendee_id || code.assigned_attendee_id === attendee.id);

  if (!attendeeMatches) {
    await registerFailedAttempt("attendee_not_verified", attendee?.id || null);
    response.status(401).json({ error: genericVerifyError });
    return;
  }

  if (code.metadata?.accessMode === "persistent" && attendee.organization_id) {
    const { data: organizationAttendees } = await supabase
      .from("corporate_attendees")
      .select("*")
      .eq("organization_id", attendee.organization_id)
      .eq("employee_id_hash", attendee.employee_id_hash)
      .in("access_status", ["active", "upgraded"]);
    attendee = await chooseCurrentCorporateAttendee(supabase, organizationAttendees || []) || attendee;
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const permissions = {
    viewPersonalTravel: true,
    viewSchedule: true,
    viewAnnouncements: true,
    viewApprovedPhotos: true,
    downloadApprovedDocuments: true,
    completeAcknowledgments: true,
    viewBudgets: false,
    approveExpenses: false,
    inviteAttendees: false
  };

  const { data: session, error: sessionError } = await supabase
    .from("guest_sessions")
    .insert({
      attendee_id: attendee.id,
      trip_id: attendee.trip_id,
      access_code_id: code.id,
      session_token_hash: hashValue(token, "guest-session"),
      device_information: getDeviceInformation(request),
      ip_address: null,
      created_at_ip_hash: getIpHash(request),
      expires_at: expiresAt,
      remembered_device: Boolean(body.rememberDevice || body.remember_device) && Boolean(code.remember_device_allowed),
      event_access_scope: code.metadata?.accessMode === "persistent" ? "multi_event" : "single_event",
      last_revalidated_at: new Date().toISOString(),
      permissions
    })
    .select("*")
    .single();

  if (sessionError) {
    response.status(500).json({ error: sessionError.message });
    return;
  }

  await supabase
    .from("corporate_access_codes")
    .update({ usage_count: code.usage_count + 1, failed_attempt_count: 0, locked_until: null })
    .eq("id", code.id);

  await logGuestAccess(supabase, request, {
    trip_id: code.trip_id,
    organization_id: code.organization_id,
    access_code_id: code.id,
    attendee_id: attendee.id,
    guest_session_id: session.id,
    action: "guest.verify",
    result: "success",
    risk_status: "normal",
    metadata: { role: attendee.role, department: attendee.department }
  });

  const portal = await buildGuestPortal(supabase, attendee, session);
  response.status(200).json({ guestSessionToken: token, portal });
}

async function getGuestPortal(request, response) {
  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const token = getBearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Guest session required" });
    return;
  }

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("*, corporate_attendees(*)")
    .eq("session_token_hash", hashValue(token, "guest-session"))
    .maybeSingle();

  if (!session || session.status !== "active" || new Date(session.expires_at) <= new Date() || session.revoked_at) {
    response.status(401).json({ error: "Guest session expired. Please reverify your identity." });
    return;
  }

  if (!session.corporate_attendees || !["active", "upgraded"].includes(session.corporate_attendees.access_status)) {
    await supabase
      .from("guest_sessions")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", session.id);
    response.status(403).json({ error: "Your employer has removed access to this corporate workspace." });
    return;
  }

  await supabase
    .from("guest_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", session.id);

  await logGuestAccess(supabase, request, {
    trip_id: session.trip_id,
    attendee_id: session.attendee_id,
    access_code_id: session.access_code_id,
    guest_session_id: session.id,
    action: "guest.portal.viewed",
    result: "success",
    risk_status: "normal"
  });

  const portal = await buildGuestPortal(supabase, session.corporate_attendees, session);
  response.status(200).json({ portal });
}

async function getAccountCorporatePortal(request, response) {
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  const { data: attendees, error } = await supabase
    .from("corporate_attendees")
    .select("*")
    .eq("user_id", user.id)
    .in("access_status", ["active", "upgraded"])
    .limit(100);
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const attendee = await chooseCurrentCorporateAttendee(supabase, attendees || []);
  if (!attendee) {
    response.status(404).json({ error: "No active corporate employee access is linked to this account." });
    return;
  }

  const portal = await buildGuestPortal(supabase, attendee, {
    expires_at: null,
    last_activity_at: new Date().toISOString(),
    permissions: {
      viewPersonalTravel: true,
      viewSchedule: true,
      viewAnnouncements: true,
      viewApprovedPhotos: true,
      viewBudgets: false,
      approveExpenses: false,
      inviteAttendees: false
    }
  });

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId: attendee.trip_id,
    organizationId: attendee.organization_id,
    action: "corporate_employee.portal_viewed",
    entityType: "corporate_attendee",
    entityId: attendee.id
  });

  response.status(200).json({ portal, accountLinked: true });
}

async function endGuestSession(request, response, body) {
  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const token = getBearerToken(request) || body.guestSessionToken || body.guest_session_token;
  if (!token) {
    response.status(401).json({ error: "Guest session required" });
    return;
  }

  const { data, error } = await supabase
    .from("guest_sessions")
    .update({
      status: "ended",
      revoked_at: new Date().toISOString()
    })
    .eq("session_token_hash", hashValue(token, "guest-session"))
    .select("id, trip_id, attendee_id, access_code_id")
    .maybeSingle();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  if (data) {
    await logGuestAccess(supabase, request, {
      trip_id: data.trip_id,
      attendee_id: data.attendee_id,
      access_code_id: data.access_code_id,
      guest_session_id: data.id,
      action: "guest.session.ended",
      result: "success",
      risk_status: "normal"
    });
  }

  response.status(200).json({ ok: true });
}

async function refreshGuestSession(request, response, body) {
  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const token = getBearerToken(request) || body.guestSessionToken || body.guest_session_token;
  if (!token) {
    response.status(401).json({ error: "Guest session required" });
    return;
  }

  const { data: existingSession } = await supabase
    .from("guest_sessions")
    .select("id, corporate_attendees(access_status)")
    .eq("session_token_hash", hashValue(token, "guest-session"))
    .eq("status", "active")
    .maybeSingle();
  if (!existingSession || !["active", "upgraded"].includes(existingSession.corporate_attendees?.access_status)) {
    response.status(403).json({ error: "Your employer has removed access to this corporate workspace." });
    return;
  }

  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const { data, error } = await supabase
    .from("guest_sessions")
    .update({
      expires_at: expiresAt,
      last_activity_at: new Date().toISOString()
    })
    .eq("session_token_hash", hashValue(token, "guest-session"))
    .eq("status", "active")
    .select("id, trip_id, attendee_id, access_code_id, expires_at")
    .maybeSingle();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    response.status(401).json({ error: "Guest session expired. Please reverify your identity." });
    return;
  }

  await logGuestAccess(supabase, request, {
    trip_id: data.trip_id,
    attendee_id: data.attendee_id,
    access_code_id: data.access_code_id,
    guest_session_id: data.id,
    action: "guest.session.refreshed",
    result: "success",
    risk_status: "normal"
  });

  response.status(200).json({ expiresAt: data.expires_at });
}

async function submitGuestAcknowledgment(request, response, body) {
  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const token = getBearerToken(request) || body.guestSessionToken || body.guest_session_token;
  const informationSectionId = body.informationSectionId || body.information_section_id;
  const version = Math.max(1, Number(body.version || 1));
  if (!token || !informationSectionId) {
    response.status(400).json({ error: "Guest session and informationSectionId are required" });
    return;
  }

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("id, trip_id, attendee_id, status, expires_at, corporate_attendees(user_id)")
    .eq("session_token_hash", hashValue(token, "guest-session"))
    .maybeSingle();

  if (!session || session.status !== "active" || new Date(session.expires_at) <= new Date()) {
    response.status(401).json({ error: "Guest session expired. Please reverify your identity." });
    return;
  }

  const userId = session.corporate_attendees?.user_id;
  if (!userId) {
    response.status(409).json({ error: "A full account is required to permanently attach this acknowledgment." });
    return;
  }

  const { data, error } = await supabase
    .from("acknowledgments")
    .upsert({
      information_section_id: informationSectionId,
      user_id: userId,
      version
    }, { onConflict: "information_section_id,user_id,version" })
    .select("*")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await logGuestAccess(supabase, request, {
    trip_id: session.trip_id,
    attendee_id: session.attendee_id,
    guest_session_id: session.id,
    action: "guest.acknowledgment.submitted",
    result: "success",
    risk_status: "normal",
    metadata: { informationSectionId, version }
  });

  response.status(200).json({ acknowledgment: data });
}

async function queueGuestOtp(request, response, body) {
  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const accessCode = sanitizeText(body.accessCode || body.access_code, "", 100);
  const companyEmail = sanitizeText(body.companyEmail || body.company_email, "", 180).toLowerCase();
  if (!accessCode || !companyEmail) {
    response.status(400).json({ error: "Access code and company email are required" });
    return;
  }

  const { data: code } = await supabase
    .from("corporate_access_codes")
    .select("id, trip_id, organization_id, status")
    .eq("code_hash", hashValue(accessCode, "access-code"))
    .maybeSingle();

  if (code?.status === "active") {
    await supabase.from("background_jobs").insert({
      job_type: "guest_access_otp",
      payload: {
        tripId: code.trip_id,
        accessCodeId: code.id,
        companyEmailHash: hashValue(companyEmail, "email")
      }
    });
  }

  await logGuestAccess(supabase, request, {
    trip_id: code?.trip_id || null,
    organization_id: code?.organization_id || null,
    access_code_id: code?.id || null,
    action: "guest.otp.requested",
    result: "success",
    risk_status: "normal"
  });

  response.status(202).json({ ok: true, message: "If your information matches, a verification code will be sent." });
}

async function upgradeGuestToAccount(request, response, body) {
  const accountToken = sanitizeText(body.accountAccessToken || body.account_access_token, "", 1200);
  const guestToken = getBearerToken(request) || body.guestSessionToken || body.guest_session_token;
  if (!accountToken || !guestToken) {
    response.status(400).json({ error: "accountAccessToken and guest session are required" });
    return;
  }

  const { client: supabase, error: configError } = createSupabaseAdminClient();
  if (configError) {
    response.status(503).json({ error: configError });
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accountToken);
  if (userError || !userData.user) {
    response.status(401).json({ error: "Authenticated account required" });
    return;
  }

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("id, trip_id, attendee_id, status, expires_at, corporate_attendees(user_id, organization_id, employee_id_hash, role, access_status)")
    .eq("session_token_hash", hashValue(guestToken, "guest-session"))
    .maybeSingle();

  if (!session || session.status !== "active" || new Date(session.expires_at) <= new Date()) {
    response.status(401).json({ error: "Guest session expired. Please reverify your identity." });
    return;
  }

  if (!["active", "upgraded"].includes(session.corporate_attendees?.access_status)) {
    response.status(403).json({ error: "Your employer has removed access to this corporate workspace." });
    return;
  }
  if (session.corporate_attendees?.user_id && session.corporate_attendees.user_id !== userData.user.id) {
    response.status(409).json({ error: "This employee access is already linked to a different personal account." });
    return;
  }

  const { data: employeeAttendees } = session.corporate_attendees?.organization_id
    ? await supabase
      .from("corporate_attendees")
      .select("id, trip_id, user_id, access_status")
      .eq("organization_id", session.corporate_attendees.organization_id)
      .eq("employee_id_hash", session.corporate_attendees.employee_id_hash)
      .in("access_status", ["active", "upgraded"])
    : { data: [{ id: session.attendee_id, trip_id: session.trip_id, user_id: session.corporate_attendees?.user_id, access_status: session.corporate_attendees?.access_status }] };
  if ((employeeAttendees || []).some((attendee) => attendee.user_id && attendee.user_id !== userData.user.id)) {
    response.status(409).json({ error: "This employee identity is already linked to a different personal account." });
    return;
  }

  const { data, error } = await supabase
    .from("corporate_attendees")
    .update({
      user_id: userData.user.id,
      access_status: "upgraded"
    })
    .eq("id", session.attendee_id)
    .select("id, trip_id, user_id, full_name, access_status")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const linkableAttendeeIds = (employeeAttendees || []).map((attendee) => attendee.id).filter(Boolean);
  if (linkableAttendeeIds.length > 1) {
    const { error: linkError } = await supabase
      .from("corporate_attendees")
      .update({ user_id: userData.user.id, access_status: "upgraded" })
      .in("id", linkableAttendeeIds);
    if (linkError) {
      response.status(500).json({ error: linkError.message });
      return;
    }
  }

  const attendeeRole = ["employee", "guest", "vendor"].includes(session.corporate_attendees?.role)
    ? session.corporate_attendees.role
    : "employee";
  const linkedTripIds = [...new Set((employeeAttendees || []).map((attendee) => attendee.trip_id).filter(Boolean))];
  for (const tripId of linkedTripIds) {
    const { data: currentTripMember } = await supabase
      .from("trip_members")
      .select("id, role")
      .eq("trip_id", tripId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (currentTripMember) {
      await supabase.from("trip_members").update({ status: "active" }).eq("id", currentTripMember.id);
    } else {
      await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: userData.user.id,
        role: attendeeRole,
        status: "active",
        permissions: { corporateEmployee: true },
        privacy_settings: { corporateEventOnly: true }
      });
    }
  }

  if (session.corporate_attendees?.organization_id) {
    const { data: currentOrganizationMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", session.corporate_attendees.organization_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (currentOrganizationMember) {
      await supabase.from("organization_members").update({ status: "active" }).eq("id", currentOrganizationMember.id);
    } else {
      await supabase.from("organization_members").insert({
        organization_id: session.corporate_attendees.organization_id,
        user_id: userData.user.id,
        role: "employee",
        status: "active",
        permissions: { employeePortal: true }
      });
    }
  }

  await logGuestAccess(supabase, request, {
    trip_id: session.trip_id,
    attendee_id: session.attendee_id,
    guest_session_id: session.id,
    action: "guest.account.upgraded",
    result: "success",
    risk_status: "normal"
  });

  response.status(200).json({ attendee: data, linked: true });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);

  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST, PATCH, DELETE");
    return;
  }

  // Never hash guest credentials with a predictable fallback or a service-role key.
  if (!isGuestAccessConfigured()) {
    response.status(503).json({ error: "Corporate guest access is not configured on this deployment." });
    return;
  }

  const body = getRequestBody(request);
  const action = sanitizeText(body.action || new URL(request.url, "https://traveldrip.local").searchParams.get("action"), "", 80);

  if (request.method === "GET" && action === "list-invites") {
    await listCorporateInvites(request, response);
    return;
  }

  if (request.method === "GET" && action === "account-portal") {
    await getAccountCorporatePortal(request, response);
    return;
  }

  if (request.method === "GET") {
    await getGuestPortal(request, response);
    return;
  }

  if (request.method === "DELETE" || action === "end-session") {
    await endGuestSession(request, response, body);
    return;
  }

  if (action === "create-code") {
    await createAccessCode(request, response, body);
    return;
  }

  if (action === "update-code") {
    await updateAccessCode(request, response, body);
    return;
  }

  if (action === "upsert-attendee") {
    await upsertAttendee(request, response, body);
    return;
  }

  if (action === "revoke-code") {
    await revokeAccessCode(request, response, body);
    return;
  }

  if (action === "remove-attendee-access") {
    await removeAttendeeAccess(request, response, body);
    return;
  }

  if (action === "refresh-session") {
    await refreshGuestSession(request, response, body);
    return;
  }

  if (action === "submit-acknowledgment") {
    await submitGuestAcknowledgment(request, response, body);
    return;
  }

  if (action === "send-otp") {
    await queueGuestOtp(request, response, body);
    return;
  }

  if (action === "upgrade-account") {
    await upgradeGuestToAccount(request, response, body);
    return;
  }

  if (action === "verify") {
    await verifyGuest(request, response, body);
    return;
  }

  response.status(400).json({ error: "Unsupported guest access action" });
}
