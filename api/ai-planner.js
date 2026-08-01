import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  requireAuthenticatedUser,
  sanitizeText
} from "./_security.js";

function collectCitations(value, citations = []) {
  if (!value || typeof value !== "object") return citations;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectCitations(entry, citations));
    return citations;
  }
  if (value.type === "url_citation" && value.url) {
    citations.push({
      title: sanitizeText(value.title, value.url, 180),
      url: sanitizeText(value.url, "", 500)
    });
  }
  Object.values(value).forEach((entry) => collectCitations(entry, citations));
  return citations;
}

function uniqueCitations(citations) {
  return [...new Map(citations.filter((citation) => /^https?:\/\//i.test(citation.url)).map((citation) => [citation.url, citation])).values()].slice(0, 8);
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
      error: "Live AI travel research is not configured.",
      code: "provider_not_configured",
      provider: "openai"
    });
    return;
  }

  const body = getRequestBody(request);
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  const query = sanitizeText(body.query, "", 800);
  const tripType = sanitizeText(answers.tripType, "Group Vacation", 100);
  const destination = sanitizeText(answers.destination, "", 160);
  const dates = sanitizeText(answers.dates, "Flexible dates", 120);
  const budget = sanitizeText(answers.budget, "Not specified", 120);
  const interests = sanitizeText(answers.interests, "Activities, food, and local experiences", 240);
  const transportation = sanitizeText(answers.transportation, "Convenient local transportation", 180);
  const userPrompt = query || [
    `Plan and research a ${tripType}.`,
    destination ? `Destination: ${destination}.` : "Destination: recommend suitable options.",
    `Dates: ${dates}. Budget: ${budget}.`,
    `Interests: ${interests}. Transportation: ${transportation}.`
  ].join(" ");

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
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: "You are Travel-Drip AI. Research current trips, destinations, activities, restaurants, hotels, and transportation using web search. Keep recommendations practical and concise. Distinguish live provider facts from estimates, never invent availability or prices, include source links through web citations, and remind the traveler to verify before booking. For corporate trips, do not expose confidential budgets or personal employee data."
            }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      response.status(upstream.status === 429 ? 429 : 502).json({
        error: "The AI travel research provider could not complete the request.",
        code: "provider_error",
        provider: "openai",
        providerStatus: upstream.status
      });
      return;
    }

    response.status(200).json({
      provider: "openai",
      sourceLabel: "AI research with live web sources",
      text: sanitizeText(payload.output_text, "No research summary was returned.", 8_000),
      citations: uniqueCitations(collectCitations(payload))
    });
  } catch (error) {
    response.status(error.name === "AbortError" ? 504 : 502).json({
      error: "AI travel research timed out. Try again.",
      code: error.name === "AbortError" ? "provider_timeout" : "provider_unreachable",
      provider: "openai"
    });
  } finally {
    clearTimeout(timeout);
  }
}
