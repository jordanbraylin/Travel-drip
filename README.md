# Traveldrip

Traveldrip is a Vercel-ready PWA for group trip planning with Supabase auth, realtime trip events, and admin-triggered web push notifications.

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
4. The project URL is already set to `https://bfuiqmmbsgfcnyeneunv.supabase.co`; copy your publishable key into Vercel as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Copy your service role key into Vercel as `SUPABASE_SERVICE_ROLE_KEY`. Never put this key in browser code.
6. Add your admin email to `SUPABASE_ADMIN_EMAILS`.
7. In Supabase Auth settings, add your Vercel URL to the allowed redirect URLs.
8. In Supabase Auth providers, make sure Email is enabled. If Confirm email is on, new users must verify their inbox before logging in.
9. Add these allowed redirect URLs in Supabase Auth URL Configuration:
   - `https://YOUR-VERCEL-DOMAIN.vercel.app`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/login`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/register`

For local static preview login, paste only the browser-safe publishable key into `public-config.js`. Do not put service-role or private notification keys in that file.

See `BACKEND_ARCHITECTURE.md` for the full backend table, API, RLS, audit, and production integration notes. See `BACKEND_SCALABILITY_REPORT.md` for the backend scalability, data-storage, backup, restore, monitoring, load-test, and final readiness checklist.

## Corporate guest access portal

TravelDrip now includes a Corporate Guest Portal entry from the login screen for invited employees, contractors, speakers, vendors, and event attendees. The production API is `/api/guest-access`.

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

The current wallet UI includes the shared Trip Virtual Wallet, Group Bank dashboard, personal contribution ledger, refundable balance rules, admin controls, refund requests, leave-trip review, and permanent audit log surfaces. Adding funds, requesting refunds, and leaving-trip refund review require a 4-digit PIN confirmation in the mock UI. This confirms the intended user flow, but it is not a production payment processor.

Every eligible group trip, event, cruise, or corporate retreat should have one shared trip wallet, one unique wallet identifier, one masked trip wallet card, one transaction ledger, one contribution ledger, and one audit trail. Member contributions are pooled into the trip wallet balance while each user's contribution history, refundable balance, and refund activity remain separately tracked.

For a real secured wallet, connect the Add funds action to Stripe Checkout, Stripe Payment Intents, or another PCI-compliant provider. Keep card data out of Traveldrip, verify PIN/payment state on a serverless API route, store only provider transaction IDs/idempotency keys, and use Supabase Row Level Security for trip wallet and contribution records.

Core rule: users always see their own contributions, and money not committed to deposits, reservations, flights, hotels, activities, or group purchases remains refundable to the original contributor.

## Virtual wallet card and mobile wallet access

The app now includes a TravelDrip virtual wallet card surface connected to eligible available wallet funds. It shows masked card details, spendable balance, card status, recent card transactions, mobile wallet provisioning actions, Tap to Pay as a customer guidance, spending controls, refund handling, corporate retreat restrictions, and PIN-gated sensitive actions.

For production, the virtual card must be issued through an authorized banking, card-issuing, or payment-processing partner. Store only provider card IDs, masked card numbers, token references, controls, and ledger records. Do not store raw card numbers or CVV values in Supabase or browser code unless the entire system is certified for that scope. Apple Pay, Google Wallet, Samsung Wallet, and contactless NFC purchases require issuer/card-network wallet token provisioning.

Tap to Pay as a customer means the traveler spends from the TravelDrip virtual card at a merchant NFC terminal. Tap to Pay as a merchant, where a user accepts someone else's card payment on their phone, is a separate merchant-processing feature and is not part of the initial card surface.

## Smart restaurant bill split

TravelDrip now includes a Smart Restaurant Bill Split calculator for group meals. Users can enter bill subtotal, tax, tip, fees, discounts, and diner count, then preview equal, custom, percentage, or itemized splits in real time. The screen includes receipt scan simulation, AI tip guidance, payment-method options for TravelDrip Wallet, linked cards, Apple Pay, Google Wallet, and outside-app payment status.

For production, restaurant bills and participant shares should sync through Supabase using `restaurant_bills` and `restaurant_bill_shares`. Payment settlement should be handled by the wallet/payment processor, with each paid portion reflected in the wallet ledger. Corporate retreat mode should keep employee views limited to their own assigned meal and portion while finance admins can view total meal expenses, invoices, department allocations, and budget impact.

## Smart ride share hub

TravelDrip now includes a Smart Ride Share Hub for transportation planning and cost splitting. It recommends common providers by destination, including Uber/Lyft in the United States and Canada, Uber/Bolt in the United Kingdom, Uber/DiDi in Mexico, Uber/99 in Brazil, GO/Uber in Japan, Grab in Singapore/Malaysia/Thailand, Grab/Gojek in Indonesia, Uber/Ola in India, and Careem/Uber in the United Arab Emirates.

The hub supports favorite pickup and drop-off locations, provider launch placeholders, ride sharing with the group, receipt import simulation, AI transportation advice, equal/custom/percentage fare splitting, and payment method options for TravelDrip Wallet, TravelDrip Virtual Card, Apple Pay, Google Wallet, and linked payment methods. Production ride expenses should sync through `ride_share_expenses` and `ride_share_expense_shares`, then update wallet ledgers and trip transportation summaries after processor confirmation.

Corporate retreat mode should limit employee visibility to their own assigned transportation, pickup time, driver details when available, and pickup/drop-off locations. Finance and event admins can view total transportation costs, vehicle assignments, department spending, vendor invoices, and budget utilization.

## Group chat and private messaging

TravelDrip now includes a dedicated Messages hub with Group Chats and Private Messages tabs. Group conversations show trip/event photos, last messages, unread counts, online-member counts, pinned announcements, attachments, polls, itinerary cards, payment requests, ride-share invitations, and AI Trip Manager responses. Private messages support one-on-one conversations with trip members, friends, teammates, organizers, hosts, vendors, and event staff.

Messaging permissions adapt by trip type: solo trips default to private messaging, group trips automatically create trip chats, corporate retreats can separate announcements, team chats, admin chat, finance chat, transportation chat, and event support, and weddings/events can support custom rooms such as wedding party, family, guests, vendors, and event staff. Production data extends `chat_rooms` and `messages` with participants, shared items, reactions, reports, read state, pinned messages, and room permissions.

## User profile photos

TravelDrip now includes optional profile photo setup during account creation and a full profile-photo manager in the Profile/Security area. Users can upload from their library, take a camera photo, drag and drop on web, preview the avatar, adjust crop shape, zoom, rotate, remove the photo, restore initials, and choose privacy: public, friends only, trip members only, organization only, or private.

Production profile-photo support extends `profiles` with avatar storage, thumbnail, source, visibility, moderation status, and metadata fields. `profile_photo_uploads` records file type, size, crop settings, optimized variants, upload source, and moderation status. Store real images in Supabase Storage or another secure object store, validate file types and size, optimize variants server-side, and never expose private storage paths without an authorized signed URL.

## Smart itinerary notifications

TravelDrip now includes Smart Itinerary Notifications for flight status changes, hotel reminders, transportation updates, itinerary edits, activity changes, payment deadlines, wallet activity, meeting point reminders, weather impacts, emergency announcements, and important travel updates.

Travelers can choose alert categories and delivery channels: push, email, SMS where available, and in-app alerts. Emergency announcements remain always-on for traveler safety. Production preference sync is represented in `itinerary_notification_preferences`, while sent/queued itinerary alerts can be recorded in `itinerary_notification_events`.

## Reservation and paid excursion reminders

TravelDrip now includes reminder workflows for confirmed restaurant reservations, paid excursions, cruise activities, and corporate assigned events. The itinerary notification screen shows reminder schedules for confirmation, 24-hour, 2-hour, 30-minute, and smart departure alerts, plus quick actions for viewing reservations, tickets, itinerary details, directions, venue/organizer contact, companion reminders, sharing with trip members, and calendar sync.

Production reminder data is represented in `reservation_reminder_preferences`, `reservation_records`, `reservation_attendees`, `reservation_reminders`, and `reservation_calendar_syncs`. Scheduled jobs should queue reminder notifications only for assigned attendees, calculate time-to-leave guidance from traffic/location/provider data, and keep corporate employees limited to their own assigned meals, sessions, transportation, and activities.

## Cruise vacation mode

TravelDrip now supports Cruise Vacation as a guided trip type. The app includes a cruise overview, ship details, cabin assignment, port schedule, shore excursions, onboard schedule, dining reservations, cruise wallet, cruise documents, notifications, AI Cruise Manager, group cruise features, corporate cruise visibility rules, and post-cruise memories.

Production cruise data is represented in `supabase-backend.sql` with `cruise_bookings`, `cruise_cabins`, `cruise_ports`, `cruise_excursions`, `cruise_onboard_activities`, and `cruise_dining_reservations`. Cruise line imports, live excursion availability, ship maps, and onboard account spending require provider integrations before they can be production-live.

## Daily memory reminder

TravelDrip now includes an End-of-Day Memory Prompt inside the Memories/Social hub. After a travel day or final itinerary item ends, travelers can be prompted to upload photos, videos, take a photo, record a video, add notes, generate an AI journal, create a highlight reel, or skip for now.

Users choose visibility before upload: private, trip members, friends, shared album, company only, or public profile. Nothing is shared automatically. Production data is represented in `daily_memory_preferences`, `daily_memory_prompts`, and `daily_memory_items`.

## Enterprise corporate retreat mode

The app now includes a Corporate Retreat RBAC section with role previews for Company Owner, Finance Admin, Retreat Organizer, Team Leader, and Employee. The preview demonstrates financial privacy rules: employees can see personal travel details and schedules, while corporate budgets and payment data are visible only to owner/finance roles.

For production, enforce these rules on the server and database, not just in the UI. Use `retreat_members.role`, row-level security, server-side permission checks, two-factor authentication for finance/admin roles, and `retreat_permission_audit` for access history. The AI assistant should receive the authenticated user's role and deny restricted financial requests before retrieving data.

## Important Information hub

Every trip now has an Important Information section for required documents, rules, corporate policies, destination info, packing lists, emergency contacts, meeting points, downloads, FAQ, announcements, and read confirmations. Travelers can search the section, complete personal checklist items, download attachments, and acknowledge critical policies.

For production, organizers/admins should be the only roles allowed to edit `trip_important_information` and upload `trip_attachments`. Travelers should have read-only access plus insert access for their own `important_information_acknowledgments`.

## Add to home screen

Android Chrome: open Traveldrip, tap the install prompt or the browser menu, then choose Install app.

iPhone Safari: open Traveldrip, tap Share, choose Add to Home Screen, then tap Add. iOS notification support requires the app to be added to the home screen first.

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
