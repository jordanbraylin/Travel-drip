import crypto from "node:crypto";
import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  sanitizeText,
  writeAuditLog
} from "./_security.js";
import { canTransitionCorporateBooking, evaluateCorporatePolicy } from "./_corporate-policy.js";

const corporateTripTypes = new Set(["corporate_retreat", "business_event", "conference"]);
const managerRoles = new Set(["owner", "admin", "organizer"]);
const approverRoles = new Set(["owner", "admin", "finance_admin"]);
const serviceRoles = new Set(["owner", "admin", "organizer", "team_lead"]);
const bookingTypes = new Set(["flight", "hotel", "rail", "car", "transportation", "restaurant", "activity", "conference", "other"]);
const caseTypes = new Set(["change", "cancellation", "disruption", "emergency", "accessibility", "billing", "other"]);
const casePriorities = new Set(["normal", "high", "urgent", "critical"]);
const bookingActions = new Set(["approve", "reject", "confirm", "ticket", "start", "complete", "cancel", "refund", "fail"]);

function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => sanitizeText(item, "", 120)).filter(Boolean).slice(0, 100)
    : [];
}

async function queueCorporateNotifications(supabase, notifications) {
  const rows = notifications.filter((notification) => notification.user_id);
  if (!rows.length) return;
  await supabase.from("notifications").insert(rows);
}

async function getTripUsersByRole(supabase, tripId, roles) {
  const { data } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("status", "active")
    .in("role", roles);
  return [...new Set((data || []).map((member) => member.user_id).filter(Boolean))];
}

async function getCorporateContext(supabase, tripId, userId) {
  const [{ data: membership }, { data: trip }] = await Promise.all([
    supabase.from("trip_members").select("role, status").eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
    supabase.from("trips").select("id, organization_id, trip_type, title, status").eq("id", tripId).maybeSingle()
  ]);
  if (!membership || membership.status !== "active" || !trip) return { error: "Corporate trip access required" };
  if (!corporateTripTypes.has(trip.trip_type)) return { error: "This endpoint is limited to corporate trips and events" };
  return { role: membership.role, trip };
}

async function listOperations(response, supabase, user, context, tripId) {
  const canManage = managerRoles.has(context.role) || approverRoles.has(context.role) || serviceRoles.has(context.role);
  let bookingsQuery = supabase.from("corporate_bookings").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(200);
  let casesQuery = supabase.from("corporate_service_cases").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(100);
  let attendeesQuery = supabase.from("corporate_attendees").select("id, user_id, travel_record_id, hotel_record_id, transportation_record_id, metadata").eq("trip_id", tripId).eq("access_status", "active").limit(500);
  if (!canManage) {
    bookingsQuery = bookingsQuery.or(`traveler_user_id.eq.${user.id},created_by.eq.${user.id}`);
    casesQuery = casesQuery.or(`traveler_user_id.eq.${user.id},created_by.eq.${user.id}`);
    attendeesQuery = attendeesQuery.eq("user_id", user.id);
  }

  const [policyResult, bookingsResult, approvalsResult, casesResult, attendeesResult] = await Promise.all([
    supabase.from("corporate_travel_policies").select("*").eq("trip_id", tripId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    bookingsQuery,
    canManage
      ? supabase.from("corporate_booking_approvals").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    casesQuery,
    attendeesQuery
  ]);

  const error = policyResult.error || bookingsResult.error || approvalsResult.error || casesResult.error || attendeesResult.error;
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  const attendees = attendeesResult.data || [];
  const bookings = bookingsResult.data || [];
  const cases = casesResult.data || [];
  const coveredAttendees = new Set(bookings.flatMap((booking) => [booking.attendee_id, booking.traveler_user_id]).filter(Boolean));
  const readiness = {
    totalTravelers: attendees.length,
    coveredTravelers: attendees.filter((attendee) => attendee.travel_record_id || attendee.hotel_record_id || attendee.transportation_record_id || coveredAttendees.has(attendee.id) || coveredAttendees.has(attendee.user_id)).length,
    documentsComplete: attendees.filter((attendee) => attendee.metadata?.documentsComplete === true || attendee.metadata?.documentStatus === "complete").length,
    emergencyContactsVerified: attendees.filter((attendee) => attendee.metadata?.emergencyContactVerified === true).length,
    activeDisruptions: cases.filter((serviceCase) => ["disruption", "emergency"].includes(serviceCase.case_type) && !["resolved", "closed"].includes(serviceCase.status)).length
  };

  response.status(200).json({
    trip: context.trip,
    role: context.role,
    permissions: {
      canManageBookings: managerRoles.has(context.role),
      canApprove: approverRoles.has(context.role),
      canManageService: serviceRoles.has(context.role),
      canManagePolicy: ["owner", "admin", "finance_admin"].includes(context.role)
    },
    policy: policyResult.data || null,
    bookings,
    approvals: approvalsResult.data || [],
    serviceCases: cases,
    readiness
  });
}

async function savePolicy(response, supabase, user, context, tripId, body) {
  if (!["owner", "admin", "finance_admin"].includes(context.role)) {
    response.status(403).json({ error: "Corporate policy administrator access required" });
    return;
  }
  const record = {
    organization_id: context.trip.organization_id,
    trip_id: tripId,
    name: sanitizeText(body.name, "Corporate travel policy", 160),
    status: "active",
    currency: sanitizeText(body.currency, "USD", 12).toUpperCase(),
    flight_cabin: sanitizeText(body.flightCabin || body.flight_cabin, "economy", 40),
    flight_cap_cents: cents(body.flightCapCents || body.flight_cap_cents),
    hotel_nightly_cap_cents: cents(body.hotelNightlyCapCents || body.hotel_nightly_cap_cents),
    ground_transport_cap_cents: cents(body.groundTransportCapCents || body.ground_transport_cap_cents),
    meal_daily_cap_cents: cents(body.mealDailyCapCents || body.meal_daily_cap_cents),
    advance_booking_days: Math.max(0, Number(body.advanceBookingDays || body.advance_booking_days || 0)),
    receipt_threshold_cents: cents(body.receiptThresholdCents || body.receipt_threshold_cents),
    allowed_airlines: stringArray(body.allowedAirlines || body.allowed_airlines),
    allowed_hotel_categories: stringArray(body.allowedHotelCategories || body.allowed_hotel_categories),
    allowed_transport_providers: stringArray(body.allowedTransportProviders || body.allowed_transport_providers),
    approval_rules: body.approvalRules || body.approval_rules || {},
    rules: body.rules || {},
    created_by: user.id,
    updated_by: user.id
  };
  const { data, error } = await supabase.from("corporate_travel_policies").insert(record).select("*").single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  const { error: retirementError } = await supabase
    .from("corporate_travel_policies")
    .update({ status: "retired", updated_by: user.id })
    .eq("trip_id", tripId)
    .eq("status", "active")
    .neq("id", data.id);
  if (retirementError) {
    response.status(500).json({ error: `Policy saved, but the previous version could not be retired: ${retirementError.message}` });
    return;
  }
  await writeAuditLog(supabase, { actorUserId: user.id, tripId, organizationId: context.trip.organization_id, action: "corporate.policy.activated", entityType: "corporate_travel_policy", entityId: data.id, metadata: { name: data.name } });
  response.status(201).json({ policy: data });
}

async function createBooking(response, supabase, user, context, tripId, body) {
  if (!managerRoles.has(context.role)) {
    response.status(403).json({ error: "Corporate booking manager access required" });
    return;
  }
  const bookingType = sanitizeText(body.bookingType || body.booking_type, "other", 40);
  if (!bookingTypes.has(bookingType)) {
    response.status(400).json({ error: "Unsupported booking type" });
    return;
  }
  const providerName = sanitizeText(body.providerName || body.provider_name, "", 160);
  const travelerName = sanitizeText(body.travelerName || body.traveler_name, "", 160);
  if (!providerName || !travelerName) {
    response.status(400).json({ error: "travelerName and providerName are required" });
    return;
  }
  const { data: policy } = await supabase.from("corporate_travel_policies").select("*").eq("trip_id", tripId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const normalized = {
    bookingType,
    providerName,
    totalCents: cents(body.totalCents || body.total_cents),
    details: body.details && typeof body.details === "object" ? body.details : {}
  };
  const decision = evaluateCorporatePolicy(policy, normalized);
  if (decision.status === "blocked") {
    response.status(422).json({ error: decision.reasons.join("; ") || "This supplier is blocked by corporate travel policy" });
    return;
  }
  const providerReference = sanitizeText(body.providerReference || body.provider_reference, "", 160);
  const providerConfirmed = body.providerConfirmed === true || body.provider_confirmed === true;
  const initialStatus = providerConfirmed && providerReference && decision.status === "compliant" ? "confirmed" : "requested";
  const approvalStatus = decision.status === "compliant" ? "not_required" : "pending";
  const idempotencyKey = sanitizeText(body.idempotencyKey || body.idempotency_key, crypto.randomUUID(), 180);
  const travelerEmail = sanitizeText(body.travelerEmail || body.traveler_email, "", 180).toLowerCase();
  let travelerUserId = body.travelerUserId || body.traveler_user_id || null;
  let attendeeId = body.attendeeId || body.attendee_id || null;
  if (!travelerUserId && travelerEmail) {
    const { data: attendee } = await supabase
      .from("corporate_attendees")
      .select("id, user_id")
      .eq("trip_id", tripId)
      .ilike("company_email", travelerEmail)
      .maybeSingle();
    travelerUserId = attendee?.user_id || null;
    attendeeId = attendee?.id || attendeeId;
  }

  const { data: booking, error } = await supabase.from("corporate_bookings").insert({
    organization_id: context.trip.organization_id,
    trip_id: tripId,
    policy_id: policy?.id || null,
    traveler_user_id: travelerUserId,
    attendee_id: attendeeId,
    booking_type: bookingType,
    traveler_name: travelerName,
    traveler_email: travelerEmail || null,
    provider_name: providerName,
    provider_reference: providerReference || null,
    provider_status: providerConfirmed && providerReference ? "confirmed" : (providerReference ? "manual" : "pending"),
    source: sanitizeText(body.source, "manual", 40),
    title: sanitizeText(body.title, `${bookingType} for ${travelerName}`, 200),
    origin: sanitizeText(body.origin, "", 180) || null,
    destination: sanitizeText(body.destination, "", 180) || null,
    starts_at: body.startsAt || body.starts_at || null,
    ends_at: body.endsAt || body.ends_at || null,
    currency: sanitizeText(body.currency, "USD", 12).toUpperCase(),
    total_cents: normalized.totalCents,
    status: initialStatus,
    policy_status: decision.status,
    approval_status: approvalStatus,
    confirmation_verified_at: initialStatus === "confirmed" ? new Date().toISOString() : null,
    cancellation_deadline: body.cancellationDeadline || body.cancellation_deadline || null,
    idempotency_key: idempotencyKey,
    details: { ...normalized.details, policyReasons: decision.reasons },
    created_by: user.id,
    updated_by: user.id
  }).select("*").single();

  if (error) {
    response.status(error.code === "23505" ? 409 : 500).json({ error: error.code === "23505" ? "This booking request was already submitted" : error.message });
    return;
  }

  let approval = null;
  if (approvalStatus === "pending") {
    const result = await supabase.from("corporate_booking_approvals").insert({
      organization_id: context.trip.organization_id,
      trip_id: tripId,
      booking_id: booking.id,
      requested_by: user.id,
      assigned_role: "finance_admin",
      status: "pending",
      reason: decision.reasons.join("; ") || "Policy review required",
      metadata: { policyStatus: decision.status }
    }).select("*").single();
    approval = result.data || null;
  }

  const notifications = [];
  if (travelerUserId) {
    notifications.push({
      trip_id: tripId,
      user_id: travelerUserId,
      notification_type: "corporate_booking_created",
      title: "Business travel request updated",
      body: `${booking.title} is ${String(booking.status).replaceAll("_", " ")}.`,
      channels: ["in_app", "push"],
      status: "queued",
      metadata: { bookingId: booking.id, policyStatus: decision.status }
    });
  }
  if (approvalStatus === "pending") {
    const approverUserIds = await getTripUsersByRole(supabase, tripId, ["owner", "admin", "finance_admin"]);
    approverUserIds.forEach((userId) => notifications.push({
      trip_id: tripId,
      user_id: userId,
      notification_type: "corporate_booking_approval_required",
      title: "Travel approval required",
      body: `${booking.title} for ${travelerName} needs a policy exception decision.`,
      channels: ["in_app", "push"],
      status: "queued",
      metadata: { bookingId: booking.id, reasons: decision.reasons }
    }));
  }
  await queueCorporateNotifications(supabase, notifications);

  await writeAuditLog(supabase, { actorUserId: user.id, tripId, organizationId: context.trip.organization_id, action: "corporate.booking.created", entityType: "corporate_booking", entityId: booking.id, metadata: { bookingType, policyStatus: decision.status, providerConfirmed } });
  response.status(201).json({ booking, approval, policyDecision: decision });
}

async function createServiceCase(response, supabase, user, context, tripId, body) {
  const caseType = sanitizeText(body.caseType || body.case_type, "other", 40);
  const priority = sanitizeText(body.priority, "normal", 40);
  if (!caseTypes.has(caseType) || !casePriorities.has(priority)) {
    response.status(400).json({ error: "Valid caseType and priority are required" });
    return;
  }
  const subject = sanitizeText(body.subject, "", 200);
  const description = sanitizeText(body.description, "", 2000);
  if (!subject || !description) {
    response.status(400).json({ error: "subject and description are required" });
    return;
  }
  const slaHours = priority === "critical" ? 1 : priority === "urgent" ? 4 : priority === "high" ? 12 : 24;
  const { data, error } = await supabase.from("corporate_service_cases").insert({
    organization_id: context.trip.organization_id,
    trip_id: tripId,
    booking_id: body.bookingId || body.booking_id || null,
    traveler_user_id: body.travelerUserId || body.traveler_user_id || user.id,
    created_by: user.id,
    case_type: caseType,
    priority,
    status: "open",
    subject,
    description,
    sla_due_at: new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString(),
    metadata: body.metadata || {}
  }).select("*").single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  const serviceUserIds = await getTripUsersByRole(supabase, tripId, ["owner", "admin", "organizer", "team_lead"]);
  await queueCorporateNotifications(supabase, serviceUserIds.map((userId) => ({
    trip_id: tripId,
    user_id: userId,
    notification_type: "corporate_service_case_created",
    title: `${priority === "critical" ? "Critical " : ""}traveler-care case`,
    body: subject,
    channels: ["in_app", "push"],
    status: "queued",
    metadata: { caseId: data.id, caseType, priority }
  })));
  await writeAuditLog(supabase, { actorUserId: user.id, tripId, organizationId: context.trip.organization_id, action: "corporate.service_case.created", entityType: "corporate_service_case", entityId: data.id, metadata: { caseType, priority } });
  response.status(201).json({ serviceCase: data });
}

async function updateBooking(response, supabase, user, context, tripId, body) {
  const bookingId = body.bookingId || body.booking_id;
  const action = sanitizeText(body.action, "", 40);
  if (!bookingId || !bookingActions.has(action)) {
    response.status(400).json({ error: "bookingId and a valid action are required" });
    return;
  }
  const isApproval = ["approve", "reject"].includes(action);
  if (isApproval ? !approverRoles.has(context.role) : !(managerRoles.has(context.role) || approverRoles.has(context.role))) {
    response.status(403).json({ error: isApproval ? "Corporate approver access required" : "Corporate booking manager access required" });
    return;
  }
  const { data: existing } = await supabase.from("corporate_bookings").select("*").eq("id", bookingId).eq("trip_id", tripId).maybeSingle();
  if (!existing) {
    response.status(404).json({ error: "Booking not found" });
    return;
  }
  const transitions = {
    approve: { approval_status: "approved", status: existing.provider_status === "confirmed" ? "confirmed" : "approved" },
    reject: { approval_status: "rejected", status: "cancelled" },
    confirm: { status: "confirmed", provider_status: "confirmed", confirmation_verified_at: new Date().toISOString() },
    ticket: { status: "ticketed", provider_status: "confirmed", confirmation_verified_at: existing.confirmation_verified_at || new Date().toISOString() },
    start: { status: "in_progress" },
    complete: { status: "completed" },
    cancel: { status: "cancelled", provider_status: "cancelled" },
    refund: { status: "refunded" },
    fail: { status: "failed", provider_status: "failed" }
  };
  const providerReference = sanitizeText(body.providerReference || body.provider_reference || existing.provider_reference, "", 160);
  if (["confirm", "ticket"].includes(action) && !providerReference) {
    response.status(409).json({ error: "Provider reference is required before a booking can be confirmed or ticketed" });
    return;
  }
  if (["confirm", "ticket"].includes(action) && !["not_required", "approved"].includes(existing.approval_status)) {
    response.status(409).json({ error: "Finance approval is required before this booking can be confirmed or ticketed" });
    return;
  }
  if (!canTransitionCorporateBooking(existing.status, action)) {
    response.status(409).json({ error: `Cannot ${action} a booking with status ${existing.status}` });
    return;
  }
  const updates = { ...transitions[action], provider_reference: providerReference || null, updated_by: user.id };
  const { data, error } = await supabase.from("corporate_bookings").update(updates).eq("id", bookingId).eq("trip_id", tripId).select("*").single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  if (isApproval) {
    await supabase.from("corporate_booking_approvals").update({ status: action === "approve" ? "approved" : "rejected", decision_note: sanitizeText(body.note, "", 1000), decided_by: user.id, decided_at: new Date().toISOString() }).eq("booking_id", bookingId).eq("status", "pending");
  }
  await queueCorporateNotifications(supabase, existing.traveler_user_id ? [{
    trip_id: tripId,
    user_id: existing.traveler_user_id,
    notification_type: "corporate_booking_status_changed",
    title: "Business travel status changed",
    body: `${existing.title} is now ${String(data.status).replaceAll("_", " ")}.`,
    channels: ["in_app", "push"],
    status: "queued",
    metadata: { bookingId, action, status: data.status }
  }] : []);
  await writeAuditLog(supabase, { actorUserId: user.id, tripId, organizationId: context.trip.organization_id, action: `corporate.booking.${action}`, entityType: "corporate_booking", entityId: bookingId, metadata: { providerReference: providerReference || null } });
  response.status(200).json({ booking: data });
}

async function updateServiceCase(response, supabase, user, context, tripId, body) {
  if (!serviceRoles.has(context.role)) {
    response.status(403).json({ error: "Corporate service-team access required" });
    return;
  }
  const caseId = body.caseId || body.case_id;
  const status = sanitizeText(body.status, "", 40);
  const validStatuses = new Set(["open", "in_progress", "waiting_provider", "waiting_traveler", "resolved", "closed"]);
  if (!caseId || !validStatuses.has(status)) {
    response.status(400).json({ error: "caseId and valid status are required" });
    return;
  }
  const { data: existing } = await supabase.from("corporate_service_cases").select("traveler_user_id, subject").eq("id", caseId).eq("trip_id", tripId).maybeSingle();
  const { data, error } = await supabase.from("corporate_service_cases").update({
    status,
    assigned_to: body.assignedTo || body.assigned_to || user.id,
    resolution: sanitizeText(body.resolution, "", 2000) || null,
    resolved_at: ["resolved", "closed"].includes(status) ? new Date().toISOString() : null
  }).eq("id", caseId).eq("trip_id", tripId).select("*").single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  await queueCorporateNotifications(supabase, existing?.traveler_user_id ? [{
    trip_id: tripId,
    user_id: existing.traveler_user_id,
    notification_type: "corporate_service_case_updated",
    title: "Traveler-care case updated",
    body: `${existing.subject || "Your request"} is ${String(status).replaceAll("_", " ")}.`,
    channels: ["in_app", "push"],
    status: "queued",
    metadata: { caseId, status }
  }] : []);
  await writeAuditLog(supabase, { actorUserId: user.id, tripId, organizationId: context.trip.organization_id, action: `corporate.service_case.${status}`, entityType: "corporate_service_case", entityId: caseId });
  response.status(200).json({ serviceCase: data });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST, PATCH");
    return;
  }
  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;
  const body = getRequestBody(request);
  const url = new URL(request.url, "https://traveldrip.local");
  const tripId = body.tripId || body.trip_id || url.searchParams.get("tripId");
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }
  const context = await getCorporateContext(supabase, tripId, user.id);
  if (context.error) {
    response.status(403).json({ error: context.error });
    return;
  }
  if (request.method === "GET") {
    await listOperations(response, supabase, user, context, tripId);
    return;
  }
  const resource = sanitizeText(body.resource, "booking", 40);
  if (request.method === "POST") {
    if (resource === "policy") await savePolicy(response, supabase, user, context, tripId, body);
    else if (resource === "service_case") await createServiceCase(response, supabase, user, context, tripId, body);
    else await createBooking(response, supabase, user, context, tripId, body);
    return;
  }
  if (resource === "service_case") await updateServiceCase(response, supabase, user, context, tripId, body);
  else await updateBooking(response, supabase, user, context, tripId, body);
}
