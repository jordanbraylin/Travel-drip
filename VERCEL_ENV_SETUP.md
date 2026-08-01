# Vercel Environment Variables for Travel-Drip

I could not add these directly from this workspace because the Vercel CLI is not installed and this environment is not connected to your Vercel account.

Add these in Vercel:

Project > Settings > Environment Variables

## Required for live Supabase login

```env
NEXT_PUBLIC_SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY
```

Travel-Drip also supports `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and the older `SUPABASE_ANON_KEY`, but the `NEXT_PUBLIC_*` names above match your requested setup.

After these are saved and the site is redeployed, the Sign Up and Log in forms use live Supabase email/password auth. If Supabase email confirmation is enabled, users will see a message to verify their email before logging in.

After deploy, open:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/health
```

The live-login fields should show:

```json
{
  "supabaseUrlConfigured": true,
  "supabasePublishableKeyConfigured": true
}
```

## Required for serverless API routes

```env
SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ADMIN_EMAILS=you@example.com
GUEST_ACCESS_PEPPER=PASTE_A_LONG_RANDOM_SERVER_ONLY_SECRET
```

## Shared wallet funding and admin card access

```env
STRIPE_SECRET_KEY=PASTE_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=PASTE_YOUR_STRIPE_WEBHOOK_SIGNING_SECRET
APP_BASE_URL=https://YOUR-VERCEL-DOMAIN.vercel.app
```

`STRIPE_SECRET_KEY` is server-only. The browser never receives it. Active members of eligible shared trips, events, and cruises can start a hosted Stripe Checkout contribution for their own funds. Corporate retreat and conference balances remain finance-controlled. The Stripe webhook calls the idempotent `complete_trip_wallet_contribution` Supabase function before the contribution is reflected in the shared balance. Configure a Stripe webhook for `/api/stripe-webhook` and subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

Trip owner, admin, organizer, and finance-admin roles receive the shared-card controls. Other members can contribute but cannot activate, lock, reveal, provision, change limits, or start tap-to-pay from the card. A real tap-to-pay purchase still requires an authorized card issuer/provider to populate `trip_wallet_cards.provider_card_ref` and provision NFC/mobile-wallet tokens; Stripe Checkout alone does not issue that card.

Do not treat the UI preview balance as a payment. If these server variables or the webhook are missing, the app blocks funding and leaves the balance unchanged.

## Trip and event ownership transfer

Run `supabase-ownership-transfer.sql` after the core and event-planning migrations. The `/api/ownership-transfer` route exposes only active-member candidates to the authenticated current owner, then calls the service-role-only SQL function to update trip ownership, event hosting, membership roles, and audit records in one transaction. No additional Vercel environment variable is needed beyond the existing Supabase server credentials. The transfer UI stays disabled in local file preview and for non-owners.

## Required for push notifications

```env
VAPID_SUBJECT=mailto:you@example.com
VAPID_PUBLIC_KEY=PASTE_YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=PASTE_YOUR_VAPID_PRIVATE_KEY
CRON_SECRET=PASTE_A_LONG_RANDOM_CRON_SECRET
```

Vercel calls `/api/wallet-reminders` every five minutes. The endpoint requires `CRON_SECRET`, queues one due-payment notification per active recipient, and dispatches queued wallet push alerts when VAPID keys are configured. In-app notifications remain available even when push is not configured.

## GoHighLevel sub-account connection

The Travel-Drip CRM integration uses the sub-account Location ID on the server. The configured sub-account is:

```env
GHL_LOCATION_ID=OiwRPGZ1ArPJvjPu0tzF
GHL_API_KEY=PASTE_YOUR_GO_HIGH_LEVEL_PRIVATE_INTEGRATION_TOKEN
```

Optional CRM automation values:

```env
GHL_PIPELINE_ID=
GHL_PIPELINE_STAGE_ID=
GHL_DEFAULT_WORKFLOW_ID=
GHL_WEBHOOK_SECRET=
```

Keep `GHL_API_KEY` and `GHL_WEBHOOK_SECRET` server-only. After adding them in Vercel, redeploy and use **Settings → GoHighLevel CRM → Test connection** as an administrator.

## Live outside-source travel search

The deployed website and installable PWA use the authenticated `/api/travel-search` route for live destination, activity, restaurant, hotel, and transportation discovery. Add these server-only variables in Vercel:

```env
GOOGLE_PLACES_API_KEY=PASTE_YOUR_GOOGLE_PLACES_SERVER_KEY
OPENAI_API_KEY=PASTE_YOUR_OPENAI_SERVER_KEY
OPENAI_MODEL=gpt-5
```

`GOOGLE_PLACES_API_KEY` enables Google Places Text Search for Explore, Smart Travel Search, and private-driver company search. Restrict the Google key to Places API server requests and set billing/quotas in Google Cloud. `OPENAI_API_KEY` enables the AI planner's live web research route. The browser receives normalized results and source links only; it never receives either secret.

If either provider is missing, the UI stays usable and labels local catalog content as estimates or reports that live search needs configuration. Render's static service does not run the `/api` functions, so deploy the server-backed search on Vercel or port these routes to a Render web service before calling it live.

Apply each variable to Production, Preview, and Development unless you intentionally want different values per environment.

After saving, redeploy the Vercel project. Environment variable changes only apply to new deployments.

## CLI option

If you have Vercel CLI installed and the project is linked:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_ADMIN_EMAILS production
vercel env add GUEST_ACCESS_PEPPER production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add APP_BASE_URL production
vercel env add VAPID_SUBJECT production
vercel env add VAPID_PUBLIC_KEY production
vercel env add VAPID_PRIVATE_KEY production
vercel env add CRON_SECRET production
vercel --prod
```

Repeat with `preview` and `development` if needed.

Never commit real values for `SUPABASE_SERVICE_ROLE_KEY`, `GUEST_ACCESS_PEPPER`, or `VAPID_PRIVATE_KEY`.
