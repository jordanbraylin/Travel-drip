# Travel-Drip Backend Architecture

This project now includes a production-oriented backend foundation for Supabase and Vercel serverless APIs.

For the launch-readiness view of scalability, data storage, backup, restore, load testing, monitoring, and reliability work, see `BACKEND_SCALABILITY_REPORT.md`.

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
- Corporate policy controls for business-trip types, role scopes, approved activity voting, per-diem allocations, corporate virtual cards, merchant/category/region limits, receipt requirements, expense approvals, reconciliation, and provider-backed mobile-wallet provisioning status
- Schedule, flights, hotels, transportation, ride-share connections, group/private chat rooms, message participants, reactions, shared media, reports, polls, and votes
- Cruise bookings, cabin assignments, port schedules, shore excursions, onboard activities, and dining reservations
- Reservation and paid excursion records, assigned attendees, reminder preferences, queued reminder notifications, smart departure payloads, and calendar sync status
- Daily memory reminder preferences, end-of-day prompt events, and organized memory items by trip/day/itinerary
- AI Travel Planner sessions, saved preference profiles, generated itinerary drafts, estimated costs, checklists, sharing state, deletion controls, and trip-conversion records
- Personal wallets, one shared Trip Virtual Wallet per eligible trip, trip wallet cards, group banks, contribution ledgers, wallet transactions, receipt scanning records, item claims, ride split participants, idempotency keys, and refund-ready audit data
- Important information, acknowledgments, documents, media, social connections, AI sessions, notifications, background jobs, saved places, and audit logs
- Operational readiness tables for scalability test runs, backup/restore evidence, data-retention policies, API performance events, and storage-processing jobs

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
- Corporate event codes are stored as salted hashes, must meet minimum strength rules, can require employee ID/email, last name, company domain, OTP/email verification, usage windows, rate limits, remembered-device policy, revocation, replacement, and full audit events.
- Corporate UI routes and workspace switching are gated before corporate schedules, documents, announcements, attendee details, budgets, or approved media render.

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

## Corporate Mode Requirements

Corporate Mode must be enforced by backend authorization, not only by the client UI. Every corporate record should be scoped by the relevant `organization_id`, `user_id`, `trip_id`, `event_id`, `employee_id`, `department_id`, `cost_center_id`, role, and permission scope. Production policies must prevent one organization from reading another organization's employees, trips, budgets, cards, votes, receipts, reimbursements, messages, documents, or audit logs.

Per-diem funds and corporate virtual cards require provider-backed ledgers and issuing controls before live use. Unused company funds should return to the corporate account during reconciliation unless the company has explicitly configured a reimbursement policy.
