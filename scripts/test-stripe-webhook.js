import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import handler from "../api/stripe-webhook.js";

const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
const secret = "test-only-webhook-secret";
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({ type: "test.ignored", data: { object: {} } });
const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
const response = () => ({
  setHeader() {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; }
});
try {
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  const request = Readable.from([payload.slice(0, 10), Buffer.from(payload.slice(10))]);
  request.method = "POST";
  request.headers = { "stripe-signature": `t=${timestamp},v1=${signature}` };
  const valid = response();
  await handler(request, valid);
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.body, { received: true, ignored: true });

  const tampered = response();
  await handler({ method: "POST", headers: request.headers, rawBody: `${payload} ` }, tampered);
  assert.equal(tampered.statusCode, 400);

  const expired = response();
  const oldTime = timestamp - 600;
  const oldSignature = createHmac("sha256", secret).update(`${oldTime}.${payload}`).digest("hex");
  await handler({ method: "POST", headers: { "stripe-signature": `t=${oldTime},v1=${oldSignature}` }, body: payload }, expired);
  assert.equal(expired.statusCode, 400);

  const malformed = response();
  await handler({method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${'é'.repeat(64)}`},rawBody:payload},malformed);
  assert.equal(malformed.statusCode,400,'Malformed signature must be rejected, not crash verification');

  const oversizedRequest = Readable.from([Buffer.alloc(1_048_577)]);
  oversizedRequest.method = "POST";
  oversizedRequest.headers = request.headers;
  const oversized = response();
  await handler(oversizedRequest, oversized);
  assert.equal(oversized.statusCode, 400);
} finally {
  if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
}
console.log("Stripe webhook tests passed: signed raw streams, tampering, expired signatures, and payload limits.");
