import {
  applySecurityHeaders,
  getRequestBody,
  methodNotAllowed,
  sanitizeText
} from "./_security.js";
import { getResponseText, getOpenAiFailure } from "./_openai-response.js";
import { freePlanner } from './_free-planner.js';
const rates = new Map();

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

  const body = getRequestBody(request);
  if (process.env.ALLOW_PAID_AI !== 'true') {
    const ip=String(request.headers?.['x-forwarded-for']||'unknown').split(',')[0],now=Date.now();let rate=rates.get(ip);
    if(!rate||rate.until<now){rate={count:0,until:now+60000};if(rates.size>=500)rates.delete(rates.keys().next().value);rates.set(ip,rate);}
    if(++rate.count>20)return response.status(429).json({error:'Please pause briefly before researching another destination.',code:'research_rate_limited'});
    try { return response.status(200).json(await freePlanner(body)); }
    catch { return response.status(503).json({error:'Free destination guides are temporarily unavailable. Guided planning is still available.',provider:'free_guides',code:'guide_source_unavailable'}); }
  }
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    response.status(503).json({
      error: "Live AI travel research is not configured.",
      code: "provider_not_configured",
      provider: "openai"
    });
    return;
  }

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
        tool_choice: "required",
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
      response.status(upstream.status === 429 ? 429 : 502).json(getOpenAiFailure(payload, upstream.status));
      return;
    }

    const text = getResponseText(payload);
    if (!text.trim()) {
      response.status(502).json({
        error: "The AI travel research provider returned no summary.",
        code: "provider_invalid_response",
        provider: "openai"
      });
      return;
    }
    const citations = uniqueCitations(collectCitations(payload));
    const searchedWeb = Array.isArray(payload.output) && payload.output.some((item) => item.type === "web_search_call" && item.status === "completed");
    if (!searchedWeb || !citations.length) {
      response.status(502).json({
        error: "AI did not return verified web-search sources. Please retry.",
        code: "provider_unverified_response",
        provider: "openai"
      });
      return;
    }
    response.status(200).json({
      provider: "openai",
      live: true,
      sourceLabel: "OpenAI research with live web sources",
      text: sanitizeText(text, "", 8_000),
      citations
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
