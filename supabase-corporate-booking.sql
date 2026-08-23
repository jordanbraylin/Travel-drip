-- Travel-Drip corporate booking operations
-- Apply after supabase-backend.sql.

create table if not exists public.corporate_travel_policies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('draft','active','retired')),
  currency text not null default 'USD',
  flight_cabin text not null default 'economy' check (flight_cabin in ('economy','premium_economy','business','first')),
  flight_cap_cents bigint not null default 0 check (flight_cap_cents >= 0),
  hotel_nightly_cap_cents bigint not null default 0 check (hotel_nightly_cap_cents >= 0),
  ground_transport_cap_cents bigint not null default 0 check (ground_transport_cap_cents >= 0),
  meal_daily_cap_cents bigint not null default 0 check (meal_daily_cap_cents >= 0),
  advance_booking_days integer not null default 0 check (advance_booking_days >= 0),
  receipt_threshold_cents bigint not null default 0 check (receipt_threshold_cents >= 0),
  allowed_airlines text[] not null default '{}',
  allowed_hotel_categories text[] not null default '{}',
  allowed_transport_providers text[] not null default '{}',
  approval_rules jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.corporate_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  policy_id uuid references public.corporate_travel_policies(id) on delete set null,
  traveler_user_id uuid references auth.users(id) on delete set null,
  attendee_id uuid references public.corporate_attendees(id) on delete set null,
  booking_type text not null check (booking_type in ('flight','hotel','rail','car','transportation','restaurant','activity','conference','other')),
  traveler_name text not null,
  traveler_email text,
  provider_name text not null,
  provider_reference text,
  provider_status text not null default 'not_connected' check (provider_status in ('not_connected','manual','pending','confirmed','failed','cancelled')),
  source text not null default 'manual' check (source in ('manual','provider','import','organizer')),
  title text not null,
  origin text,
  destination text,
  starts_at timestamptz,
  ends_at timestamptz,
  currency text not null default 'USD',
  total_cents bigint not null default 0 check (total_cents >= 0),
  status text not null default 'requested' check (status in ('requested','on_hold','approved','ticketed','confirmed','in_progress','completed','cancelled','refunded','failed')),
  policy_status text not null default 'review' check (policy_status in ('compliant','review','exception','blocked')),
  approval_status text not null default 'pending' check (approval_status in ('not_required','pending','approved','rejected','cancelled')),
  confirmation_verified_at timestamptz,
  cancellation_deadline timestamptz,
  idempotency_key text not null,
  details jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  unique (trip_id, idempotency_key)
);

create table if not exists public.corporate_booking_approvals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid not null references public.corporate_bookings(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  assigned_role text not null default 'finance_admin',
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reason text,
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.corporate_service_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid references public.corporate_bookings(id) on delete set null,
  traveler_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  case_type text not null check (case_type in ('change','cancellation','disruption','emergency','accessibility','billing','other')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent','critical')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_provider','waiting_traveler','resolved','closed')),
  subject text not null,
  description text not null,
  resolution text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_corporate_travel_policies_updated_at on public.corporate_travel_policies;
create trigger set_corporate_travel_policies_updated_at before update on public.corporate_travel_policies
for each row execute function public.set_updated_at();

drop trigger if exists set_corporate_bookings_updated_at on public.corporate_bookings;
create trigger set_corporate_bookings_updated_at before update on public.corporate_bookings
for each row execute function public.set_updated_at();

drop trigger if exists set_corporate_booking_approvals_updated_at on public.corporate_booking_approvals;
create trigger set_corporate_booking_approvals_updated_at before update on public.corporate_booking_approvals
for each row execute function public.set_updated_at();

drop trigger if exists set_corporate_service_cases_updated_at on public.corporate_service_cases;
create trigger set_corporate_service_cases_updated_at before update on public.corporate_service_cases
for each row execute function public.set_updated_at();

create index if not exists idx_corporate_policy_trip_status on public.corporate_travel_policies(trip_id, status);
create index if not exists idx_corporate_booking_trip_status on public.corporate_bookings(trip_id, status, starts_at);
create index if not exists idx_corporate_booking_traveler on public.corporate_bookings(traveler_user_id, starts_at);
create index if not exists idx_corporate_booking_approval_queue on public.corporate_booking_approvals(trip_id, status, created_at);
create index if not exists idx_corporate_service_queue on public.corporate_service_cases(trip_id, status, priority, created_at);

alter table public.corporate_travel_policies enable row level security;
alter table public.corporate_bookings enable row level security;
alter table public.corporate_booking_approvals enable row level security;
alter table public.corporate_service_cases enable row level security;

drop policy if exists "Corporate members read active policy" on public.corporate_travel_policies;
create policy "Corporate members read active policy" on public.corporate_travel_policies
  for select to authenticated using (
    (status = 'active' and public.is_trip_member(trip_id))
    or public.has_trip_role(trip_id, array['owner','admin','finance_admin'])
  );

drop policy if exists "Corporate admins manage travel policy" on public.corporate_travel_policies;
create policy "Corporate admins manage travel policy" on public.corporate_travel_policies
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','finance_admin']))
  with check (public.has_trip_role(trip_id, array['owner','admin','finance_admin']));

drop policy if exists "Corporate booking visibility" on public.corporate_bookings;
create policy "Corporate booking visibility" on public.corporate_bookings
  for select to authenticated using (
    traveler_user_id = auth.uid()
    or created_by = auth.uid()
    or public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin','team_lead'])
  );

drop policy if exists "Corporate booking managers create" on public.corporate_bookings;
create policy "Corporate booking managers create" on public.corporate_bookings
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.has_trip_role(trip_id, array['owner','admin','organizer'])
  );

drop policy if exists "Corporate booking managers update" on public.corporate_bookings;
create policy "Corporate booking managers update" on public.corporate_bookings
  for update to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

drop policy if exists "Corporate approval visibility" on public.corporate_booking_approvals;
create policy "Corporate approval visibility" on public.corporate_booking_approvals
  for select to authenticated using (
    requested_by = auth.uid()
    or assigned_user_id = auth.uid()
    or public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin'])
  );

drop policy if exists "Corporate managers create approvals" on public.corporate_booking_approvals;
create policy "Corporate managers create approvals" on public.corporate_booking_approvals
  for insert to authenticated with check (
    requested_by = auth.uid()
    and public.has_trip_role(trip_id, array['owner','admin','organizer'])
  );

drop policy if exists "Corporate approvers decide" on public.corporate_booking_approvals;
create policy "Corporate approvers decide" on public.corporate_booking_approvals
  for update to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','finance_admin']))
  with check (public.has_trip_role(trip_id, array['owner','admin','finance_admin']));

drop policy if exists "Corporate service case visibility" on public.corporate_service_cases;
create policy "Corporate service case visibility" on public.corporate_service_cases
  for select to authenticated using (
    traveler_user_id = auth.uid()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.has_trip_role(trip_id, array['owner','admin','organizer','team_lead'])
  );

drop policy if exists "Corporate members create service cases" on public.corporate_service_cases;
create policy "Corporate members create service cases" on public.corporate_service_cases
  for insert to authenticated with check (created_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Corporate service team updates cases" on public.corporate_service_cases;
create policy "Corporate service team updates cases" on public.corporate_service_cases
  for update to authenticated
  using (assigned_to = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer','team_lead']))
  with check (assigned_to = auth.uid() or public.has_trip_role(trip_id, array['owner','admin','organizer','team_lead']));
