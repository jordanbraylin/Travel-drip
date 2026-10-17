export function getResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }
  return (Array.isArray(payload?.output) ? payload.output : [])
    .filter((item) => item.type === "message" && item.role === "assistant")
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export function getOpenAiFailure(payload, status) {
  const code = payload?.error?.code;
  const exhausted = ["credit_balance_exhausted", "insufficient_quota"].includes(code)
    || payload?.error?.type === "insufficient_quota";
  return {
    error: exhausted
      ? "AI is unavailable because the site's OpenAI API credits are exhausted. The site owner must add API credits."
      : status === 429 ? "AI is busy. Please try again shortly." : "The AI provider could not complete this request.",
    code: exhausted ? "provider_quota_exhausted" : "provider_error",
    provider: "openai",
    providerStatus: status
  };
}
