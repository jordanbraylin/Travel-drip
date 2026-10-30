# Live Verification Scope

## Changes

- Find travel includes sourced excursion ideas and a separate restaurant section, with licensed photos where available, hover cards and in-app details.
- Trip organizers can save flights, boarding times, stays and rides in Trip plan. Existing activity entry remains available. Saved entries are not provider-confirmed bookings.
- Members can upload private travel documents directly in Trip plan. Uploads refresh saved records; switching accounts or trips cannot reassign an in-flight upload.
- Documents open in an in-app preview instead of a new tab. Uploading a file does not extract booking details automatically.
- Paid OpenAI calls are disabled by default. Free reference guides and guided planning work without an AI key and are explicitly labeled as not AI.
- Wallet checkout now requires the Stripe key, webhook signing secret and app URL before any contribution is created or payment session started. Retry lookups are scoped to the payer and reject changed amounts/currencies or already processed contributions.
- Optional Gemini summaries send only fetched public reference fields, not private requests, bookings, files, contacts or payments. Gemini needs a server-side key from an unbilled project and explicit free-tier confirmation. Quota/provider failures fall back to labeled reference guides, never paid OpenAI.

## Verification

- Production public routes, public configuration and Supabase auth settings responded successfully; unauthenticated private API requests were rejected.
- Before paid AI was disabled, a live OpenAI request returned HTTP 429, provider_quota_exhausted. Presence of a key was not proof of connectivity.
- Isolated browser tests saved flight/boarding, stay/check-out and rideshare entries and observed updated itinerary/widget counts. A harmless local image uploaded and opened in the in-app preview. These were fixture tests, not real production bookings or uploads.
- Automated tests cover record validation, write authentication, file limits, upload rollback and account/trip-switch ownership, restaurant filtering, sourced facts/photos, Gemini public-field filtering/cache/fallback, paid-AI opt-in and existing navigation/planner/feed behavior.
- Payment guard tests cover missing configuration, no writes while blocked, payer isolation, payment retry validation and configured mock checkout. Webhook tests reject malformed, tampered and expired signatures. No actual charge was made.

## Remaining Production Limits

- Gemini generation cannot be confirmed until GEMINI_API_KEY is configured and GEMINI_FREE_TIER_CONFIRMED=true for a verified unbilled project. Free-tier quotas and provider terms still apply.
- Google Places, live flight tracking, hotel availability and wallet funding were not configured in the production health probe.
- CRM key/location presence does not verify every HighLevel workflow. Pipeline/workflow configuration was incomplete.
- No real payment, invitation delivery, production document upload, booking fulfillment or exhaustive all-button journey was performed. No claim that every button or integration works is warranted.
- Health checks report configuration only. Full production readiness requires authenticated end-to-end tests with real providers and authorized test data.
