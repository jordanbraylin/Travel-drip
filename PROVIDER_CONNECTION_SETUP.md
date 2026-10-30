# Remaining Provider Connections

Do not put private API keys in chat, browser code, Git, or public configuration.

## Stripe Wallet Funding

The production Stripe secret key is present. Its webhook signing secret is not configured.

1. In the same Stripe account and mode as the deployed secret key, register or inspect the existing webhook destination for `https://travel-drip.com/api/stripe-webhook`.
2. Use snapshot payloads for this handler. Enable `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
3. Add that destination's signing secret securely to Vercel's production environment as `STRIPE_WEBHOOK_SECRET`. Keep the existing `STRIPE_SECRET_KEY`; confirm `APP_BASE_URL=https://travel-drip.com`.
4. Redeploy. Check configuration and webhook signature rejection before testing a deposit with authorized test data. Verify that a successful test payment credits exactly one contribution, including after a webhook retry. Never mark a contribution paid from a checkout return URL alone.

Stripe setup reference: https://docs.stripe.com/webhooks

## Gemini Public Destination Summaries

Use an unbilled Google AI Studio project with free-tier access. Store its key as `GEMINI_API_KEY` in Vercel production. Set `GEMINI_FREE_TIER_CONFIRMED=true` only after confirming the project is not billed. Redeploy and test a public destination question. Keep `ALLOW_PAID_AI` unset or false.

Only fetched public guide titles, descriptions and reference URLs are sent to Gemini. Private trip requests, documents, bookings, contacts and payment data are not sent. Provider errors fall back to explicitly labeled non-AI guides. A free-tier account still has quotas and provider terms.

## Live Flight And Hotel Data

Live flight tracking requires `FLIGHTAWARE_API_KEY` (or the existing `FLIGHT_TRACKING_API_KEY` alias). Live hotel availability requires `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET`. These are separate from free destination guides and manually saved trip records. Provider account access, quota and connectivity must be tested after secure configuration.

## Verification Limits

`/api/health` reports configuration presence, not provider connectivity or financial settlement. Do not claim that all integrations work until authenticated provider-backed journeys have been verified. Connecting the Stripe and Vercel integrations can allow account configuration without exchanging secrets in chat.
