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
