-- Travel-Drip event-planning production tables.
-- Run after supabase.sql and supabase-backend.sql.
-- The existing public.trips row remains the canonical event shell for compatibility.

create extension if not exists pgcrypto;

alter table public.trips drop constraint if exists trips_trip_type_check;
alter table public.trips add constraint trips_trip_type_check check (trip_type in (
  'solo_trip',
  'group_trip',
  'corporate_retreat',
  'wedding',
  'birthday',
  'family_reunion',
  'bachelor_bachelorette',
  'anniversary',
  'conference',
  'graduation_trip',
  'church_retreat',
  'business_event',
  'special_event',
  'cruise_vacation'
));

create table if not exists public.events (
  id uuid primary key references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_type text not null check (event_type in (
    'wedding',
    'birthday',
    'anniversary',
    'family_reunion',
    'conference',
    'graduation_trip',
    'church_retreat',
    'corporate_retreat',
    'bachelor_bachelorette',
    'business_event',
    'special_event'
  )),
  title text not null,
  description text,
  destination text not null,
  host_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  guest_count integer not null default 0 check (guest_count >= 0),
  rsvp_deadline date,
  currency text not null default 'USD',
  budget_cents bigint not null default 0 check (budget_cents >= 0),
  starts_on date,
  ends_on date,
  privacy text not null default 'invite_only',
  status text not null default 'draft' check (status in ('draft','active','published','archived','completed','cancelled')),
  travel_required boolean not null default false,
  hotel_required boolean not null default false,
  transportation_required boolean not null default false,
  event_details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'guest' check (role in ('owner','host','organizer','finance_admin','event_admin','speaker','vendor','guest','attendee','employee')),
  status text not null default 'active' check (status in ('active','invited','pending','removed','left')),
  permissions jsonb not null default '{}'::jsonb,
  unique (event_id, user_id)
);

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  guest_group text,
  party_size integer not null default 1 check (party_size >= 0),
  role text not null default 'guest',
  status text not null default 'pending',
  travel_required boolean not null default false,
  hotel_required boolean not null default false,
  transportation_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid references public.event_guests(id) on delete cascade,
  inviter_user_id uuid references auth.users(id) on delete set null,
  invitee_email text,
  token_hash text not null unique,
  delivery_methods text[] not null default array['email']::text[],
  status text not null default 'pending' check (status in ('pending','sent','delivered','opened','accepted','maybe','declined','cancelled','expired')),
  expires_at timestamptz not null,
  responded_at timestamptz,
  customization jsonb not null default '{}'::jsonb
);

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid references public.event_guests(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','maybe','declined')),
  plus_one_count integer not null default 0 check (plus_one_count >= 0),
  meal_preference text,
  dietary_needs text,
  accessibility_needs text,
  emergency_contact jsonb not null default '{}'::jsonb,
  unique (event_id, guest_id),
  unique (event_id, user_id)
);

create table if not exists public.event_schedules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  schedule_type text not null default 'activity',
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  location_address text,
  visibility text not null default 'guests',
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  schedule_id uuid references public.event_schedules(id) on delete set null,
  title text not null,
  activity_type text not null default 'activity',
  capacity integer,
  cost_cents bigint not null default 0,
  status text not null default 'planned',
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  question text not null,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  settings jsonb not null default '{}'::jsonb
);

create table if not exists public.event_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.event_polls(id) on delete cascade,
  label text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  poll_id uuid not null references public.event_polls(id) on delete cascade,
  option_id uuid not null references public.event_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (poll_id, user_id)
);

create table if not exists public.event_flights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid references public.event_guests(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  airline text,
  flight_number text,
  departure_airport text,
  arrival_airport text,
  departs_at timestamptz,
  arrives_at timestamptz,
  status text not null default 'manual',
  provider_ref text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_hotels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  hotel_name text not null,
  address text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  room_block_name text,
  provider_ref text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  hotel_id uuid references public.event_hotels(id) on delete cascade,
  guest_id uuid references public.event_guests(id) on delete set null,
  room_label text,
  status text not null default 'assigned',
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_transportation (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  transportation_type text not null default 'shuttle',
  provider_name text,
  passenger_group text,
  pickup_location text,
  dropoff_location text,
  pickup_at timestamptz,
  status text not null default 'planned',
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.event_wallets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  currency text not null default 'USD',
  available_cents bigint not null default 0,
  reserved_cents bigint not null default 0,
  spent_cents bigint not null default 0,
  pending_refund_cents bigint not null default 0,
  status text not null default 'provider_required',
  provider text,
  provider_wallet_ref text,
  settings jsonb not null default '{}'::jsonb
);

create table if not exists public.event_contributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  wallet_id uuid references public.event_wallets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_id uuid references public.event_guests(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending',
  refundable_cents bigint not null default 0,
  provider_ref text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  unique (event_id, idempotency_key)
);

create table if not exists public.event_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  wallet_id uuid references public.event_wallets(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  transaction_type text not null,
  amount_cents bigint not null,
  status text not null default 'pending',
  provider_ref text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_refunds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  contribution_id uuid references public.event_contributions(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'requested',
  provider_ref text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  pinned boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  attachments jsonb not null default '[]'::jsonb
);

create table if not exists public.event_message_reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid not null references public.event_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  unique (message_id, user_id, reaction)
);

create table if not exists public.event_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_bucket text not null default 'event-documents',
  storage_path text not null,
  document_type text not null,
  visibility text not null default 'organizers',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_bucket text not null default 'event-media',
  storage_path text not null,
  media_type text not null,
  caption text,
  visibility text not null default 'guests',
  approval_status text not null default 'approved',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  channels text[] not null default array['in_app']::text[],
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.event_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid references public.events(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_events_type_status on public.events(event_type, status);
create index if not exists idx_event_members_user on public.event_members(user_id, event_id);
create index if not exists idx_event_guests_event_status on public.event_guests(event_id, status);
create index if not exists idx_event_invitations_event_status on public.event_invitations(event_id, status);
create index if not exists idx_event_schedules_event_time on public.event_schedules(event_id, starts_at);
create index if not exists idx_event_wallets_event on public.event_wallets(event_id, status);
create index if not exists idx_event_notifications_user on public.event_notifications(user_id, created_at desc);
create index if not exists idx_event_audit_logs_event on public.event_audit_logs(event_id, created_at desc);

alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_guests enable row level security;
alter table public.event_invitations enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_schedules enable row level security;
alter table public.event_activities enable row level security;
alter table public.event_polls enable row level security;
alter table public.event_poll_options enable row level security;
alter table public.event_votes enable row level security;
alter table public.event_flights enable row level security;
alter table public.event_hotels enable row level security;
alter table public.event_rooms enable row level security;
alter table public.event_transportation enable row level security;
alter table public.event_wallets enable row level security;
alter table public.event_contributions enable row level security;
alter table public.event_transactions enable row level security;
alter table public.event_refunds enable row level security;
alter table public.event_messages enable row level security;
alter table public.event_message_reactions enable row level security;
alter table public.event_documents enable row level security;
alter table public.event_media enable row level security;
alter table public.event_notifications enable row level security;
alter table public.event_audit_logs enable row level security;

create or replace function public.is_event_member(event_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_members em
    where em.event_id = event_uuid
      and em.user_id = auth.uid()
      and em.status = 'active'
  );
$$;

create or replace function public.has_event_role(event_uuid uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_members em
    where em.event_id = event_uuid
      and em.user_id = auth.uid()
      and em.status = 'active'
      and em.role = any(allowed_roles)
  );
$$;

drop policy if exists "Event members read events" on public.events;
create policy "Event members read events" on public.events
  for select to authenticated using (public.is_event_member(id));

drop policy if exists "Hosts manage events" on public.events;
create policy "Hosts manage events" on public.events
  for all to authenticated using (public.has_event_role(id, array['owner','host','organizer','event_admin']))
  with check (public.has_event_role(id, array['owner','host','organizer','event_admin']));

drop policy if exists "Event members read membership" on public.event_members;
create policy "Event members read membership" on public.event_members
  for select to authenticated using (public.is_event_member(event_id));

drop policy if exists "Hosts manage event membership" on public.event_members;
create policy "Hosts manage event membership" on public.event_members
  for all to authenticated using (public.has_event_role(event_id, array['owner','host','organizer','event_admin']))
  with check (public.has_event_role(event_id, array['owner','host','organizer','event_admin']));

drop policy if exists "Event members read guest operations" on public.event_guests;
create policy "Event members read guest operations" on public.event_guests
  for select to authenticated using (public.is_event_member(event_id));

drop policy if exists "Hosts manage guest operations" on public.event_guests;
create policy "Hosts manage guest operations" on public.event_guests
  for all to authenticated using (public.has_event_role(event_id, array['owner','host','organizer','event_admin']))
  with check (public.has_event_role(event_id, array['owner','host','organizer','event_admin']));

drop policy if exists "Event members read event records" on public.event_schedules;
create policy "Event members read event records" on public.event_schedules
  for select to authenticated using (public.is_event_member(event_id));

drop policy if exists "Hosts manage event records" on public.event_schedules;
create policy "Hosts manage event records" on public.event_schedules
  for all to authenticated using (public.has_event_role(event_id, array['owner','host','organizer','event_admin']))
  with check (public.has_event_role(event_id, array['owner','host','organizer','event_admin']));

-- Apply the same member/host access model to related event tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'event_invitations','event_rsvps','event_activities','event_polls','event_flights','event_hotels','event_rooms',
    'event_transportation','event_wallets','event_contributions','event_transactions','event_refunds','event_messages',
    'event_documents','event_media','event_notifications','event_audit_logs'
  ]
  loop
    execute format('drop policy if exists "Event members read %1$s" on public.%1$s', table_name);
    execute format('create policy "Event members read %1$s" on public.%1$s for select to authenticated using (public.is_event_member(event_id))', table_name);
    execute format('drop policy if exists "Hosts manage %1$s" on public.%1$s', table_name);
    execute format('create policy "Hosts manage %1$s" on public.%1$s for all to authenticated using (public.has_event_role(event_id, array[''owner'',''host'',''organizer'',''event_admin'',''finance_admin''])) with check (public.has_event_role(event_id, array[''owner'',''host'',''organizer'',''event_admin'',''finance_admin'']))', table_name);
  end loop;
end $$;

drop policy if exists "Event members read poll options" on public.event_poll_options;
create policy "Event members read poll options" on public.event_poll_options
  for select to authenticated using (
    exists (select 1 from public.event_polls p where p.id = poll_id and public.is_event_member(p.event_id))
  );

drop policy if exists "Hosts manage poll options" on public.event_poll_options;
create policy "Hosts manage poll options" on public.event_poll_options
  for all to authenticated using (
    exists (select 1 from public.event_polls p where p.id = poll_id and public.has_event_role(p.event_id, array['owner','host','organizer','event_admin']))
  ) with check (
    exists (select 1 from public.event_polls p where p.id = poll_id and public.has_event_role(p.event_id, array['owner','host','organizer','event_admin']))
  );

drop policy if exists "Event members read votes" on public.event_votes;
create policy "Event members read votes" on public.event_votes
  for select to authenticated using (
    exists (select 1 from public.event_polls p where p.id = poll_id and public.is_event_member(p.event_id))
  );

drop policy if exists "Event members cast votes" on public.event_votes;
create policy "Event members cast votes" on public.event_votes
  for all to authenticated using (
    user_id = auth.uid() and exists (select 1 from public.event_polls p where p.id = poll_id and public.is_event_member(p.event_id))
  ) with check (
    user_id = auth.uid() and exists (select 1 from public.event_polls p where p.id = poll_id and public.is_event_member(p.event_id))
  );

drop policy if exists "Event members read message reactions" on public.event_message_reactions;
create policy "Event members read message reactions" on public.event_message_reactions
  for select to authenticated using (
    exists (select 1 from public.event_messages m where m.id = message_id and public.is_event_member(m.event_id))
  );

drop policy if exists "Event members manage own message reactions" on public.event_message_reactions;
create policy "Event members manage own message reactions" on public.event_message_reactions
  for all to authenticated using (
    user_id = auth.uid() and exists (select 1 from public.event_messages m where m.id = message_id and public.is_event_member(m.event_id))
  ) with check (
    user_id = auth.uid() and exists (select 1 from public.event_messages m where m.id = message_id and public.is_event_member(m.event_id))
  );
