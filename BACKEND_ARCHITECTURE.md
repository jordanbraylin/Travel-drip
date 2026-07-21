# TravelDrip Backend Architecture

This project now includes a production-oriented backend foundation for Supabase and Vercel serverless APIs.

## Supabase Schema

Run these SQL files in order:

1. `supabase.sql`
2. `supabase-backend.sql`

The backend schema adds:

- User profiles, privacy-controlled profile photos, profile photo upload audit records, and notification preferences
- Organizations and organization members
- Unified trip/event records for solo trips, group trips, corporate retreats, cruise vacations, weddings, birthdays, family reunions, bachelor/bachelorette trips, anniversaries, conferences, business events, and custom special events
- Trip membership, roles, feature flags, and enabled modules
- Invitations with secure tokens, RSVP tracking, and guest registration support
- Corporate guest access codes, employee/attendee ID verification, temporary guest sessions, and guest access audit events
- Schedule, flights, hotels, transportation, ride-share connections, group/private chat rooms, message participants, reactions, shared media, reports, polls, and votes
- Cruise bookings, cabin assignments, port schedules, shore excursions, onboard activities, and dining reservations
- Reservation and paid excursion records, assigned attendees, reminder preferences, queued reminder notifications, smart departure payloads, and calendar sync status
- Daily memory reminder preferences, end-of-day prompt events, and organized memory items by trip/day/itinerary
- Wallets, group banks, wallet transactions, receipt scanning records, item claims, ride split participants, and refund-ready audit data
- Important information, acknowledgments, documents, media, social connections, AI sessions, notifications, background jobs, saved places, and audit logs

## Access Control

`supabase-backend.sql` enables Row Level Security for every new table and adds helper functions:

- `public.is_trip_member(trip_uuid)`
- `public.has_trip_role(trip_uuid, allowed_roles)`
- `public.is_org_member(org_uuid, allowed_roles)`

The browser can only read or modify records allowed by RLS. Serverless APIs use `SUPABASE_SERVICE_ROLE_KEY` on the server only for privileged workflows after validating the user's Supabase session.

## Serverless APIs

New Vercel API routes:

- `GET /api/trips` lists the authenticated user's trips.
- `POST /api/trips` creates a trip/event, owner membership, default modules, feature flags, AI session, and audit log.
- `PATCH /api/trips` updates trip metadata for trip admins.
- `GET /api/invitations?tripId=...` lists invitations for organizers/admins.
- `POST /api/invitations` creates a tokenized invite.
- `PATCH /api/invitations` responds to an invite by token or admin action.
- `GET|POST|PATCH /api/rsvp` manages RSVP records.
- `GET|POST|PATCH|DELETE /api/schedule` manages itinerary and event schedule items.
- `GET /api/explore` returns category-specific Explore results with working action URLs and empty states.
- `GET /api/audit?tripId=...` returns audit logs for owner/admin/organizer/finance roles.
- `POST /api/guest-access` supports `create-code`, `update-code`, `upsert-attendee`, `revoke-code`, public `verify`, `refresh-session`, `submit-acknowledgment`, `send-otp`, and `upgrade-account` actions.
- `GET /api/guest-access` returns the verified Corporate Guest Portal for a temporary guest session token.
- `DELETE /api/guest-access` ends a temporary guest session.

## Environment Variables

Required for live backend writes:

```text
NEXT_PUBLIC_SUPABASE_URL=https://bfuiqmmbsgfcnyeneunv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-browser-safe-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_ADMIN_EMAILS=admin@example.com
GUEST_ACCESS_PEPPER=long-random-server-only-secret
```

Do not place `SUPABASE_SERVICE_ROLE_KEY`, `GUEST_ACCESS_PEPPER`, payment secrets, OAuth client secrets, VAPID private keys, or provider refresh tokens in `public-config.js`, static HTML, or client JavaScript.

## Production Integrations Still Needed

The backend has the tables, permission model, and API foundation for production. These external integrations still need provider credentials and webhook implementation before they can be called production-complete:

- Stripe or another PCI-compliant wallet/payment processor
- Card issuing and mobile wallet token provisioning
- OCR/AI receipt extraction provider
- Email/SMS delivery provider
- Ride-share OAuth and receipt import providers
- Scheduled job runner for reminders, invite expiry, refunds, travel alerts, and notification retries
- Email/OTP delivery for high-risk guest access verification

Payment card data, raw OAuth passwords, CVV values, and private keys should never be stored in Supabase tables or frontend files.
