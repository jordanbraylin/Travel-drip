# Travel-Drip Production Go-Live Checklist

## Current status

The repository is **not ready for public production** until the provider and deployment checks below are completed. Static PWA and route QA run during Vercel builds. `/api/health` now reports `ready: false`, `readinessStatus: "blocked"`, and the names of missing required checks without exposing secret values.

## 1. Vercel configuration

Set these variables in Vercel for Production, Preview, and Development as appropriate:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ADMIN_EMAILS
GUEST_ACCESS_PEPPER
VAPID_SUBJECT
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
CRON_SECRET
APP_BASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Keep service-role, Stripe secret, VAPID private, cron, guest pepper, AI, CRM, and provider keys server-only. Never place them in `public-config.js`, HTML, or browser JavaScript.

Optional live providers:

```text
GHL_API_KEY
GHL_LOCATION_ID
GOOGLE_PLACES_API_KEY
FLIGHTAWARE_API_KEY
AMADEUS_CLIENT_ID
AMADEUS_CLIENT_SECRET
OPENAI_API_KEY
OPENAI_MODEL
```

After saving variables, redeploy and verify:

```text
https://YOUR_DOMAIN/api/health
```

Require `ready: true` before public launch. `invitationAiConfigured` and `walletFundingConfigured` must also be true before advertising those capabilities as live.

## 2. Supabase

- Run `supabase.sql`, `supabase-backend.sql`, `supabase-event-planning.sql`, `supabase-corporate-booking.sql`, `supabase-beta.sql`, `supabase-ownership-transfer.sql`, `supabase-wallet-notifications.sql`, and `supabase-ghl.sql` in the intended order.
- Run `npm run test:corporate-booking` and verify the deployed `/api/corporate-bookings` workflow with owner, organizer, finance admin, team lead, and employee accounts.
- Configure Auth redirect URLs for the production domain, `/login`, and `/register`.
- Enable email confirmation and test verification and password recovery.
- Verify RLS with separate owner, admin, member, finance, corporate employee, and guest accounts.
- Create private Storage buckets for profile photos, event media, documents, receipts, and travel confirmations.
- Test signed URLs, file-size/type validation, retention, backups, and a restore drill.

## 3. Payments and wallet

- Use Stripe live keys and configure `/api/stripe-webhook` for successful and asynchronous checkout events.
- Test idempotency, failed payments, refunds, ledger reconciliation, and duplicate webhook delivery.
- Do not call the virtual card or tap-to-pay feature production-ready until a regulated card issuer provisions the card and Apple Pay/Google Wallet/NFC tokenization.
- Confirm corporate and conference finance restrictions with real role-based accounts.

## 4. Notifications and providers

- Test browser push permission, subscription creation, delivery, click routing, unsubscribe, and expired subscription cleanup.
- Connect an email provider and an SMS provider with consent, opt-out, retry, bounce, and delivery logging.
- Verify Google Places, FlightAware, Amadeus, maps, GoHighLevel, and OpenAI credentials in deployed authenticated sessions.
- Confirm event invitation AI uses `sourceLabel: "AI invitation assistant"` only after a successful provider response; otherwise keep the local fallback label.

## 5. Release and user journeys

- Deploy a staging Vercel environment first.
- Test sign-up, email verification, sign-in, logout, protected-route refresh, and session expiry.
- Test event creation, AI invitation generation, draft saving, invitation copy, guest access, RSVP, ownership transfer, and event completion.
- Test wallet contribution, admin visibility, payment confirmation, refund eligibility, and notifications.
- Test live flight, hotel, restaurant, activity, and transportation searches.
- Test Chrome, Safari, Firefox, Edge, iPhone, Android, tablet, desktop, reduced motion, offline fallback, and PWA installation.
- Promote the verified staging commit to Production and keep the previous deployment available for rollback.

## 6. Operations and success

- Commit a lockfile before launch; the current repository does not yet contain `package-lock.json`.
- Enable Vercel deployment protection for previews, logs, spend alerts, and team least-privilege access.
- Add error/performance monitoring, database alerts, payment/webhook alerts, and an incident response owner.
- Publish Privacy, Terms, support contact, account deletion, retention, and beta participation instructions.
- Start with an invite-only beta, track activation, first trip/event created, invitation sent, RSVP completion, successful search, and payment success rate.

## Release gate

Do not announce public availability until `/api/health` reports `ready: true`, all live claims have a provider test record, the Supabase restore drill passes, and the deployed end-to-end journeys are recorded against the production domain.
