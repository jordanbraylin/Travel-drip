import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  sanitizeText
} from "./_security.js";

const templateFields = ["subject", "headline", "body", "meta", "rsvpLabel"];

function parseTemplate(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;
    return templateFields.reduce((template, field) => {
      template[field] = sanitizeText(parsed[field], "", field === "body" ? 1_200 : 240);
      return template;
    }, {});
  } catch (_error) {
    return null;
  }
}

function buildPrompt(context) {
  return JSON.stringify({
    eventType: sanitizeText(context.eventTypeLabel || context.eventType, "Special Event", 100),
    eventName: sanitizeText(context.title, "Event details coming soon", 160),
    venue: sanitizeText(context.venue, "Venue details coming soon", 160),
    destination: sanitizeText(context.destination || context.address, "Destination details coming soon", 180),
    startsOn: sanitizeText(context.startsOn, "Date and time coming soon", 80),
    endsOn: sanitizeText(context.endsOn, "", 80),
    audience: sanitizeText(context.audience, "guests", 160),
    tone: sanitizeText(context.tone, "warm", 40),
    details: sanitizeText(context.details, "", 600)
  });
}

export default async function handler(request, response) {
  applySecurityHeaders(response);
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }

  const { user } = await requireAuthenticatedUser(request, response);
  if (!user) return;

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    response.status(503).json({
      error: "AI invitation generation is not configured.",
      code: "provider_not_configured",
      provider: "openai"
    });
    return;
  }

  const body = getRequestBody(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5",
        store: false,
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: "You are Travel-Drip's invitation assistant. Create a polished, Evite-inspired event invitation based only on the supplied event details. Match the requested tone and audience. Never invent missing dates, venues, prices, guest data, or logistics; use concise 'Details coming soon' wording when needed. Return JSON only with exactly these string fields: subject, headline, body, meta, rsvpLabel. Keep the body welcoming and useful. Do not expose confidential corporate budgets, employee information, or private attendee data."
            }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildPrompt(body) }]
          }
        ]
      })
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      response.status(upstream.status === 429 ? 429 : 502).json({
        error: "The AI invitation provider could not complete the request.",
        code: "provider_error",
        provider: "openai",
        providerStatus: upstream.status
      });
      return;
    }

    const template = parseTemplate(payload.output_text);
    if (!template || !template.headline || !template.body) {
      response.status(502).json({
        error: "The AI invitation provider returned an invalid template.",
        code: "provider_invalid_response",
        provider: "openai"
      });
      return;
    }

    response.status(200).json({
      provider: "openai",
      sourceLabel: "AI invitation assistant",
      template
    });
  } catch (error) {
    response.status(error.name === "AbortError" ? 504 : 502).json({
      error: "AI invitation generation timed out. Try again.",
      code: error.name === "AbortError" ? "provider_timeout" : "provider_unreachable",
      provider: "openai"
    });
  } finally {
    clearTimeout(timeout);
  }
}
