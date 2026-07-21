-- TravelDrip production backend foundation.
-- Run this after supabase.sql in the Supabase SQL editor.
-- It is intentionally additive and rerunnable for the current project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text,
  avatar_url text,
  phone text,
  locale text not null default 'en-US',
  travel_preferences jsonb not null default '{}'::jsonb,
  notification_preferences jsonb not null default '{"push":true,"email":true,"sms":false,"in_app":true}'::jsonb
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text unique,
  logo_url text,
  brand_settings jsonb not null default '{}'::jsonb,
  billing_settings jsonb not null default '{}'::jsonb
);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','finance_admin','event_admin','manager','member','employee','vendor')),
  status text not null default 'active' check (status in ('active','invited','suspended','removed')),
  permissions jsonb not null default '{}'::jsonb,
  unique (organization_id, user_id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  trip_type text not null check (trip_type in (
    'solo_trip',
    'group_trip',
    'corporate_retreat',
    'wedding',
    'birthday',
    'family_reunion',
    'bachelor_bachelorette',
    'anniversary',
    'conference',
    'business_event',
    'special_event'
  )),
  title text not null,
  destination text not null,
  starts_on date,
  ends_on date,
  budget_cents bigint not null default 0 check (budget_cents >= 0),
  privacy text not null default 'invite_only' check (privacy in ('private','invite_only','approval_required','public_link')),
  status text not null default 'draft' check (status in ('draft','active','archived','cancelled')),
  settings jsonb not null default '{}'::jsonb
);

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  role text not null default 'traveler' check (role in (
    'owner','admin','organizer','finance_admin','team_lead','traveler','employee','guest','vendor'
  )),
  status text not null default 'active' check (status in ('active','invited','pending','removed','left')),
  permissions jsonb not null default '{}'::jsonb,
  privacy_settings jsonb not null default '{}'::jsonb,
  unique (trip_id, user_id)
);

drop trigger if exists set_trip_members_updated_at on public.trip_members;
create trigger set_trip_members_updated_at
before update on public.trip_members
for each row execute function public.set_updated_at();

create or replace function public.is_trip_member(trip_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = trip_uuid
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.has_trip_role(trip_uuid uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = trip_uuid
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_member(org_uuid uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_uuid
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (allowed_roles is null or om.role = any(allowed_roles))
  );
$$;

create table if not exists public.trip_feature_flags (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  flags jsonb not null default '{}'::jsonb
);

create table if not exists public.trip_modules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  settings jsonb not null default '{}'::jsonb,
  unique (trip_id, module_key)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_user_id uuid references auth.users(id) on delete set null,
  invitee_email text not null,
  invitee_name text,
  role text not null default 'traveler',
  delivery_methods text[] not null default array['email']::text[],
  status text not null default 'pending' check (status in ('pending','sent','delivered','opened','accepted','maybe','declined','cancelled','expired')),
  token text not null unique,
  expires_at timestamptz not null,
  responded_at timestamptz,
  customization jsonb not null default '{}'::jsonb
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','maybe','declined')),
  plus_one_count integer not null default 0 check (plus_one_count >= 0),
  meal_preference text,
  dietary_needs text,
  accessibility_needs text,
  transportation_needed boolean not null default false,
  hotel_needed boolean not null default false,
  flight_needed boolean not null default false,
  emergency_contact jsonb not null default '{}'::jsonb,
  waiver_signed_at timestamptz,
  unique (trip_id, user_id)
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  item_type text not null default 'activity',
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  location_address text,
  visibility text not null default 'members' check (visibility in ('private','members','employees','admins','public')),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  airline text,
  flight_number text,
  departure_airport text,
  arrival_airport text,
  departs_at timestamptz,
  arrives_at timestamptz,
  status text not null default 'scheduled',
  provider_ref text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  hotel_name text not null,
  address text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  confirmation_number text,
  visibility text not null default 'assigned_user' check (visibility in ('assigned_user','members','admins')),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.transportation_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider_name text,
  transportation_type text not null default 'ride_share',
  pickup_location text,
  dropoff_location text,
  pickup_at timestamptz,
  status text not null default 'planned',
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.ride_share_connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_ref text not null,
  encrypted_token_ref text,
  status text not null default 'connected',
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, provider)
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  room_type text not null default 'group',
  title text not null default 'Trip chat'
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  room_id uuid references public.chat_rooms(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  question text not null,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  settings jsonb not null default '{}'::jsonb
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (poll_id, user_id)
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  available_cents bigint not null default 0,
  reserved_cents bigint not null default 0,
  pending_refund_cents bigint not null default 0,
  completed_refund_cents bigint not null default 0,
  wallet_pin_hash text,
  biometric_enabled boolean not null default false,
  unique (user_id, currency)
);

create table if not exists public.group_banks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null unique references public.trips(id) on delete cascade,
  currency text not null default 'USD',
  total_collected_cents bigint not null default 0,
  available_cents bigint not null default 0,
  reserved_cents bigint not null default 0,
  spent_cents bigint not null default 0,
  settings jsonb not null default '{}'::jsonb
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid references public.trips(id) on delete set null,
  wallet_id uuid references public.wallets(id) on delete set null,
  group_bank_id uuid references public.group_banks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('deposit','allocation','payment','refund_request','refund_completed','transfer','adjustment')),
  amount_cents bigint not null,
  refundable_cents bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled','review_required')),
  provider text,
  provider_ref text,
  requires_pin boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  restaurant_name text,
  receipt_date timestamptz,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  tip_cents bigint not null default 0,
  service_fee_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  status text not null default 'draft',
  scan_metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  name text not null,
  quantity numeric(10,2) not null default 1,
  amount_cents bigint not null check (amount_cents >= 0),
  item_type text not null default 'food',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.item_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  receipt_item_id uuid not null references public.receipt_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_percent numeric(5,2) not null default 100 check (share_percent > 0 and share_percent <= 100),
  unique (receipt_item_id, user_id)
);

create table if not exists public.ride_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  provider_name text not null,
  pickup_location text,
  dropoff_location text,
  fare_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  toll_cents bigint not null default 0,
  booking_fee_cents bigint not null default 0,
  tip_cents bigint not null default 0,
  total_cents bigint not null default 0,
  split_mode text not null default 'equal',
  status text not null default 'shared',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ride_split_participants (
  id uuid primary key default gen_random_uuid(),
  ride_expense_id uuid not null references public.ride_expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null default 0,
  status text not null default 'pending',
  unique (ride_expense_id, user_id)
);

create table if not exists public.information_sections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  section_type text not null,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  requires_acknowledgment boolean not null default false,
  version integer not null default 1
);

create table if not exists public.acknowledgments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  information_section_id uuid not null references public.information_sections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  unique (information_section_id, user_id, version)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_bucket text not null default 'trip-documents',
  storage_path text not null,
  document_type text not null,
  visibility text not null default 'owner' check (visibility in ('owner','members','admins','employees')),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  storage_path text not null,
  media_type text not null,
  caption text,
  visibility text not null default 'members',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_ref text not null,
  encrypted_token_ref text,
  status text not null default 'connected',
  unique (user_id, provider)
);

create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_type text not null,
  prompt_context jsonb not null default '{}'::jsonb,
  last_message_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  channels text[] not null default array['in_app']::text[],
  status text not null default 'queued',
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  last_error text
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  category text not null,
  title text not null,
  location text,
  provider_ref text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_trip_members_user on public.trip_members(user_id);
create index if not exists idx_trip_members_trip on public.trip_members(trip_id);
create index if not exists idx_trips_owner on public.trips(owner_user_id);
create index if not exists idx_invitations_trip_status on public.invitations(trip_id, status);
create index if not exists idx_schedule_items_trip_time on public.schedule_items(trip_id, starts_at);
create index if not exists idx_wallet_transactions_user on public.wallet_transactions(user_id, created_at desc);
create index if not exists idx_wallet_transactions_trip on public.wallet_transactions(trip_id, created_at desc);
create index if not exists idx_audit_logs_trip on public.audit_logs(trip_id, created_at desc);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_feature_flags enable row level security;
alter table public.trip_modules enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.schedule_items enable row level security;
alter table public.flights enable row level security;
alter table public.hotels enable row level security;
alter table public.transportation_records enable row level security;
alter table public.ride_share_connections enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.wallets enable row level security;
alter table public.group_banks enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.item_claims enable row level security;
alter table public.ride_expenses enable row level security;
alter table public.ride_split_participants enable row level security;
alter table public.information_sections enable row level security;
alter table public.acknowledgments enable row level security;
alter table public.documents enable row level security;
alter table public.media enable row level security;
alter table public.social_connections enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.background_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.saved_places enable row level security;

drop policy if exists "Profiles are visible to owner" on public.profiles;
create policy "Profiles are visible to owner" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "Profiles are managed by owner" on public.profiles;
create policy "Profiles are managed by owner" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Organization members can read orgs" on public.organizations;
create policy "Organization members can read orgs" on public.organizations
  for select to authenticated using (public.is_org_member(id));

drop policy if exists "Organization owners can update orgs" on public.organizations;
create policy "Organization owners can update orgs" on public.organizations
  for update to authenticated using (public.is_org_member(id, array['owner','admin'])) with check (public.is_org_member(id, array['owner','admin']));

drop policy if exists "Members can read organization members" on public.organization_members;
create policy "Members can read organization members" on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage organization members" on public.organization_members;
create policy "Org admins manage organization members" on public.organization_members
  for all to authenticated using (public.is_org_member(organization_id, array['owner','admin'])) with check (public.is_org_member(organization_id, array['owner','admin']));

drop policy if exists "Users can create trips" on public.trips;
create policy "Users can create trips" on public.trips
  for insert to authenticated with check (owner_user_id = auth.uid());

drop policy if exists "Trip members can read trips" on public.trips;
create policy "Trip members can read trips" on public.trips
  for select to authenticated using (owner_user_id = auth.uid() or public.is_trip_member(id));

drop policy if exists "Trip admins can update trips" on public.trips;
create policy "Trip admins can update trips" on public.trips
  for update to authenticated using (owner_user_id = auth.uid() or public.has_trip_role(id, array['owner','admin','organizer'])) with check (owner_user_id = auth.uid() or public.has_trip_role(id, array['owner','admin','organizer']));

drop policy if exists "Trip members can read memberships" on public.trip_members;
create policy "Trip members can read memberships" on public.trip_members
  for select to authenticated using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists "Trip admins manage memberships" on public.trip_members;
create policy "Trip admins manage memberships" on public.trip_members
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']) or user_id = auth.uid());

drop policy if exists "Members read trip config" on public.trip_feature_flags;
create policy "Members read trip config" on public.trip_feature_flags
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage trip config" on public.trip_feature_flags;
create policy "Admins manage trip config" on public.trip_feature_flags
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read trip modules" on public.trip_modules;
create policy "Members read trip modules" on public.trip_modules
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage trip modules" on public.trip_modules;
create policy "Admins manage trip modules" on public.trip_modules
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Trip admins manage invitations" on public.invitations;
create policy "Trip admins manage invitations" on public.invitations
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Invitees read their invitation" on public.invitations;
create policy "Invitees read their invitation" on public.invitations
  for select to authenticated using (invitee_user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users manage own RSVP" on public.rsvps;
create policy "Users manage own RSVP" on public.rsvps
  for all to authenticated using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read schedule" on public.schedule_items;
create policy "Members read schedule" on public.schedule_items
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage schedule" on public.schedule_items;
create policy "Admins manage schedule" on public.schedule_items
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer','team_lead'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer','team_lead']));

drop policy if exists "Members read operational records" on public.flights;
create policy "Members read operational records" on public.flights
  for select to authenticated using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists "Admins manage operational records" on public.flights;
create policy "Admins manage operational records" on public.flights
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read hotels" on public.hotels;
create policy "Members read hotels" on public.hotels
  for select to authenticated using (user_id = auth.uid() or visibility = 'members' and public.is_trip_member(trip_id) or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Admins manage hotels" on public.hotels;
create policy "Admins manage hotels" on public.hotels
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read transportation" on public.transportation_records;
create policy "Members read transportation" on public.transportation_records
  for select to authenticated using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists "Admins manage transportation" on public.transportation_records;
create policy "Admins manage transportation" on public.transportation_records
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users manage own ride share connections" on public.ride_share_connections;
create policy "Users manage own ride share connections" on public.ride_share_connections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members read chat rooms" on public.chat_rooms;
create policy "Members read chat rooms" on public.chat_rooms
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages" on public.messages
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages" on public.messages
  for insert to authenticated with check (sender_user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Members read polls" on public.polls;
create policy "Members read polls" on public.polls
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Members create polls" on public.polls;
create policy "Members create polls" on public.polls
  for insert to authenticated with check (created_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Members read poll options" on public.poll_options;
create policy "Members read poll options" on public.poll_options
  for select to authenticated using (exists (select 1 from public.polls p where p.id = poll_id and public.is_trip_member(p.trip_id)));

drop policy if exists "Members vote polls" on public.poll_votes;
create policy "Members vote polls" on public.poll_votes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users read own wallets" on public.wallets;
create policy "Users read own wallets" on public.wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users update own wallet security" on public.wallets;
create policy "Users update own wallet security" on public.wallets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Finance reads group banks" on public.group_banks;
create policy "Finance reads group banks" on public.group_banks
  for select to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Users read own transactions" on public.wallet_transactions;
create policy "Users read own transactions" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Members read receipts" on public.receipts;
create policy "Members read receipts" on public.receipts
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Members create receipts" on public.receipts;
create policy "Members create receipts" on public.receipts
  for insert to authenticated with check (uploaded_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Members read receipt items" on public.receipt_items;
create policy "Members read receipt items" on public.receipt_items
  for select to authenticated using (exists (select 1 from public.receipts r where r.id = receipt_id and public.is_trip_member(r.trip_id)));

drop policy if exists "Users manage own item claims" on public.item_claims;
create policy "Users manage own item claims" on public.item_claims
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members read ride expenses" on public.ride_expenses;
create policy "Members read ride expenses" on public.ride_expenses
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Members create ride expenses" on public.ride_expenses;
create policy "Members create ride expenses" on public.ride_expenses
  for insert to authenticated with check (created_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Users read own ride split" on public.ride_split_participants;
create policy "Users read own ride split" on public.ride_split_participants
  for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.ride_expenses re where re.id = ride_expense_id and public.has_trip_role(re.trip_id, array['owner','admin','organizer','finance_admin'])));

drop policy if exists "Members read information" on public.information_sections;
create policy "Members read information" on public.information_sections
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage information" on public.information_sections;
create policy "Admins manage information" on public.information_sections
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users manage own acknowledgments" on public.acknowledgments;
create policy "Users manage own acknowledgments" on public.acknowledgments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members read documents" on public.documents;
create policy "Members read documents" on public.documents
  for select to authenticated using (user_id = auth.uid() or visibility in ('members','employees') and public.is_trip_member(trip_id) or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read media" on public.media;
create policy "Members read media" on public.media
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Users create own media" on public.media;
create policy "Users create own media" on public.media
  for insert to authenticated with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Users manage own social connections" on public.social_connections;
create policy "Users manage own social connections" on public.social_connections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own AI sessions" on public.ai_sessions;
create policy "Users manage own AI sessions" on public.ai_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users update own notification read state" on public.notifications;
create policy "Users update own notification read state" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Admins read background jobs" on public.background_jobs;
create policy "Admins read background jobs" on public.background_jobs
  for select to authenticated using (false);

drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs
  for select to authenticated using (
    actor_user_id = auth.uid()
    or (trip_id is not null and public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']))
    or (organization_id is not null and public.is_org_member(organization_id, array['owner','admin','finance_admin']))
  );

drop policy if exists "Users manage saved places" on public.saved_places;
create policy "Users manage saved places" on public.saved_places
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.corporate_access_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  code_hash text not null unique,
  code_hint text,
  code_type text not null default 'shared_event' check (code_type in ('shared_event','individual','department','team','vip','vendor','speaker')),
  assigned_role text not null default 'employee' check (assigned_role in ('employee','contractor','speaker','vendor','vip','guest')),
  assigned_attendee_id uuid,
  assigned_department text,
  assigned_team_id text,
  allowed_start_at timestamptz,
  allowed_end_at timestamptz,
  expires_at timestamptz not null,
  usage_limit integer not null default 0 check (usage_limit >= 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  requires_employee_id boolean not null default true,
  requires_email_verification boolean not null default false,
  requires_otp boolean not null default false,
  status text not null default 'active' check (status in ('active','expired','revoked','usage_limit_reached','locked')),
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_corporate_access_codes_updated_at on public.corporate_access_codes;
create trigger set_corporate_access_codes_updated_at
before update on public.corporate_access_codes
for each row execute function public.set_updated_at();

create table if not exists public.corporate_attendees (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  employee_id_hash text not null,
  employee_id_masked text not null,
  attendee_reference text not null,
  full_name text not null,
  last_name text not null,
  company_email text,
  department text,
  job_title text,
  manager_name text,
  role text not null default 'employee' check (role in ('employee','contractor','speaker','vendor','vip','guest')),
  access_status text not null default 'active' check (access_status in ('active','locked','revoked','pending','upgraded')),
  travel_record_id uuid,
  hotel_record_id uuid,
  transportation_record_id uuid,
  schedule_assignment_id uuid,
  accessibility_requirements text,
  dietary_preferences text,
  metadata jsonb not null default '{}'::jsonb,
  unique (trip_id, employee_id_hash)
);

drop trigger if exists set_corporate_attendees_updated_at on public.corporate_attendees;
create trigger set_corporate_attendees_updated_at
before update on public.corporate_attendees
for each row execute function public.set_updated_at();

alter table public.corporate_access_codes
  drop constraint if exists corporate_access_codes_assigned_attendee_fk;
alter table public.corporate_access_codes
  add constraint corporate_access_codes_assigned_attendee_fk
  foreign key (assigned_attendee_id) references public.corporate_attendees(id) on delete set null;

create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  attendee_id uuid not null references public.corporate_attendees(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  access_code_id uuid references public.corporate_access_codes(id) on delete set null,
  session_token_hash text not null unique,
  device_information jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at_ip_hash text,
  expires_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  revoked_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','revoked','ended','locked')),
  permissions jsonb not null default '{}'::jsonb
);

drop trigger if exists set_guest_sessions_updated_at on public.guest_sessions;
create trigger set_guest_sessions_updated_at
before update on public.guest_sessions
for each row execute function public.set_updated_at();

create table if not exists public.guest_access_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  attendee_id uuid references public.corporate_attendees(id) on delete set null,
  access_code_id uuid references public.corporate_access_codes(id) on delete set null,
  guest_session_id uuid references public.guest_sessions(id) on delete set null,
  action text not null,
  result text not null check (result in ('success','failed','blocked','revoked','expired')),
  risk_status text not null default 'normal' check (risk_status in ('normal','watch','suspicious','locked')),
  device_information jsonb not null default '{}'::jsonb,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_corporate_access_codes_trip on public.corporate_access_codes(trip_id, status);
create index if not exists idx_corporate_access_codes_hash on public.corporate_access_codes(code_hash);
create index if not exists idx_corporate_attendees_trip_hash on public.corporate_attendees(trip_id, employee_id_hash);
create index if not exists idx_guest_sessions_hash on public.guest_sessions(session_token_hash);
create index if not exists idx_guest_sessions_attendee on public.guest_sessions(attendee_id, status);
create index if not exists idx_guest_access_events_trip on public.guest_access_events(trip_id, created_at desc);

alter table public.corporate_access_codes enable row level security;
alter table public.corporate_attendees enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.guest_access_events enable row level security;

drop policy if exists "Corporate admins manage access codes" on public.corporate_access_codes;
create policy "Corporate admins manage access codes" on public.corporate_access_codes
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Corporate admins manage attendee records" on public.corporate_attendees;
create policy "Corporate admins manage attendee records" on public.corporate_attendees
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Linked users can read own attendee record" on public.corporate_attendees;
create policy "Linked users can read own attendee record" on public.corporate_attendees
  for select to authenticated
  using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Corporate admins read guest sessions" on public.guest_sessions;
create policy "Corporate admins read guest sessions" on public.guest_sessions
  for select to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Corporate admins read guest access events" on public.guest_access_events;
create policy "Corporate admins read guest access events" on public.guest_access_events
  for select to authenticated
  using (
    (trip_id is not null and public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']))
    or (organization_id is not null and public.is_org_member(organization_id, array['owner','admin','finance_admin']))
  );

alter table public.trips
  drop constraint if exists trips_trip_type_check;

alter table public.trips
  add constraint trips_trip_type_check check (trip_type in (
    'solo_trip',
    'group_trip',
    'corporate_retreat',
    'wedding',
    'birthday',
    'family_reunion',
    'bachelor_bachelorette',
    'anniversary',
    'conference',
    'business_event',
    'special_event',
    'cruise_vacation'
  ));

create table if not exists public.cruise_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null unique references public.trips(id) on delete cascade,
  cruise_line text not null,
  ship_name text not null,
  booking_confirmation text,
  sailing_date date,
  return_date date,
  departure_port text,
  arrival_port text,
  number_of_nights integer not null default 0 check (number_of_nights >= 0),
  departure_terminal text,
  boarding_time timestamptz,
  reservation_status text not null default 'planned',
  travel_agent jsonb not null default '{}'::jsonb,
  weather_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_cruise_bookings_updated_at on public.cruise_bookings;
create trigger set_cruise_bookings_updated_at
before update on public.cruise_bookings
for each row execute function public.set_updated_at();

create table if not exists public.cruise_cabins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  cabin_number text not null,
  deck_number text,
  cabin_category text,
  cabin_type text,
  location_notes text,
  occupants jsonb not null default '[]'::jsonb,
  special_accommodations text,
  cabin_notes text,
  visibility text not null default 'assigned_occupants' check (visibility in ('assigned_occupants','trip_admins','members')),
  unique (trip_id, cabin_number, user_id)
);

drop trigger if exists set_cruise_cabins_updated_at on public.cruise_cabins;
create trigger set_cruise_cabins_updated_at
before update on public.cruise_cabins
for each row execute function public.set_updated_at();

create table if not exists public.cruise_ports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  port_name text not null,
  country text,
  arrives_at timestamptz,
  departs_at timestamptz,
  local_time_zone text,
  weather_forecast jsonb not null default '{}'::jsonb,
  port_map_url text,
  customs_requirements text,
  emergency_contacts jsonb not null default '{}'::jsonb,
  currency text,
  local_transportation jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100
);

drop trigger if exists set_cruise_ports_updated_at on public.cruise_ports;
create trigger set_cruise_ports_updated_at
before update on public.cruise_ports
for each row execute function public.set_updated_at();

create table if not exists public.cruise_excursions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  port_id uuid references public.cruise_ports(id) on delete cascade,
  title text not null,
  description text,
  meeting_location text,
  starts_at timestamptz,
  ends_at timestamptz,
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'available' check (status in ('available','saved','joined','waitlist','cancelled','sold_out')),
  group_vote_enabled boolean not null default false,
  split_cost_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_cruise_excursions_updated_at on public.cruise_excursions;
create trigger set_cruise_excursions_updated_at
before update on public.cruise_excursions
for each row execute function public.set_updated_at();

create table if not exists public.cruise_onboard_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  activity_type text not null default 'activity',
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  reservation_status text not null default 'open',
  dress_code text,
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_cruise_onboard_activities_updated_at on public.cruise_onboard_activities;
create trigger set_cruise_onboard_activities_updated_at
before update on public.cruise_onboard_activities
for each row execute function public.set_updated_at();

create table if not exists public.cruise_dining_reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  restaurant_name text not null,
  dining_type text not null default 'main_dining',
  reservation_at timestamptz,
  confirmation_number text,
  dress_code text,
  party_size integer not null default 1 check (party_size > 0),
  status text not null default 'confirmed',
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_cruise_dining_reservations_updated_at on public.cruise_dining_reservations;
create trigger set_cruise_dining_reservations_updated_at
before update on public.cruise_dining_reservations
for each row execute function public.set_updated_at();

create index if not exists idx_cruise_ports_trip_order on public.cruise_ports(trip_id, sort_order);
create index if not exists idx_cruise_excursions_trip_port on public.cruise_excursions(trip_id, port_id);
create index if not exists idx_cruise_activities_trip_time on public.cruise_onboard_activities(trip_id, starts_at);
create index if not exists idx_cruise_dining_trip_time on public.cruise_dining_reservations(trip_id, reservation_at);

alter table public.cruise_bookings enable row level security;
alter table public.cruise_cabins enable row level security;
alter table public.cruise_ports enable row level security;
alter table public.cruise_excursions enable row level security;
alter table public.cruise_onboard_activities enable row level security;
alter table public.cruise_dining_reservations enable row level security;

drop policy if exists "Members read cruise bookings" on public.cruise_bookings;
create policy "Members read cruise bookings" on public.cruise_bookings
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage cruise bookings" on public.cruise_bookings;
create policy "Admins manage cruise bookings" on public.cruise_bookings
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Travelers read assigned cruise cabins" on public.cruise_cabins;
create policy "Travelers read assigned cruise cabins" on public.cruise_cabins
  for select to authenticated using (user_id = auth.uid() or visibility = 'members' and public.is_trip_member(trip_id) or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Admins manage cruise cabins" on public.cruise_cabins;
create policy "Admins manage cruise cabins" on public.cruise_cabins
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read cruise ports" on public.cruise_ports;
create policy "Members read cruise ports" on public.cruise_ports
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage cruise ports" on public.cruise_ports;
create policy "Admins manage cruise ports" on public.cruise_ports
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read cruise excursions" on public.cruise_excursions;
create policy "Members read cruise excursions" on public.cruise_excursions
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage cruise excursions" on public.cruise_excursions;
create policy "Admins manage cruise excursions" on public.cruise_excursions
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read cruise onboard activities" on public.cruise_onboard_activities;
create policy "Members read cruise onboard activities" on public.cruise_onboard_activities
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage cruise onboard activities" on public.cruise_onboard_activities;
create policy "Admins manage cruise onboard activities" on public.cruise_onboard_activities
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Members read cruise dining" on public.cruise_dining_reservations;
create policy "Members read cruise dining" on public.cruise_dining_reservations
  for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage cruise dining" on public.cruise_dining_reservations;
create policy "Admins manage cruise dining" on public.cruise_dining_reservations
  for all to authenticated using (public.has_trip_role(trip_id, array['owner','admin','organizer'])) with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));
