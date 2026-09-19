import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";
import { randomUUID } from "node:crypto";

const ADMIN_ROLES = ["owner", "admin", "organizer", "finance_admin"];
const MAX_CONTRIBUTION_CENTS = 500000;

function requestUrl(request) {
  return new URL(request.url, "https://traveldrip.local");
}

function configuredAppUrl(request) {
  const configured = String(process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const forwardedHost = request.headers["x-forwarded-host"] || request.headers.host;
  const forwardedProto = request.headers["x-forwarded-proto"] || "https";
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
}

function moneyCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 100 || amount > MAX_CONTRIBUTION_CENTS) return 0;
  return amount;
}

function isFundingTrip(trip) {
  return Boolean(
    trip
      && trip.status !== "archived"
      && trip.status !== "cancelled"
      && trip.status !== "completed"
      && trip.trip_type !== "solo_trip"
      && trip.trip_type !== "corporate_retreat"
      && trip.trip_type !== "business_event"
      && trip.trip_type !== "conference"
  );
}

async function getTripContext(supabase, user, tripId = "") {
  let membershipQuery = supabase
    .from("trip_members")
    .select("trip_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (tripId) membershipQuery = membershipQuery.eq("trip_id", tripId);

  const { data: memberships, error: membershipError } = await membershipQuery.order("created_at", { ascending: false });
  if (membershipError) throw new Error(membershipError.message);
  if (!memberships?.length) return null;

  const tripIds = memberships.map((membership) => membership.trip_id);
  const { data: trips, error: tripError } = await supabase
    .from("trips")
    .select("id, trip_type, title, destination, status")
    .in("id", tripIds);
  if (tripError) throw new Error(tripError.message);

  const tripById = new Map((trips || []).map((trip) => [trip.id, trip]));
  const selected = memberships
    .map((membership) => ({ ...membership, trip: tripById.get(membership.trip_id) }))
    .filter((membership) => membership.trip)
    .sort((left, right) => Number(isFundingTrip(right.trip)) - Number(isFundingTrip(left.trip)))[0];
  if (!selected) return null;

  const { data: wallet, error: walletError } = await supabase
    .from("trip_virtual_wallets")
    .select("id, trip_id, wallet_identifier, currency, available_cents, total_contributions_cents, status, provider, provider_wallet_ref")
    .eq("trip_id", selected.trip.id)
    .maybeSingle();
  if (walletError) throw new Error(walletError.message);

  let card = null;
  if (wallet) {
    const { data: cardData, error: cardError } = await supabase
      .from("trip_wallet_cards")
      .select("id, card_status, masked_last_four, provider, provider_card_ref, tokenization_status, spend_controls")
      .eq("trip_id", selected.trip.id)
      .maybeSingle();
    if (cardError) throw new Error(cardError.message);
    card = cardData;
  }

  const isAdmin = ADMIN_ROLES.includes(selected.role);
  let contributions = [];
  let recentNotifications = [];
  if (wallet) {
    let contributionQuery = supabase
      .from("trip_wallet_contributions")
      .select("id, trip_id, user_id, amount_cents, currency, payment_method, status, refundable_cents, created_at, metadata")
      .eq("trip_id", selected.trip.id)
      .eq("trip_wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!isAdmin) contributionQuery = contributionQuery.eq("user_id", user.id);
    const { data: contributionRows, error: contributionError } = await contributionQuery;
    if (contributionError) throw new Error(contributionError.message);

    const contributorIds = [...new Set((contributionRows || []).map((row) => row.user_id).filter(Boolean))];
    const { data: profiles, error: profilesError } = contributorIds.length
      ? await supabase.from("profiles").select("id, full_name, username").in("id", contributorIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    contributions = (contributionRows || []).map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        id: row.id,
        tripId: row.trip_id,
        userId: row.user_id,
        memberName: profile?.full_name || profile?.username || (row.user_id === user.id ? "You" : "Trip member"),
        amountCents: row.amount_cents,
        currency: row.currency,
        paymentMethod: row.payment_method,
        status: row.status,
        refundableCents: row.refundable_cents,
        createdAt: row.created_at
      };
    });

    const { data: notificationRows, error: notificationError } = await supabase
      .from("notifications")
      .select("id, notification_type, title, body, channels, status, read_at, created_at, metadata")
      .eq("trip_id", selected.trip.id)
      .eq("user_id", user.id)
      .in("notification_type", ["wallet_deposit_confirmed", "wallet_payment_request", "wallet_payment_due"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (notificationError) throw new Error(notificationError.message);
    recentNotifications = notificationRows || [];
  }

  return { ...selected, wallet, card, contributions, recentNotifications };
}

function accessPayload(context) {
  const isAdmin = ADMIN_ROLES.includes(context.role);
  const canContribute = isFundingTrip(context.trip) && context.wallet?.status === "active";
  const cardReady = Boolean(context.card?.provider_card_ref && context.card.card_status === "active");
  const financeRestricted = ["corporate_retreat", "business_event", "conference"].includes(context.trip.trip_type);
  const canViewFinancialDetails = isAdmin || !financeRestricted;
  const visibleContributions = canViewFinancialDetails ? (context.contributions || []) : [];
  return {
    tripId: context.trip.id,
    tripType: context.trip.trip_type,
    tripTitle: context.trip.title,
    destination: context.trip.destination,
    role: context.role,
    canContribute,
    canTapToPay: isAdmin && cardReady,
    canManageCard: isAdmin,
    providerRequired: !cardReady,
    contributionVisibility: !canViewFinancialDetails ? "restricted" : (isAdmin ? "all_members" : "personal_only"),
    contributionCount: visibleContributions.length,
    contributions: visibleContributions,
    recentNotifications: context.recentNotifications || [],
    inAppNotificationsEnabled: true,
    pushNotificationsConfigured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    wallet: canViewFinancialDetails && context.wallet ? {
      id: context.wallet.id,
      identifier: context.wallet.wallet_identifier,
      currency: context.wallet.currency,
      status: context.wallet.status,
      availableCents: context.wallet.available_cents,
      totalContributionsCents: context.wallet.total_contributions_cents
    } : null,
    card: canViewFinancialDetails && context.card ? {
      id: context.card.id,
      status: context.card.card_status,
      maskedLastFour: context.card.masked_last_four,
      tokenizationStatus: context.card.tokenization_status,
      provider: context.card.provider
    } : null
  };
}

async function stripeCheckout(request, contribution, context, amountCents, currency) {
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const appUrl = configuredAppUrl(request);
  if (!stripeSecret || !appUrl) {
    const error = new Error("Stripe Checkout is not configured. Add STRIPE_SECRET_KEY and APP_BASE_URL before accepting funds.");
    error.code = "payment_provider_required";
    throw error;
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price_data][currency]", currency.toLowerCase());
  form.set("line_items[0][price_data][product_data][name]", `Travel-Drip contribution • ${context.trip.title || "shared trip"}`);
  form.set("line_items[0][price_data][product_data][description]", `Contribution to ${context.trip.destination || "the selected trip"} shared wallet`);
  form.set("line_items[0][price_data][unit_amount]", String(amountCents));
  form.set("line_items[0][quantity]", "1");
  form.set("client_reference_id", contribution.id);
  form.set("success_url", `${appUrl}/wallet?wallet=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${appUrl}/wallet?wallet=cancelled`);
  form.set("metadata[contribution_id]", contribution.id);
  form.set("metadata[trip_id]", context.trip.id);
  form.set("metadata[trip_wallet_id]", context.wallet.id);
  form.set("metadata[user_id]", context.userId);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": contribution.idempotency_key
    },
    body: form
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) {
    const error = new Error(result?.error?.message || "Stripe Checkout could not be created.");
    error.code = "stripe_checkout_failed";
    throw error;
  }
  return result;
}

async function createContributionCheckout(request, response, supabase, user, body) {
  const context = await getTripContext(supabase, user, sanitizeText(body.tripId || body.trip_id, "", 80));
  if (!context || !context.wallet || !isFundingTrip(context.trip) || context.wallet.status !== "active") {
    response.status(403).json({ error: "An active shared trip wallet is required before adding funds." });
    return;
  }

  const amountCents = moneyCents(body.amountCents ?? body.amount_cents);
  if (!amountCents) {
    response.status(400).json({ error: "amountCents must be an integer between 100 and 500000." });
    return;
  }
  const idempotencyKey = sanitizeText(body.idempotencyKey || body.idempotency_key, randomUUID(), 120);
  const currency = sanitizeText(context.wallet.currency, "USD", 12).toUpperCase();

  const { data: existing } = await supabase
    .from("trip_wallet_contributions")
    .select("id, amount_cents, status, idempotency_key, metadata")
    .eq("trip_wallet_id", context.wallet.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.metadata?.checkoutUrl) {
    response.status(200).json({ ...accessPayload(context), contribution: existing, checkoutUrl: existing.metadata.checkoutUrl });
    return;
  }

  const { data: contribution, error: contributionError } = await supabase
    .from("trip_wallet_contributions")
    .insert({
      trip_wallet_id: context.wallet.id,
      trip_id: context.trip.id,
      user_id: user.id,
      amount_cents: amountCents,
      currency,
      payment_method: "stripe_checkout",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: { source: "trip_wallet_add_funds", createdByRole: context.role }
    })
    .select("id, amount_cents, currency, status, idempotency_key, created_at")
    .single();
  if (contributionError) {
    if (contributionError.code === "23505") {
      response.status(409).json({ error: "A contribution with this idempotency key already exists. Retry with the original checkout." });
      return;
    }
    response.status(500).json({ error: contributionError.message });
    return;
  }

  try {
    const checkout = await stripeCheckout(request, { ...contribution, idempotency_key: idempotencyKey }, { ...context, userId: user.id }, amountCents, currency);
    const metadata = { source: "trip_wallet_add_funds", createdByRole: context.role, checkoutSessionId: checkout.id, checkoutUrl: checkout.url };
    await supabase.from("trip_wallet_contributions").update({ metadata, status: "processing" }).eq("id", contribution.id).eq("status", "pending");
    await writeAuditLog(supabase, {
      actorUserId: user.id,
      tripId: context.trip.id,
      action: "trip_wallet.contribution_checkout_created",
      entityType: "trip_wallet_contribution",
      entityId: contribution.id,
      metadata: { amountCents, currency, checkoutSessionId: checkout.id }
    });
    response.status(201).json({ ...accessPayload(context), contribution: { ...contribution, status: "processing" }, checkoutUrl: checkout.url });
  } catch (error) {
    await supabase.from("trip_wallet_contributions").update({ status: "failed", metadata: { source: "trip_wallet_add_funds", error: error.message } }).eq("id", contribution.id);
    response.status(error.code === "payment_provider_required" ? 503 : 502).json({ error: error.message, code: error.code || "stripe_checkout_failed" });
  }
}

async function createPaymentRequest(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id, "", 80);
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }
  const context = await getTripContext(supabase, user, tripId);
  if (!context?.wallet || context.wallet.status !== "active") {
    response.status(409).json({ error: "An active trip wallet is required before creating a payment request." });
    return;
  }
  if (!ADMIN_ROLES.includes(context.role)) {
    response.status(403).json({ error: "Only an authorized trip finance role can create payment requests." });
    return;
  }

  const title = sanitizeText(body.title, "Trip wallet payment", 160);
  const amountCents = moneyCents(body.amountCents ?? body.amount_cents);
  const dueAt = new Date(String(body.dueAt || body.due_at || ""));
  if (!amountCents) {
    response.status(400).json({ error: "amountCents must be an integer between 100 and 500000." });
    return;
  }
  if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60000) {
    response.status(400).json({ error: "dueAt must be a valid current or future timestamp." });
    return;
  }

  const assignedTo = sanitizeText(body.assignedTo || body.assigned_to, "", 80) || null;
  const { data: members, error: memberError } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("status", "active");
  if (memberError) {
    response.status(500).json({ error: memberError.message });
    return;
  }
  const memberIds = (members || []).map((member) => member.user_id).filter(Boolean);
  if (assignedTo && !memberIds.includes(assignedTo)) {
    response.status(400).json({ error: "assignedTo must be an active trip member." });
    return;
  }
  const recipientIds = assignedTo ? [assignedTo] : memberIds;
  const currency = sanitizeText(context.wallet.currency, "USD", 12).toUpperCase();

  const { data: paymentRequest, error: requestError } = await supabase
    .from("trip_wallet_payment_requests")
    .insert({
      trip_wallet_id: context.wallet.id,
      trip_id: tripId,
      created_by: user.id,
      assigned_to: assignedTo,
      title,
      amount_cents: amountCents,
      currency,
      due_at: dueAt.toISOString(),
      status: "pending",
      metadata: { createdByRole: context.role }
    })
    .select("id, trip_id, trip_wallet_id, created_by, assigned_to, title, amount_cents, currency, due_at, status, created_at")
    .single();
  if (requestError) {
    response.status(500).json({ error: requestError.message });
    return;
  }

  if (recipientIds.length) {
    const notificationRows = recipientIds.map((recipientId) => ({
      trip_id: tripId,
      user_id: recipientId,
      notification_type: "wallet_payment_request",
      title: "New trip wallet payment request",
      body: `A trip wallet payment request is due ${dueAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Open Travel-Drip to review it.`,
      channels: ["in_app", "push"],
      status: "queued",
      metadata: { payment_request_id: paymentRequest.id, due_at: paymentRequest.due_at }
    }));
    const { error: notificationError } = await supabase.from("notifications").insert(notificationRows);
    if (notificationError) {
      response.status(500).json({ error: notificationError.message });
      return;
    }
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "trip_wallet.payment_request_created",
    entityType: "trip_wallet_payment_request",
    entityId: paymentRequest.id,
    metadata: { amountCents, currency, dueAt: paymentRequest.due_at, assignedTo }
  });
  response.status(201).json({ ...accessPayload(context), paymentRequest, notifiedMembers: recipientIds.length });
}

async function requestTapToPay(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id, "", 80);
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }
  const isAdmin = await requireTripRole(supabase, tripId, user.id, ADMIN_ROLES);
  if (!isAdmin) {
    response.status(403).json({ error: "Only the trip owner or authorized trip finance admin can use the shared card." });
    return;
  }
  const context = await getTripContext(supabase, user, tripId);
  const cardReady = Boolean(context?.card?.provider_card_ref && context.card.card_status === "active");
  if (!cardReady) {
    response.status(409).json({
      error: "Shared-card tap-to-pay is not enabled until an authorized card issuer provisions the trip card.",
      code: "card_provider_required",
      ...accessPayload(context)
    });
    return;
  }
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "trip_wallet.admin_tap_to_pay_started",
    entityType: "trip_wallet_card",
    entityId: context.card.id,
    metadata: { provider: context.card.provider, maskedLastFour: context.card.masked_last_four }
  });
  response.status(200).json({ ...accessPayload(context), tapToPayStarted: true, message: "Admin card access granted by trip role. The issuer terminal flow must complete the purchase authorization." });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (!["GET", "POST"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST");
    return;
  }

  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  try {
    if (request.method === "GET") {
      const context = await getTripContext(supabase, user, requestUrl(request).searchParams.get("tripId") || "");
      if (!context) {
        response.status(404).json({ error: "No active trip membership was found." });
        return;
      }
      response.status(200).json(accessPayload(context));
      return;
    }

    const body = getRequestBody(request);
    const action = sanitizeText(body.action, "", 60);
    if (action === "create_contribution_checkout") {
      await createContributionCheckout(request, response, supabase, user, body);
      return;
    }
    if (action === "tap_to_pay") {
      await requestTapToPay(response, supabase, user, body);
      return;
    }
    if (action === "create_payment_request") {
      await createPaymentRequest(response, supabase, user, body);
      return;
    }
    response.status(400).json({ error: "Unsupported wallet action" });
  } catch (error) {
    response.status(500).json({ error: error.message || "Wallet request failed" });
  }
}
