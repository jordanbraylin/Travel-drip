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
  requires_last_name boolean not null default true,
  requires_company_domain boolean not null default false,
  company_domain text,
  remember_device_allowed boolean not null default false,
  minimum_code_length integer not null default 8 check (minimum_code_length >= 8),
  max_failed_attempts integer not null default 5 check (max_failed_attempts >= 1),
  failed_attempt_count integer not null default 0 check (failed_attempt_count >= 0),
  locked_until timestamptz,
  requires_email_verification boolean not null default false,
  requires_otp boolean not null default false,
  status text not null default 'active' check (status in ('active','expired','revoked','usage_limit_reached','locked')),
  created_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  replaced_by_code_id uuid references public.corporate_access_codes(id) on delete set null,
  replaced_at timestamptz,
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
  last_revalidated_at timestamptz,
  remembered_device boolean not null default false,
  event_access_scope text not null default 'single_event' check (event_access_scope in ('single_event','multi_event','personal_only')),
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
create index if not exists idx_corporate_access_codes_locked_until on public.corporate_access_codes(locked_until);
create index if not exists idx_corporate_attendees_trip_hash on public.corporate_attendees(trip_id, employee_id_hash);
create index if not exists idx_guest_sessions_hash on public.guest_sessions(session_token_hash);
create index if not exists idx_guest_sessions_attendee on public.guest_sessions(attendee_id, status);
create index if not exists idx_guest_sessions_trip_status_expires on public.guest_sessions(trip_id, status, expires_at);
create index if not exists idx_guest_access_events_trip on public.guest_access_events(trip_id, created_at desc);

alter table public.corporate_access_codes
  add column if not exists requires_last_name boolean not null default true,
  add column if not exists requires_company_domain boolean not null default false,
  add column if not exists company_domain text,
  add column if not exists remember_device_allowed boolean not null default false,
  add column if not exists minimum_code_length integer not null default 8,
  add column if not exists max_failed_attempts integer not null default 5,
  add column if not exists failed_attempt_count integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists replaced_by_code_id uuid references public.corporate_access_codes(id) on delete set null,
  add column if not exists replaced_at timestamptz;

alter table public.guest_sessions
  add column if not exists last_revalidated_at timestamptz,
  add column if not exists remembered_device boolean not null default false,
  add column if not exists event_access_scope text not null default 'single_event';

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

create table if not exists public.daily_memory_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_reminders_enabled boolean not null default true,
  reminder_time time not null default '21:00',
  followup_reminders_enabled boolean not null default true,
  auto_organize_by_itinerary boolean not null default true,
  automatic_ai_captions boolean not null default true,
  automatic_ai_daily_journals boolean not null default true,
  social_share_prompts boolean not null default false,
  default_visibility text not null default 'private' check (default_visibility in ('private','trip_members','friends','shared_album','company_only','public_profile')),
  shared_album_requires_approval boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (trip_id, user_id)
);

drop trigger if exists set_daily_memory_preferences_updated_at on public.daily_memory_preferences;
create trigger set_daily_memory_preferences_updated_at
before update on public.daily_memory_preferences
for each row execute function public.set_updated_at();

create table if not exists public.daily_memory_prompts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_day integer not null check (trip_day > 0),
  destination text,
  prompt_type text not null default 'end_of_day' check (prompt_type in ('end_of_day','after_final_activity','morning_followup')),
  trigger_source text not null default 'itinerary_completed',
  scheduled_for timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  skipped_at timestamptz,
  status text not null default 'queued' check (status in ('queued','sent','opened','skipped','dismissed','completed','disabled')),
  completed_activity_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_daily_memory_prompts_updated_at on public.daily_memory_prompts;
create trigger set_daily_memory_prompts_updated_at
before update on public.daily_memory_prompts
for each row execute function public.set_updated_at();

create table if not exists public.daily_memory_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id uuid references public.daily_memory_prompts(id) on delete set null,
  trip_day integer not null check (trip_day > 0),
  itinerary_item_id uuid references public.schedule_items(id) on delete set null,
  media_id uuid references public.media(id) on delete set null,
  memory_type text not null check (memory_type in ('photo','video','journal','note','highlight_reel','caption')),
  title text,
  body text,
  location_name text,
  captured_at timestamptz,
  destination text,
  visibility text not null default 'private' check (visibility in ('private','trip_members','friends','shared_album','company_only','public_profile')),
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  ai_summary text,
  ai_caption text,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_daily_memory_items_updated_at on public.daily_memory_items;
create trigger set_daily_memory_items_updated_at
before update on public.daily_memory_items
for each row execute function public.set_updated_at();

create index if not exists idx_daily_memory_preferences_user on public.daily_memory_preferences(user_id, trip_id);
create index if not exists idx_daily_memory_prompts_user_status on public.daily_memory_prompts(user_id, status, scheduled_for);
create index if not exists idx_daily_memory_items_trip_day on public.daily_memory_items(trip_id, trip_day);
create index if not exists idx_daily_memory_items_user on public.daily_memory_items(user_id, created_at desc);

alter table public.daily_memory_preferences enable row level security;
alter table public.daily_memory_prompts enable row level security;
alter table public.daily_memory_items enable row level security;

drop policy if exists "Users manage own daily memory preferences" on public.daily_memory_preferences;
create policy "Users manage own daily memory preferences" on public.daily_memory_preferences
  for all to authenticated
  using (user_id = auth.uid() and (trip_id is null or public.is_trip_member(trip_id)))
  with check (user_id = auth.uid() and (trip_id is null or public.is_trip_member(trip_id)));

drop policy if exists "Users read own daily memory prompts" on public.daily_memory_prompts;
create policy "Users read own daily memory prompts" on public.daily_memory_prompts
  for select to authenticated
  using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users update own daily memory prompts" on public.daily_memory_prompts;
create policy "Users update own daily memory prompts" on public.daily_memory_prompts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users create own daily memory items" on public.daily_memory_items;
create policy "Users create own daily memory items" on public.daily_memory_items
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Users read visible daily memory items" on public.daily_memory_items;
create policy "Users read visible daily memory items" on public.daily_memory_items
  for select to authenticated
  using (
    user_id = auth.uid()
    or (visibility in ('trip_members','shared_album','company_only') and public.is_trip_member(trip_id))
    or public.has_trip_role(trip_id, array['owner','admin','organizer'])
  );

drop policy if exists "Users manage own daily memory items" on public.daily_memory_items;
create policy "Users manage own daily memory items" on public.daily_memory_items
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.reservation_reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_reminders_enabled boolean not null default true,
  paid_excursion_reminders_enabled boolean not null default true,
  cruise_activity_reminders_enabled boolean not null default true,
  corporate_assignment_reminders_enabled boolean not null default true,
  smart_departure_alerts_enabled boolean not null default true,
  reminder_offsets text[] not null default array['24h','2h','30m','departure']::text[],
  arrival_only boolean not null default false,
  calendar_sync jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (trip_id, user_id)
);

drop trigger if exists set_reservation_reminder_preferences_updated_at on public.reservation_reminder_preferences;
create trigger set_reservation_reminder_preferences_updated_at
before update on public.reservation_reminder_preferences
for each row execute function public.set_updated_at();

create table if not exists public.reservation_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  reservation_type text not null check (reservation_type in ('restaurant','paid_excursion','cruise_activity','corporate_assignment','transportation','ticketed_event','spa','show','dining')),
  title text not null,
  provider_name text,
  confirmation_number text,
  status text not null default 'confirmed' check (status in ('draft','confirmed','updated','cancelled','completed')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_location text,
  venue_name text,
  venue_contact text,
  address text,
  check_in_closes_at timestamptz,
  paid boolean not null default false,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  currency text not null default 'USD',
  reservation_source text not null default 'manual' check (reservation_source in ('manual','opentable','partner','cruise_line','corporate_admin','imported')),
  travel_time_minutes integer check (travel_time_minutes is null or travel_time_minutes >= 0),
  departure_at timestamptz,
  special_instructions text,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_reservation_records_updated_at on public.reservation_records;
create trigger set_reservation_records_updated_at
before update on public.reservation_records
for each row execute function public.set_updated_at();

create table if not exists public.reservation_attendees (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reservation_id uuid not null references public.reservation_records(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attendee_role text not null default 'attendee' check (attendee_role in ('attendee','organizer','employee','finance_admin','guest')),
  attendance_status text not null default 'assigned' check (attendance_status in ('assigned','accepted','maybe','declined','checked_in','cancelled')),
  notification_enabled boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (reservation_id, user_id)
);

create table if not exists public.reservation_reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reservation_id uuid not null references public.reservation_records(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('confirmation','24h','12h','2h','1h','30m','departure','arrival')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  opened_at timestamptz,
  status text not null default 'queued' check (status in ('queued','sent','opened','skipped','failed','disabled')),
  channels text[] not null default array['push','in_app']::text[],
  action_payload jsonb not null default '{}'::jsonb,
  ai_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_reservation_reminders_updated_at on public.reservation_reminders;
create trigger set_reservation_reminders_updated_at
before update on public.reservation_reminders
for each row execute function public.set_updated_at();

create table if not exists public.reservation_calendar_syncs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reservation_id uuid not null references public.reservation_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple','google','outlook')),
  provider_event_id text,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','updated','failed','revoked')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (reservation_id, user_id, provider)
);

drop trigger if exists set_reservation_calendar_syncs_updated_at on public.reservation_calendar_syncs;
create trigger set_reservation_calendar_syncs_updated_at
before update on public.reservation_calendar_syncs
for each row execute function public.set_updated_at();

create index if not exists idx_reservation_reminder_preferences_user on public.reservation_reminder_preferences(user_id, trip_id);
create index if not exists idx_reservation_records_trip_start on public.reservation_records(trip_id, starts_at);
create index if not exists idx_reservation_records_type on public.reservation_records(reservation_type, status);
create index if not exists idx_reservation_attendees_user on public.reservation_attendees(user_id, trip_id);
create index if not exists idx_reservation_attendees_reservation on public.reservation_attendees(reservation_id);
create index if not exists idx_reservation_reminders_queue on public.reservation_reminders(status, scheduled_for);
create index if not exists idx_reservation_reminders_user on public.reservation_reminders(user_id, scheduled_for);
create index if not exists idx_reservation_calendar_syncs_user on public.reservation_calendar_syncs(user_id, provider);

alter table public.reservation_reminder_preferences enable row level security;
alter table public.reservation_records enable row level security;
alter table public.reservation_attendees enable row level security;
alter table public.reservation_reminders enable row level security;
alter table public.reservation_calendar_syncs enable row level security;

drop policy if exists "Users manage own reservation reminder preferences" on public.reservation_reminder_preferences;
create policy "Users manage own reservation reminder preferences" on public.reservation_reminder_preferences
  for all to authenticated
  using (user_id = auth.uid() and (trip_id is null or public.is_trip_member(trip_id)))
  with check (user_id = auth.uid() and (trip_id is null or public.is_trip_member(trip_id)));

drop policy if exists "Members read reservation records" on public.reservation_records;
create policy "Members read reservation records" on public.reservation_records
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "Admins manage reservation records" on public.reservation_records;
create policy "Admins manage reservation records" on public.reservation_records
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users read assigned reservation attendees" on public.reservation_attendees;
create policy "Users read assigned reservation attendees" on public.reservation_attendees
  for select to authenticated
  using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Admins manage reservation attendees" on public.reservation_attendees;
create policy "Admins manage reservation attendees" on public.reservation_attendees
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users read own reservation reminders" on public.reservation_reminders;
create policy "Users read own reservation reminders" on public.reservation_reminders
  for select to authenticated
  using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users update own reservation reminders" on public.reservation_reminders;
create policy "Users update own reservation reminders" on public.reservation_reminders
  for update to authenticated
  using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']))
  with check (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users manage own reservation calendar syncs" on public.reservation_calendar_syncs;
create policy "Users manage own reservation calendar syncs" on public.reservation_calendar_syncs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.chat_rooms add column if not exists updated_at timestamptz not null default now();
alter table public.chat_rooms add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.chat_rooms add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.chat_rooms add column if not exists description text;
alter table public.chat_rooms add column if not exists room_visibility text not null default 'trip_members' check (room_visibility in ('solo_private','trip_members','team','announcement_read_only','admin_only','finance_only','vendors','event_staff','custom'));
alter table public.chat_rooms add column if not exists is_read_only boolean not null default false;
alter table public.chat_rooms add column if not exists is_archived boolean not null default false;
alter table public.chat_rooms add column if not exists last_message_at timestamptz;
alter table public.chat_rooms add column if not exists metadata jsonb not null default '{}'::jsonb;

drop trigger if exists set_chat_rooms_updated_at on public.chat_rooms;
create trigger set_chat_rooms_updated_at
before update on public.chat_rooms
for each row execute function public.set_updated_at();

alter table public.messages add column if not exists updated_at timestamptz not null default now();
alter table public.messages add column if not exists parent_message_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists message_type text not null default 'text' check (message_type in ('text','photo','video','voice','file','location','poll','itinerary_card','payment_request','ai','system'));
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists pinned_at timestamptz;
alter table public.messages add column if not exists pinned_by uuid references auth.users(id) on delete set null;
alter table public.messages add column if not exists metadata jsonb not null default '{}'::jsonb;

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

create table if not exists public.chat_room_participants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null default 'member' check (participant_role in ('owner','admin','organizer','member','employee','finance','vendor','guest','ai')),
  notification_level text not null default 'all' check (notification_level in ('all','mentions','muted','none')),
  can_send_messages boolean not null default true,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz,
  is_blocked boolean not null default false,
  is_archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (room_id, user_id)
);

drop trigger if exists set_chat_room_participants_updated_at on public.chat_room_participants;
create trigger set_chat_room_participants_updated_at
before update on public.chat_room_participants
for each row execute function public.set_updated_at();

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  unique (message_id, user_id, reaction)
);

create table if not exists public.message_shared_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  shared_type text not null check (shared_type in ('photo','video','file','link','location','poll','itinerary_item','payment_request','ride_share','reservation')),
  title text,
  url text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewing','action_taken','dismissed')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_chat_rooms_trip_type on public.chat_rooms(trip_id, room_type, room_visibility);
create index if not exists idx_chat_rooms_last_message on public.chat_rooms(last_message_at desc);
create index if not exists idx_messages_room_created on public.messages(room_id, created_at desc);
create index if not exists idx_messages_sender on public.messages(sender_user_id, created_at desc);
create index if not exists idx_chat_room_participants_user on public.chat_room_participants(user_id, notification_level);
create index if not exists idx_message_shared_items_room on public.message_shared_items(room_id, shared_type, created_at desc);
create index if not exists idx_message_reports_status on public.message_reports(status, created_at desc);

alter table public.chat_room_participants enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_shared_items enable row level security;
alter table public.message_reports enable row level security;

drop policy if exists "Users read rooms they participate in" on public.chat_rooms;
create policy "Users read rooms they participate in" on public.chat_rooms
  for select to authenticated
  using (
    public.is_trip_member(trip_id)
    or exists (
      select 1 from public.chat_room_participants crp
      where crp.room_id = chat_rooms.id and crp.user_id = auth.uid() and crp.is_blocked = false
    )
    or public.has_trip_role(trip_id, array['owner','admin','organizer','finance'])
  );

drop policy if exists "Admins manage expanded chat rooms" on public.chat_rooms;
create policy "Admins manage expanded chat rooms" on public.chat_rooms
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Users manage own chat participation" on public.chat_room_participants;
create policy "Users manage own chat participation" on public.chat_room_participants
  for all to authenticated
  using (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']))
  with check (user_id = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer']));

drop policy if exists "Participants add message reactions" on public.message_reactions;
create policy "Participants add message reactions" on public.message_reactions
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.chat_room_participants crp where crp.room_id = message_reactions.room_id and crp.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.chat_room_participants crp where crp.room_id = message_reactions.room_id and crp.user_id = auth.uid() and crp.is_blocked = false)
  );

drop policy if exists "Participants read shared message items" on public.message_shared_items;
create policy "Participants read shared message items" on public.message_shared_items
  for select to authenticated
  using (
    public.is_trip_member(trip_id)
    or exists (select 1 from public.chat_room_participants crp where crp.room_id = message_shared_items.room_id and crp.user_id = auth.uid() and crp.is_blocked = false)
  );

drop policy if exists "Participants create shared message items" on public.message_shared_items;
create policy "Participants create shared message items" on public.message_shared_items
  for insert to authenticated
  with check (
    exists (select 1 from public.chat_room_participants crp where crp.room_id = message_shared_items.room_id and crp.user_id = auth.uid() and crp.can_send_messages = true and crp.is_blocked = false)
    or public.has_trip_role(trip_id, array['owner','admin','organizer'])
  );

drop policy if exists "Users create message reports" on public.message_reports;
create policy "Users create message reports" on public.message_reports
  for insert to authenticated
  with check (reporter_user_id = auth.uid());

drop policy if exists "Admins read message reports" on public.message_reports;
create policy "Admins read message reports" on public.message_reports
  for select to authenticated
  using (reporter_user_id = auth.uid() or public.has_trip_role((select cr.trip_id from public.chat_rooms cr where cr.id = message_reports.room_id), array['owner','admin','organizer']));

alter table public.profiles add column if not exists avatar_storage_path text;
alter table public.profiles add column if not exists avatar_thumb_url text;
alter table public.profiles add column if not exists avatar_visibility text not null default 'trip_members' check (avatar_visibility in ('public','friends','trip_members','organization','private'));
alter table public.profiles add column if not exists avatar_source text not null default 'user_upload' check (avatar_source in ('user_upload','camera','company_directory','company_issued','default_initials'));
alter table public.profiles add column if not exists avatar_moderation_status text not null default 'not_required' check (avatar_moderation_status in ('not_required','pending','approved','rejected','flagged'));
alter table public.profiles add column if not exists avatar_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.profile_photo_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text,
  original_filename text,
  mime_type text not null check (mime_type in ('image/jpeg','image/jpg','image/png','image/heic','image/webp')),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  width integer,
  height integer,
  crop_settings jsonb not null default '{}'::jsonb,
  optimized_variants jsonb not null default '{}'::jsonb,
  upload_source text not null default 'library' check (upload_source in ('library','camera','drag_drop','recent_photo','company_directory','company_issued')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','flagged','not_required')),
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_profile_photo_uploads_updated_at on public.profile_photo_uploads;
create trigger set_profile_photo_uploads_updated_at
before update on public.profile_photo_uploads
for each row execute function public.set_updated_at();

create index if not exists idx_profiles_avatar_visibility on public.profiles(avatar_visibility, avatar_moderation_status);
create index if not exists idx_profile_photo_uploads_user on public.profile_photo_uploads(user_id, created_at desc);
create index if not exists idx_profile_photo_uploads_moderation on public.profile_photo_uploads(moderation_status, created_at desc);

alter table public.profile_photo_uploads enable row level security;

drop policy if exists "Visible profile photos can be read by allowed viewers" on public.profiles;
create policy "Visible profile photos can be read by allowed viewers" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or avatar_visibility = 'public'
    or (
      avatar_visibility in ('friends','trip_members')
      and exists (
        select 1
        from public.trip_members viewer
        join public.trip_members owner_member on owner_member.trip_id = viewer.trip_id
        where viewer.user_id = auth.uid()
          and owner_member.user_id = profiles.id
      )
    )
    or (
      avatar_visibility = 'organization'
      and exists (
        select 1
        from public.organization_members viewer_org
        join public.organization_members owner_org on owner_org.organization_id = viewer_org.organization_id
        where viewer_org.user_id = auth.uid()
          and owner_org.user_id = profiles.id
      )
    )
  );

drop policy if exists "Users manage own profile photo uploads" on public.profile_photo_uploads;
create policy "Users manage own profile photo uploads" on public.profile_photo_uploads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backend scalability, storage, backup, and reliability readiness tracking.
create table if not exists public.backend_scalability_test_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null check (environment in ('development','staging','production')),
  test_name text not null,
  scenario text not null,
  concurrent_users integer not null default 0 check (concurrent_users >= 0),
  peak_requests_per_second numeric(10,2) not null default 0 check (peak_requests_per_second >= 0),
  api_p95_ms integer,
  database_p95_ms integer,
  queue_delay_ms integer,
  storage_throughput_mb numeric(12,2),
  error_rate numeric(6,4) not null default 0 check (error_rate >= 0),
  status text not null default 'planned' check (status in ('planned','running','passed','failed','blocked')),
  findings jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create table if not exists public.backend_backup_restore_tests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null check (environment in ('staging','production')),
  backup_provider text not null default 'supabase',
  backup_type text not null check (backup_type in ('daily','point_in_time','manual','regional_copy')),
  backup_started_at timestamptz,
  backup_completed_at timestamptz,
  restore_tested_at timestamptz,
  recovery_point_objective_minutes integer,
  recovery_time_objective_minutes integer,
  encrypted boolean not null default true,
  geographic_redundancy boolean not null default false,
  status text not null default 'not_tested' check (status in ('not_tested','scheduled','passed','failed','blocked')),
  notes text
);

create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data_domain text not null,
  retention_days integer not null check (retention_days > 0),
  deletion_behavior text not null check (deletion_behavior in ('delete','anonymize','archive_restricted','legal_hold')),
  applies_to_corporate boolean not null default true,
  applies_to_consumer boolean not null default true,
  legal_basis text,
  policy_version text not null default 'v1'
);

drop trigger if exists set_data_retention_policies_updated_at on public.data_retention_policies;
create trigger set_data_retention_policies_updated_at
before update on public.data_retention_policies
for each row execute function public.set_updated_at();

create table if not exists public.api_performance_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null check (environment in ('development','staging','production')),
  route text not null,
  method text not null,
  status_code integer not null,
  duration_ms integer not null check (duration_ms >= 0),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  request_size_bytes integer,
  response_size_bytes integer,
  rate_limited boolean not null default false,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.storage_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid references public.trips(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  file_category text not null check (file_category in ('profile_photo','trip_photo','video','receipt','passport','visa','flight_confirmation','hotel_confirmation','event_document','corporate_photo','other')),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  visibility text not null default 'private' check (visibility in ('private','trip_members','organization','public','company_only')),
  processing_status text not null default 'queued' check (processing_status in ('queued','processing','completed','failed','quarantined')),
  malware_scan_status text not null default 'pending' check (malware_scan_status in ('pending','clean','infected','unsupported','failed')),
  thumbnail_path text,
  signed_url_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_storage_processing_jobs_updated_at on public.storage_processing_jobs;
create trigger set_storage_processing_jobs_updated_at
before update on public.storage_processing_jobs
for each row execute function public.set_updated_at();

create index if not exists idx_backend_scalability_runs_status on public.backend_scalability_test_runs(environment, status, created_at desc);
create index if not exists idx_backend_backup_restore_status on public.backend_backup_restore_tests(environment, status, created_at desc);
create index if not exists idx_data_retention_domain on public.data_retention_policies(data_domain, policy_version);
create index if not exists idx_api_performance_route_time on public.api_performance_events(route, created_at desc);
create index if not exists idx_api_performance_org_time on public.api_performance_events(organization_id, created_at desc);
create index if not exists idx_storage_processing_jobs_status on public.storage_processing_jobs(processing_status, malware_scan_status, created_at desc);
create index if not exists idx_storage_processing_jobs_trip on public.storage_processing_jobs(trip_id, created_at desc);

alter table public.backend_scalability_test_runs enable row level security;
alter table public.backend_backup_restore_tests enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.api_performance_events enable row level security;
alter table public.storage_processing_jobs enable row level security;

drop policy if exists "Admins read scalability test runs" on public.backend_scalability_test_runs;
create policy "Admins read scalability test runs" on public.backend_scalability_test_runs
  for select to authenticated
  using (exists (select 1 from public.organization_members om where om.user_id = auth.uid() and om.role in ('owner','admin','finance_admin')));

drop policy if exists "Admins read backup restore tests" on public.backend_backup_restore_tests;
create policy "Admins read backup restore tests" on public.backend_backup_restore_tests
  for select to authenticated
  using (exists (select 1 from public.organization_members om where om.user_id = auth.uid() and om.role in ('owner','admin','finance_admin')));

drop policy if exists "Authenticated users read retention policies" on public.data_retention_policies;
create policy "Authenticated users read retention policies" on public.data_retention_policies
  for select to authenticated
  using (true);

drop policy if exists "Admins read api performance events" on public.api_performance_events;
create policy "Admins read api performance events" on public.api_performance_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_member(organization_id, array['owner','admin','finance_admin'])
  );

drop policy if exists "Users read allowed storage processing jobs" on public.storage_processing_jobs;
create policy "Users read allowed storage processing jobs" on public.storage_processing_jobs
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_trip_member(trip_id)
    or public.is_org_member(organization_id, array['owner','admin','finance_admin'])
  );
