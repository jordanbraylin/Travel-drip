import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  requireTripRole,
  sanitizeText,
  writeAuditLog
} from "./_security.js";

function requestUrl(request) {
  return new URL(request.url, "https://traveldrip.local");
}

async function requireMembership(response, supabase, tripId, userId) {
  if (!tripId) {
    response.status(400).json({ error: "tripId is required" });
    return false;
  }
  const allowed = await requireTripRole(supabase, tripId, userId);
  if (!allowed) {
    response.status(403).json({ error: "Active trip membership is required" });
    return false;
  }
  return true;
}

async function listChat(response, supabase, user, tripId) {
  if (!await requireMembership(response, supabase, tripId, user.id)) return;
  const { data: rooms, error: roomError } = await supabase
    .from("chat_rooms")
    .select("id, trip_id, room_type, title, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (roomError) {
    response.status(500).json({ error: roomError.message });
    return;
  }
  const roomIds = (rooms || []).map((room) => room.id);
  const { data: messages, error: messageError } = roomIds.length
    ? await supabase
      .from("messages")
      .select("id, trip_id, room_id, sender_user_id, body, message_type, metadata, created_at")
      .in("room_id", roomIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(500)
    : { data: [], error: null };
  if (messageError) {
    response.status(500).json({ error: messageError.message });
    return;
  }
  const senderIds = [...new Set((messages || []).map((message) => message.sender_user_id).filter(Boolean))];
  const { data: profiles, error: profileError } = senderIds.length
    ? await supabase.from("profiles").select("id, full_name, username").in("id", senderIds)
    : { data: [], error: null };
  if (profileError) {
    response.status(500).json({ error: profileError.message });
    return;
  }
  const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name || profile.username || "Trip member"]));

  const { data: polls, error: pollError } = await supabase
    .from("polls")
    .select("id, question, status, created_by, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (pollError) {
    response.status(500).json({ error: pollError.message });
    return;
  }
  const pollIds = (polls || []).map((poll) => poll.id);
  const [{ data: options, error: optionError }, { data: votes, error: voteError }] = pollIds.length
    ? await Promise.all([
      supabase.from("poll_options").select("id, poll_id, label").in("poll_id", pollIds),
      supabase.from("poll_votes").select("poll_id, option_id, user_id").in("poll_id", pollIds)
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (optionError || voteError) {
    response.status(500).json({ error: optionError?.message || voteError?.message });
    return;
  }
  const pollPayload = (polls || []).map((poll) => ({
    ...poll,
    options: (options || []).filter((option) => option.poll_id === poll.id).map((option) => ({
      ...option,
      votes: (votes || []).filter((vote) => vote.option_id === option.id).length
    })),
    selectedOptionId: (votes || []).find((vote) => vote.poll_id === poll.id && vote.user_id === user.id)?.option_id || null
  }));

  response.status(200).json({
    rooms: rooms || [],
    messages: (messages || []).map((message) => ({
      ...message,
      senderName: message.sender_user_id === user.id ? "You" : (names.get(message.sender_user_id) || "Trip member")
    })),
    polls: pollPayload
  });
}

async function createRoom(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id, "", 80);
  if (!await requireMembership(response, supabase, tripId, user.id)) return;
  const title = sanitizeText(body.title, "Trip chat", 120);
  const { data: existing } = await supabase
    .from("chat_rooms")
    .select("id, trip_id, room_type, title, created_at")
    .eq("trip_id", tripId)
    .eq("room_type", "group")
    .eq("title", title)
    .maybeSingle();
  if (existing) {
    response.status(200).json({ room: existing, existing: true });
    return;
  }
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert({ trip_id: tripId, room_type: "group", title, created_by: user.id })
    .select("id, trip_id, room_type, title, created_at")
    .single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  const { data: members } = await supabase.from("trip_members").select("user_id, role").eq("trip_id", tripId).eq("status", "active");
  if (members?.length) {
    await supabase.from("chat_room_participants").upsert(members.map((member) => ({
      room_id: room.id,
      trip_id: tripId,
      user_id: member.user_id,
      participant_role: ["owner", "admin", "organizer", "member", "employee", "finance", "vendor", "guest"].includes(member.role) ? member.role : "member"
    })), { onConflict: "room_id,user_id" });
  }
  await writeAuditLog(supabase, { actorUserId: user.id, tripId, action: "chat.room_created", entityType: "chat_room", entityId: room.id, metadata: { title } });
  response.status(201).json({ room });
}

async function sendMessage(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id, "", 80);
  const roomId = sanitizeText(body.roomId || body.room_id, "", 80);
  const text = sanitizeText(body.text || body.body, "", 4000);
  if (!roomId || !text) {
    response.status(400).json({ error: "roomId and message text are required" });
    return;
  }
  if (!await requireMembership(response, supabase, tripId, user.id)) return;
  const { data: room, error: roomError } = await supabase.from("chat_rooms").select("id, trip_id, is_read_only").eq("id", roomId).eq("trip_id", tripId).maybeSingle();
  if (roomError || !room) {
    response.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (room.is_read_only) {
    response.status(403).json({ error: "This conversation is read-only" });
    return;
  }
  const mentions = [...text.matchAll(/@([a-zA-Z0-9_.-]{2,32})/g)].map((match) => match[1].toLowerCase());
  const { data: message, error } = await supabase
    .from("messages")
    .insert({ trip_id: tripId, room_id: roomId, sender_user_id: user.id, body: text, message_type: "text", metadata: { mentions } })
    .select("id, trip_id, room_id, sender_user_id, body, message_type, metadata, created_at")
    .single();
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  await supabase.from("chat_rooms").update({ last_message_at: message.created_at }).eq("id", roomId);
  response.status(201).json({ message: { ...message, senderName: "You" } });
}

async function createPoll(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id, "", 80);
  const question = sanitizeText(body.question, "", 240);
  const labels = Array.isArray(body.options) ? body.options.map((value) => sanitizeText(value, "", 120)).filter(Boolean).slice(0, 8) : [];
  if (!question || labels.length < 2) {
    response.status(400).json({ error: "A question and at least two options are required" });
    return;
  }
  if (!await requireMembership(response, supabase, tripId, user.id)) return;
  const { data: poll, error: pollError } = await supabase.from("polls").insert({ trip_id: tripId, created_by: user.id, question, status: "open" }).select("id, question, status, created_by, created_at").single();
  if (pollError) {
    response.status(500).json({ error: pollError.message });
    return;
  }
  const { data: options, error: optionError } = await supabase.from("poll_options").insert(labels.map((label) => ({ poll_id: poll.id, label }))).select("id, poll_id, label");
  if (optionError) {
    await supabase.from("polls").delete().eq("id", poll.id);
    response.status(500).json({ error: optionError.message });
    return;
  }
  response.status(201).json({ poll: { ...poll, options: (options || []).map((option) => ({ ...option, votes: 0 })), selectedOptionId: null } });
}

async function vote(response, supabase, user, body) {
  const tripId = sanitizeText(body.tripId || body.trip_id, "", 80);
  const pollId = sanitizeText(body.pollId || body.poll_id, "", 80);
  const optionId = sanitizeText(body.optionId || body.option_id, "", 80);
  if (!pollId || !optionId) {
    response.status(400).json({ error: "pollId and optionId are required" });
    return;
  }
  if (!await requireMembership(response, supabase, tripId, user.id)) return;
  const [{ data: poll }, { data: option }] = await Promise.all([
    supabase.from("polls").select("id, trip_id, status").eq("id", pollId).eq("trip_id", tripId).maybeSingle(),
    supabase.from("poll_options").select("id, poll_id").eq("id", optionId).eq("poll_id", pollId).maybeSingle()
  ]);
  if (!poll || poll.status !== "open" || !option) {
    response.status(409).json({ error: "This poll option is not available" });
    return;
  }
  const { error } = await supabase.from("poll_votes").upsert({ poll_id: pollId, option_id: optionId, user_id: user.id }, { onConflict: "poll_id,user_id" });
  if (error) {
    response.status(500).json({ error: error.message });
    return;
  }
  response.status(200).json({ voted: true, pollId, optionId });
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
      await listChat(response, supabase, user, sanitizeText(requestUrl(request).searchParams.get("tripId"), "", 80));
      return;
    }
    const body = getRequestBody(request);
    const action = sanitizeText(body.action, "", 60);
    if (action === "create_room") return createRoom(response, supabase, user, body);
    if (action === "send_message") return sendMessage(response, supabase, user, body);
    if (action === "create_poll") return createPoll(response, supabase, user, body);
    if (action === "vote") return vote(response, supabase, user, body);
    response.status(400).json({ error: "Unsupported chat action" });
  } catch (error) {
    response.status(500).json({ error: error.message || "Chat request failed" });
  }
}
