# Travel-Drip

Travel-Drip is a Vercel-ready PWA for travel planning with Supabase auth, realtime trip events, and admin-triggered web push notifications.

## Beta launch on Render

The repository includes `render.yaml` for an installable static PWA beta. The Render static deployment supports the browser experience, Supabase Auth, and the protected trusted-contact flow. The existing `/api` functions are Vercel serverless functions; keep Vercel for those server-side notification/admin routes until they are ported to a Render web service.

1. In Render, create a Blueprint from the `jordanbraylin/Travel-drip` GitHub repository.
2. Confirm the service root is the directory containing `render.yaml`, `package.json`, and `index.html` (the committed app root).
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the Stripe test publishable key as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the Render service. The build creates `public-config.js` from these values; do not paste a service-role key or Stripe secret key into Render's public build variables or any browser file.
4. Run `supabase.sql`, `supabase-backend.sql`, and `supabase-event-planning.sql` in the Supabase SQL editor. Then run `supabase-beta.sql` and `supabase-ownership-transfer.sql` to create the profile metadata trigger, protected trusted-contact table, and atomic owner-transfer function.
5. In Supabase Auth URL Configuration, add the Render URL, `/login`, and `/register` as allowed redirect URLs.
6. After the first deploy, install the beta from the browser and test sign-up, email verification, sign-in, profile save, trusted-contact create/remove, sign-out, and a fresh browser session.

Render's static beta does not run the existing Vercel `/api` functions. Do not label push-admin, payment, guest-access, or other server-only workflows as live on Render until those endpoints are deployed to a compatible server runtime and their secrets are configured there.

Public store-readiness pages are available at `/privacy.html` and `/terms.html`. Review them with the final business/legal contact before using them in App Store or Google Play metadata.

## Launch on Vercel

1. Create a free Vercel account and install the Vercel CLI if needed.
2. From this folder, run `npm install`.
3. Run `npx vercel` and choose this directory as the project root.
4. Add the environment variables from `.env.example` in Vercel Project Settings. See `VERCEL_ENV_SETUP.md` for the exact values and commands.
5. Run `npx vercel --prod` after the variables are set.
6. Open `/api/health` on the deployed domain and confirm the required values return `true`.

## Supabase setup

1. Create a free Supabase project.
2. Open the SQL editor and run `supabase.sql`.
3. Run `supabase-backend.sql` to add the production backend foundation for trips, events, invitations, RSVP, schedules, wallet ledgers, receipts, role permissions, notifications, and audit logs.
4. Run `supabase-event-planning.sql` to add explicit event-planning tables, event-specific RLS, and the expanded event type constraint for weddings, birthdays, anniversaries, reunions, conferences, graduation trips, church retreats, bachelor/bachelorette trips, and special events.
5. Run `supabase-wallet-notifications.sql` to add trip wallet payment requests, contribution-confirmation notifications, due-payment scheduling, and notification realtime publication.
6. The project URL is already set to `https://bfuiqmmbsgfcnyeneunv.supabase.co`; copy your publishable key into Vercel as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
7. Copy your service role key into Vercel as `SUPABASE_SERVICE_ROLE_KEY`. Never put this key in browser code.
8. Add your admin email to `SUPABASE_ADMIN_EMAILS`.
9. In Supabase Auth settings, add your Vercel URL to the allowed redirect URLs.
10. In Supabase Auth providers, make sure Email is enabled. If Confirm email is on, new users must verify their inbox before logging in.
11. Add these allowed redirect URLs in Supabase Auth URL Configuration:
   - `https://YOUR-VERCEL-DOMAIN.vercel.app`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/login`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/register`

For local static preview login, paste only the browser-safe publishable key into `public-config.js`. Do not put service-role or private notification keys in that file.

## Live outside-source travel search

Explore and the Travel hub now have explicit **Search live sources** actions. In a deployed authenticated Vercel session, `/api/travel-search` calls Google Places Text Search server-side and normalizes current destination, activity, restaurant, hotel, and transportation results with provider links, map directions, ratings, and live/open status where supplied. Local catalog cards remain available as estimates and are not presented as live data.

The AI Travel Planner has **Search live sources** as well. `/api/ai-planner` calls the OpenAI Responses API with the web-search tool, returns a source-backed summary, and displays citations. The AI prompt is limited to travel research and instructs the model to distinguish estimates from provider facts, avoid confidential corporate data, and remind travelers to verify before booking. `store: false` is used for this request.

Configure `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY`, and `OPENAI_MODEL` in Vercel as server-only variables. Do not put either secret in `public-config.js`, HTML, or browser JavaScript. Search is rate-limited at the API boundary and upstream failures/timeouts are reported without replacing local results. Live provider search is not available from the `file:` preview or the static Render service because those environments do not run the protected `/api` routes.

The sign-up flow sends `full_name` and `username` as Auth metadata. The `supabase-beta.sql` trigger materializes those values into `profiles`; profile edits and trusted contacts are then written through the authenticated Supabase client and protected by RLS.

See `BACKEND_ARCHITECTURE.md` for the full backend table, API, RLS, audit, and production integration notes. See `BACKEND_SCALABILITY_REPORT.md` for the backend scalability, data-storage, backup, restore, monitoring, load-test, and final readiness checklist.

## Corporate guest access portal

Travel-Drip now includes a Corporate Guest Portal entry from the login screen for invited employees, contractors, speakers, vendors, and event attendees. The production API is `/api/guest-access`.

For Supabase/Vercel production use:

1. Run `supabase-backend.sql`.
2. Add `GUEST_ACCESS_PEPPER` in Vercel as a long random server-only value.
3. Use `/api/guest-access` with authenticated admin actions to create access codes and attendee records.
4. Guests verify with company/event code plus employee email or attendee ID. Last-name and company-domain checks can be required per event policy.
5. Corporate routes, dashboard mode switching, invitations, event schedules, documents, attendee records, announcements, and approved media remain hidden until a short-lived corporate access session is verified.
6. Guest sessions are temporary, audited, rate-limited, and expose only approved personal travel, schedule, information, and media records.
7. Corporate admins can generate, replace, extend, revoke, and audit event codes without exposing stored code values.

Do not store raw access codes or employee IDs in browser storage, logs, analytics, or public files.

## Push notification setup

1. Generate VAPID keys with `npx web-push generate-vapid-keys`.
2. Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to Vercel.
3. Users must sign in, tap Notify, and accept browser permissions.
4. Admins can send notifications from `/admin.html` or `/admin`.

## Wallet and payment security

The current wallet UI includes the shared Trip Virtual Wallet, Group Bank dashboard, personal contribution ledger, refundable balance rules, admin controls, refund requests, leave-trip review, and permanent audit log surfaces. Requesting refunds and leaving-trip refund review still require a 4-digit PIN confirmation in the mock UI. Member funding uses the server-side provider flow described below; it is blocked when provider configuration is missing.

Every eligible group trip, event, cruise, or corporate retreat should have one shared trip wallet, one unique wallet identifier, one masked trip wallet card, one transaction ledger, one contribution ledger, and one audit trail. Member contributions are pooled into the trip wallet balance while each user's contribution history, refundable balance, and refund activity remain separately tracked.

The Add funds action now has a server-side Stripe Checkout path in `/api/wallet`: every active member of an eligible shared trip, event, or cruise can create a hosted contribution checkout, while corporate retreat and conference balances remain finance-controlled. The server derives the user and trip role from Supabase membership, returns a personal contribution ledger to members, and returns the full ledger only to authorized finance roles. The `/api/stripe-webhook` route verifies Stripe signatures and calls the idempotent `complete_trip_wallet_contribution` function before the shared balance changes. Deposit confirmation creates trip-scoped in-app notifications for active members. Authorized finance roles can create due-payment requests, and the Vercel cron at `/api/wallet-reminders` queues and dispatches due alerts. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL`, and `CRON_SECRET`; otherwise funding is blocked and no local balance is changed. Keep card data out of Travel-Drip, store only provider transaction IDs/idempotency keys, and use Supabase Row Level Security for trip wallet and contribution records. `pk_test_...` is test mode only; it does not activate real funding, refunds, card spending, or wallet provisioning.

## Transfer trip or event ownership

The current trip or event owner can open **My Trips → Ownership & permissions**, load active members, and transfer full ownership to another active member. The server checks the authenticated owner, requires the recipient to be active in the trip (and event when applicable), updates `trips.owner_user_id` and `events.host_user_id` atomically, promotes the recipient to `owner`, and demotes the previous owner to `organizer` or `traveler/attendee` when they choose to leave. The `supabase-ownership-transfer.sql` function is service-role-only and writes both the shared audit log and event audit log; no browser role can call it directly. Ownership transfer is unavailable in file preview because it must never be simulated with local state.

Core rule: users always see their own contributions, and money not committed to deposits, reservations, flights, hotels, activities, or group purchases remains refundable to the original contributor.

## Virtual wallet card and mobile wallet access

The app now includes a Travel-Drip virtual wallet card surface connected to eligible available wallet funds. It shows masked card details, spendable balance, card status, recent card transactions, mobile wallet provisioning actions, Tap to Pay as a customer guidance, spending controls, refund handling, corporate retreat restrictions, and PIN-gated sensitive actions.

For production, the virtual card must be issued through an authorized banking, card-issuing, or payment-processing partner. Store only provider card IDs, masked card numbers, token references, controls, and ledger records. Do not store raw card numbers or CVV values in Supabase or browser code unless the entire system is certified for that scope. Apple Pay, Google Wallet, Samsung Wallet, and contactless NFC purchases require issuer/card-network wallet token provisioning.

Only trip owner, admin, organizer, or finance-admin roles receive shared-card controls and the admin tap-to-pay action. Membership is checked server-side; hiding a button in the browser is not the security boundary. Tap to Pay as a customer means the authorized admin spends from the Travel-Drip virtual card at a merchant NFC terminal. It remains provider-gated until an issuer provisions `provider_card_ref` and the required Apple/Google/Samsung/NFC tokenization. Tap to Pay as a merchant, where a user accepts someone else's card payment on their phone, is a separate merchant-processing feature and is not part of the initial card surface.

## Smart restaurant bill split

Travel-Drip now includes a Smart Restaurant Bill Split calculator for group meals. Users can enter bill subtotal, tax, tip, fees, discounts, and diner count, then preview equal, custom, percentage, or itemized splits in real time. The screen includes receipt scan simulation, AI tip guidance, payment-method options for Travel-Drip Wallet, linked cards, Apple Pay, Google Wallet, and outside-app payment status.

For production, restaurant bills and participant shares should sync through Supabase using `restaurant_bills` and `restaurant_bill_shares`. Payment settlement should be handled by the wallet/payment processor, with each paid portion reflected in the wallet ledger. Corporate retreat mode should keep employee views limited to their own assigned meal and portion while finance admins can view total meal expenses, invoices, department allocations, and budget impact.

## Smart ride share hub

Travel-Drip now includes a Smart Ride Share Hub for transportation planning and cost splitting. It recommends common providers by destination, including Uber/Lyft in the United States and Canada, Uber/Bolt in the United Kingdom, Uber/DiDi in Mexico, Uber/99 in Brazil, GO/Uber in Japan, Grab in Singapore/Malaysia/Thailand, Grab/Gojek in Indonesia, Uber/Ola in India, and Careem/Uber in the United Arab Emirates.

The hub supports favorite pickup and drop-off locations, provider launch placeholders, ride sharing with the group, receipt import simulation, AI transportation advice, equal/custom/percentage fare splitting, and payment method options for Travel-Drip Wallet, Travel-Drip Virtual Card, Apple Pay, Google Wallet, and linked payment methods. Production ride expenses should sync through `ride_share_expenses` and `ride_share_expense_shares`, then update wallet ledgers and trip transportation summaries after processor confirmation.

Corporate retreat mode should limit employee visibility to their own assigned transportation, pickup time, driver details when available, and pickup/drop-off locations. Finance and event admins can view total transportation costs, vehicle assignments, department spending, vendor invoices, and budget utilization.

## Group chat and private messaging

Travel-Drip now includes a dedicated Messages hub with Group Chats and Private Messages tabs. Group conversations show trip/event photos, last messages, unread counts, online-member counts, pinned announcements, attachments, polls, itinerary cards, payment requests, ride-share invitations, and AI Trip Manager responses. Private messages support one-on-one conversations with trip members, friends, teammates, organizers, hosts, vendors, and event staff.

Messaging permissions adapt by trip type: solo trips default to private messaging, group trips automatically create trip chats, corporate retreats can separate announcements, team chats, admin chat, finance chat, transportation chat, and event support, and weddings/events can support custom rooms such as wedding party, family, guests, vendors, and event staff. Production data extends `chat_rooms` and `messages` with participants, shared items, reactions, reports, read state, pinned messages, and room permissions.

## User profile photos

Travel-Drip now includes optional profile photo setup during account creation and a full profile-photo manager in the Profile/Security area. Users can upload from their library, take a camera photo, drag and drop on web, preview the avatar, adjust crop shape, zoom, rotate, remove the photo, restore initials, and choose privacy: public, friends only, trip members only, organization only, or private.

Production profile-photo support extends `profiles` with avatar storage, thumbnail, source, visibility, moderation status, and metadata fields. `profile_photo_uploads` records file type, size, crop settings, optimized variants, upload source, and moderation status. Store real images in Supabase Storage or another secure object store, validate file types and size, optimize variants server-side, and never expose private storage paths without an authorized signed URL.

## Smart itinerary notifications

Travel-Drip now includes Smart Itinerary Notifications for flight status changes, hotel reminders, transportation updates, itinerary edits, activity changes, payment deadlines, wallet activity, meeting point reminders, weather impacts, emergency announcements, and important travel updates.

Travelers can choose alert categories and delivery channels: push, email, SMS where available, and in-app alerts. Emergency announcements remain always-on for traveler safety. Production preference sync is represented in `itinerary_notification_preferences`, while sent/queued itinerary alerts can be recorded in `itinerary_notification_events`.

## AI Travel Planner

Travel-Drip now includes an AI Travel Planner route at `/ai-planner` with a prominent Home Dashboard action. The planner asks one question at a time, remembers answers for the current planning session, adapts output for solo, group, cruise, and corporate travel, and generates an editable itinerary preview with estimated costs, travel windows, travel style, and trip-mode guidance.

Planner actions include Start Planning, Save Progress, Regenerate Itinerary, Create Trip, Share Trip, Export PDF, Add to Calendar, and Delete Planner Memory. Production persistence is represented in `ai_travel_preferences` and `ai_travel_plans`; users must be able to review, edit, or delete saved preferences and conversations.

## Global destination header

Internal app pages now include a compact rotating destination header below the main topbar. It keeps Home's full destination banner unique while Explore, Trips, Messages, Wallet, Transportation, Cruise, AI Planner, Profile, Settings, and policy pages continue showing destination photography, page-aware travel prompts, and a small action link. The header pauses on hover, supports mobile swipe gestures, respects reduced-motion settings, and stays hidden on Login/Sign-Up.

## Reservation and paid excursion reminders

Travel-Drip now includes reminder workflows for confirmed restaurant reservations, paid excursions, cruise activities, and corporate assigned events. The itinerary notification screen shows reminder schedules for confirmation, 24-hour, 2-hour, 30-minute, and smart departure alerts, plus quick actions for viewing reservations, tickets, itinerary details, directions, venue/organizer contact, companion reminders, sharing with trip members, and calendar sync.

Production reminder data is represented in `reservation_reminder_preferences`, `reservation_records`, `reservation_attendees`, `reservation_reminders`, and `reservation_calendar_syncs`. Scheduled jobs should queue reminder notifications only for assigned attendees, calculate time-to-leave guidance from traffic/location/provider data, and keep corporate employees limited to their own assigned meals, sessions, transportation, and activities.

## Cruise vacation mode

Travel-Drip now supports Cruise Vacation as a guided trip type. The app includes a cruise overview, ship details, cabin assignment, port schedule, shore excursions, onboard schedule, dining reservations, cruise wallet, cruise documents, notifications, AI Cruise Manager, group cruise features, corporate cruise visibility rules, and post-cruise memories.

Production cruise data is represented in `supabase-backend.sql` with `cruise_bookings`, `cruise_cabins`, `cruise_ports`, `cruise_excursions`, `cruise_onboard_activities`, and `cruise_dining_reservations`. Cruise line imports, live excursion availability, ship maps, and onboard account spending require provider integrations before they can be production-live.

## Daily memory reminder

Travel-Drip now includes an End-of-Day Memory Prompt inside the Memories/Social hub. After a travel day or final itinerary item ends, travelers can be prompted to upload photos, videos, take a photo, record a video, add notes, generate an AI journal, create a highlight reel, or skip for now.

Users choose visibility before upload: private, trip members, friends, shared album, company only, or public profile. Nothing is shared automatically. Production data is represented in `daily_memory_preferences`, `daily_memory_prompts`, and `daily_memory_items`.

## Enterprise corporate retreat mode

The app now includes a Corporate Retreat RBAC section with role previews for Company Owner, Finance Admin, Retreat Organizer, Team Leader, and Employee. The preview demonstrates financial privacy rules: employees can see personal travel details and schedules, while corporate budgets and payment data are visible only to owner/finance roles.

For production, enforce these rules on the server and database, not just in the UI. Use `retreat_members.role`, row-level security, server-side permission checks, two-factor authentication for finance/admin roles, and `retreat_permission_audit` for access history. The AI assistant should receive the authenticated user's role and deny restricted financial requests before retrieving data.

## Important Information hub

Every trip now has an Important Information section for required documents, rules, corporate policies, destination info, packing lists, emergency contacts, meeting points, downloads, FAQ, announcements, and read confirmations. Travelers can search the section, complete personal checklist items, download attachments, and acknowledge critical policies.

For production, organizers/admins should be the only roles allowed to edit `trip_important_information` and upload `trip_attachments`. Travelers should have read-only access plus insert access for their own `important_information_acknowledgments`.

## Add to home screen

Android Chrome: open Travel-Drip, tap the install prompt or the browser menu, then choose Install app.

iPhone Safari: open Travel-Drip, tap Share, choose Add to Home Screen, then tap Add. iOS notification support requires the app to be added to the home screen first.

## QA checklist

- Mobile layout stacks cleanly under 760px.
- Service worker registers and app shell caches for offline reloads.
- Email/password login and registration are enabled through Supabase.
- Realtime sync writes to `trip_events` and listens for new events.
- Admin page is present at `/admin.html` and `/admin`.
- Notification API requires a valid Supabase session and allowlisted admin email.
- Admin allowlist is checked server-side at `/api/admin-status`; the allowlist is not exposed in browser config.
- Launch health can be checked at `/api/health` without exposing secret values.
- Private values stay in Vercel environment variables and are not committed.
