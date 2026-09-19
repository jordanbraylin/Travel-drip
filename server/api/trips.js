import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

const allowedTripTypes = new Set([
  "solo_trip",
  "group_trip",
  "corporate_retreat",
  "wedding",
  "birthday",
  "family_reunion",
  "bachelor_bachelorette",
  "anniversary",
  "conference",
  "graduation_trip",
  "church_retreat",
  "business_event",
  "special_event",
  "cruise_vacation"
]);

const defaultModulesByType = {
  solo_trip: ["overview", "itinerary", "flights", "hotels", "transportation", "budget", "documents", "memories"],
  group_trip: ["overview", "itinerary", "group_chat", "group_bank", "split_bill", "transportation", "documents", "memories"],
  corporate_retreat: ["overview", "employee_schedule", "announcements", "flights", "hotels", "transportation", "important_information", "reports"],
  wedding: ["overview", "guest_list", "rsvp", "ceremony", "reception", "hotel_block", "transportation", "wallet", "messages", "media", "documents"],
  birthday: ["overview", "guest_list", "rsvp", "schedule", "activities", "polls", "wallet", "messages", "media", "notifications"],
  anniversary: ["overview", "guest_list", "rsvp", "schedule", "hotel", "activities", "messages", "media", "notifications"],
  family_reunion: ["overview", "guest_list", "rsvp", "room_assignments", "meals", "activities", "announcements", "wallet", "media"],
  conference: ["overview", "registration", "sessions", "speakers", "tracks", "sponsors", "hotel_block", "transportation", "messages", "reports"],
  graduation_trip: ["overview", "guest_list", "rsvp", "travel", "dinner", "activities", "wallet", "messages", "media", "completion"],
  church_retreat: ["overview", "guest_list", "rsvp", "worship", "sessions", "meals", "transportation_groups", "announcements", "documents"],
  bachelor_bachelorette: ["overview", "guest_list", "rsvp", "activities", "dinner", "nightlife", "polls", "wallet", "transportation", "media"],
  special_event: ["overview", "guest_list", "rsvp", "schedule", "activities", "wallet", "messages", "media", "documents", "completion"],
  cruise_vacation: ["cruise_overview", "cabin", "port_schedule", "shore_excursions", "onboard_schedule", "dining", "transportation", "cruise_wallet", "documents", "memories"],
  default: ["overview", "itinerary", "messages", "important_information", "documents", "memories"]
};

const featureFlagsByType = {
  solo_trip: {
    ai_manager: true,
    personal_budget: true,
    safety_checkins: true,
    group_chat: false,
    group_wallet: false,
    corporate_finance: false
  },
  group_trip: {
    ai_manager: true,
    invitations: true,
    group_chat: true,
    group_wallet: true,
    smart_bill_split: true,
    ride_share_split: true,
    corporate_finance: false
  },
  corporate_retreat: {
    ai_operations_manager: true,
    employee_invitations: true,
    role_based_access: true,
    announcements: true,
    expense_approvals: true,
    corporate_finance: true
  },
  wedding: { ai_event_planner: true, invitations: true, rsvp: true, hotel_block: true, transportation: true, group_wallet: true, media_approval: true },
  birthday: { ai_event_planner: true, invitations: true, rsvp: true, activity_voting: true, group_wallet: true, smart_bill_split: true, media: true },
  anniversary: { ai_event_planner: true, invitations: true, rsvp: true, hotel_management: true, media: true, reminders: true },
  family_reunion: { ai_event_planner: true, guest_import: true, rsvp: true, room_assignments: true, announcements: true, group_wallet: true, family_album: true },
  conference: { ai_event_planner: true, registration: true, sessions: true, speakers: true, sponsors: true, role_based_access: true, reports: true },
  graduation_trip: { ai_event_planner: true, invitations: true, rsvp: true, group_wallet: true, media: true, event_completion: true },
  church_retreat: { ai_event_planner: true, invitations: true, rsvp: true, sessions: true, meal_schedule: true, transportation_groups: true, emergency_contacts: true },
  bachelor_bachelorette: { ai_event_planner: true, invitations: true, rsvp: true, activity_voting: true, ride_share_split: true, group_wallet: true, media: true },
  special_event: { ai_event_planner: true, invitations: true, rsvp: true, schedule: true, group_wallet: true, messages: true, media: true, event_completion: true },
  cruise_vacation: {
    ai_cruise_manager: true,
    cruise_overview: true,
    cabin_assignments: true,
    port_schedule: true,
    shore_excursions: true,
    onboard_schedule: true,
    cruise_wallet: true,
    group_chat: true,
    smart_bill_split: true,
    ride_share_split: true
  },
  default: {
    ai_manager: true,
    invitations: true,
    important_information: true,
    documents: true,
    notifications: true
  }
};

function normalizeTripType(value) {
  const tripType = sanitizeText(value, "group_trip", 80);
  return allowedTripTypes.has(tripType) ? tripType : "group_trip";
}

function tripUsesSharedWallet(tripType) {
  return tripType !== "solo_trip";
}

function walletTypeForTrip(tripType) {
  if (tripType === "corporate_retreat" || tripType === "business_event" || tripType === "conference") return "corporate";
  if (tripType === "cruise_vacation") return "cruise";
  if (["special_event", "wedding", "birthday", "family_reunion", "anniversary", "graduation_trip", "church_retreat", "bachelor_bachelorette"].includes(tripType)) return "event";
  return "shared_trip";
}

function makeWalletIdentifier(tripId) {
  return `TDW-${String(tripId).replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function listTrips(request, response, supabase, user) {
  const { searchParams } = new URL(request.url, "https://traveldrip.local");
  const status = sanitizeText(searchParams.get("status"), "", 40);

  let query = supabase
    .from("trip_members")
    .select("role, status, trips(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(200).json({
    trips: (data || []).map((row) => ({
      ...row.trips,
      myRole: row.role,
      myStatus: row.status
    }))
  });
}

async function createTrip(response, supabase, user, body) {
  const tripType = normalizeTripType(body.tripType || body.trip_type);
  const title = sanitizeText(body.title || body.name || body.tripName, "Untitled Travel-Drip trip", 140);
  const destination = sanitizeText(body.destination, "Destination TBD", 160);
  const modules = defaultModulesByType[tripType] || defaultModulesByType.default;
  const featureFlags = {
    ...featureFlagsByType.default,
    ...(featureFlagsByType[tripType] || {})
  };

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      owner_user_id: user.id,
      organization_id: body.organizationId || body.organization_id || null,
      trip_type: tripType,
      title,
      destination,
      starts_on: body.startsOn || body.starts_on || null,
      ends_on: body.endsOn || body.ends_on || null,
      budget_cents: Number.isFinite(Number(body.budgetCents || body.budget_cents))
        ? Number(body.budgetCents || body.budget_cents)
        : 0,
      privacy: sanitizeText(body.privacy, "invite_only", 40),
      status: "draft",
      settings: {
        travelerCount: body.travelerCount || body.traveler_count || null,
        travelStyle: body.travelStyle || body.travel_style || null,
        interests: Array.isArray(body.interests) ? body.interests : [],
        coverPhoto: body.coverPhoto || body.cover_photo || null
      }
    })
    .select("*")
    .single();

  if (tripError) {
    response.status(500).json({ error: tripError.message });
    return;
  }

  await supabase.from("trip_members").insert({
    trip_id: trip.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    permissions: { all: true }
  });

  await supabase.from("trip_feature_flags").insert({
    trip_id: trip.id,
    flags: featureFlags
  });

  await supabase.from("trip_modules").insert(modules.map((moduleKey, index) => ({
    trip_id: trip.id,
    module_key: moduleKey,
    enabled: true,
    sort_order: index + 1
  })));

  let tripWallet = null;
  let tripWalletCard = null;
  if (tripUsesSharedWallet(tripType)) {
    const walletIdentifier = makeWalletIdentifier(trip.id);
    const { data: groupBank, error: groupBankError } = await supabase
      .from("group_banks")
      .insert({
        trip_id: trip.id,
        currency: sanitizeText(body.currency, "USD", 12),
        settings: {
          walletIdentifier,
          createdAutomatically: true,
          corporateFundsSeparate: tripType === "corporate_retreat"
        }
      })
      .select("*")
      .single();

    if (groupBankError) {
      response.status(500).json({ error: groupBankError.message });
      return;
    }

    const { data: wallet, error: walletError } = await supabase
      .from("trip_virtual_wallets")
      .insert({
        trip_id: trip.id,
        group_bank_id: groupBank.id,
        organization_id: trip.organization_id,
        wallet_identifier: walletIdentifier,
        wallet_type: walletTypeForTrip(tripType),
        currency: groupBank.currency,
        status: "active",
        settings: {
          oneWalletPerTrip: true,
          memberContributionLedger: true,
          duplicatePaymentProtection: true,
          companyFundsSeparate: tripType === "corporate_retreat"
        }
      })
      .select("*")
      .single();

    if (walletError) {
      response.status(500).json({ error: walletError.message });
      return;
    }

    const { data: card, error: cardError } = await supabase
      .from("trip_wallet_cards")
      .insert({
        trip_wallet_id: wallet.id,
        trip_id: trip.id,
        card_status: "provider_required",
        masked_last_four: walletIdentifier.slice(-4),
        tokenization_status: "not_started",
        spend_controls: {
          availableBalanceOnly: true,
          blockReservedFunds: true,
          requirePinForSensitiveActions: true
        }
      })
      .select("*")
      .single();

    if (cardError) {
      response.status(500).json({ error: cardError.message });
      return;
    }

    tripWallet = wallet;
    tripWalletCard = card;
  }

  await supabase.from("ai_sessions").insert({
    trip_id: trip.id,
    user_id: user.id,
    session_type: tripType === "corporate_retreat" ? "operations_manager" : "trip_manager",
    prompt_context: {
      tripType,
      suggestions: tripType === "solo_trip"
        ? ["Build me a 5-day itinerary.", "Recommend a safer route back to my hotel."]
        : tripType === "corporate_retreat"
          ? ["Generate a three-day retreat agenda.", "Create a team transportation plan."]
          : ["Create a dinner poll.", "Suggest group-friendly activities."]
    }
  });

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId: trip.id,
    action: "trip.created",
    entityType: "trip",
    entityId: trip.id,
    metadata: {
      tripType,
      modules,
      featureFlags,
      tripWalletCreated: Boolean(tripWallet),
      tripWalletId: tripWallet?.id || null,
      walletIdentifier: tripWallet?.wallet_identifier || null
    }
  });

  response.status(201).json({ trip, modules, featureFlags, tripWallet, tripWalletCard });
}

async function updateTrip(response, supabase, user, body) {
  const tripId = body.tripId || body.trip_id;
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return;
  }

  const canManage = await requireTripRole(supabase, tripId, user.id, ["owner", "admin", "organizer"]);
  if (!canManage) {
    response.status(403).json({ error: "Trip admin access required" });
    return;
  }

  const updates = {
    updated_at: new Date().toISOString()
  };
  if (body.title || body.name) updates.title = sanitizeText(body.title || body.name, "", 140);
  if (body.destination) updates.destination = sanitizeText(body.destination, "", 160);
  if (body.status) updates.status = sanitizeText(body.status, "", 40);
  if (body.tripType || body.trip_type) updates.trip_type = normalizeTripType(body.tripType || body.trip_type);

  const { data, error } = await supabase
    .from("trips")
    .update(updates)
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    tripId,
    action: "trip.updated",
    entityType: "trip",
    entityId: tripId,
    metadata: updates
  });

  response.status(200).json({ trip: data });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);

  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    methodNotAllowed(response, "GET, POST, PATCH");
    return;
  }

  const { user, supabase } = await requireAuthenticatedUser(request, response);
  if (!user || !supabase) return;

  if (request.method === "GET") {
    await listTrips(request, response, supabase, user);
    return;
  }

  const body = getRequestBody(request);
  if (request.method === "POST") {
    await createTrip(response, supabase, user, body);
    return;
  }

  await updateTrip(response, supabase, user, body);
}
