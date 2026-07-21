create table if not exists public.trip_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trip_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  user_id uuid not null references auth.users(id) on delete cascade
);

alter table public.trip_events enable row level security;

drop policy if exists "Users can read trip events" on public.trip_events;
create policy "Users can read trip events"
  on public.trip_events for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own trip events" on public.trip_events;
create policy "Users can insert their own trip events"
  on public.trip_events for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read their own push subscriptions" on public.push_subscriptions;
create policy "Users can read their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_events'
  ) then
    alter publication supabase_realtime add table public.trip_events;
  end if;
end $$;

create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trip_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null,
  amount_cents integer not null,
  status text not null,
  refundable boolean not null default false,
  booking_reference text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.wallet_ledger enable row level security;

drop policy if exists "Users can read their own wallet ledger" on public.wallet_ledger;
create policy "Users can read their own wallet ledger"
  on public.wallet_ledger for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own wallet ledger entries" on public.wallet_ledger;
create policy "Users can insert their own wallet ledger entries"
  on public.wallet_ledger for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.virtual_wallet_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_card_id text,
  cardholder_name text not null,
  masked_pan text not null,
  status text not null default 'inactive',
  spendable_balance_cents integer not null default 0,
  daily_limit_cents integer not null default 0,
  per_transaction_limit_cents integer not null default 0,
  controls jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.virtual_wallet_cards enable row level security;

drop policy if exists "Users can read their own virtual wallet cards" on public.virtual_wallet_cards;
create policy "Users can read their own virtual wallet cards"
  on public.virtual_wallet_cards for select
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.virtual_card_transactions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  card_id uuid not null references public.virtual_wallet_cards(id) on delete cascade,
  trip_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  amount_cents integer not null,
  status text not null,
  remaining_balance_cents integer not null,
  wallet_ledger_id bigint references public.wallet_ledger(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.virtual_card_transactions enable row level security;

drop policy if exists "Users can read their own virtual card transactions" on public.virtual_card_transactions;
create policy "Users can read their own virtual card transactions"
  on public.virtual_card_transactions for select
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.restaurant_bills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id text not null,
  restaurant_name text not null,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  tip_cents integer not null default 0,
  service_fee_cents integer not null default 0,
  discount_cents integer not null default 0,
  final_total_cents integer not null,
  split_mode text not null,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.restaurant_bills enable row level security;

drop policy if exists "Authenticated travelers can read restaurant bills" on public.restaurant_bills;
create policy "Authenticated travelers can read restaurant bills"
  on public.restaurant_bills for select
  to authenticated
  using (true);

drop policy if exists "Users can create restaurant bills" on public.restaurant_bills;
create policy "Users can create restaurant bills"
  on public.restaurant_bills for insert
  to authenticated
  with check (auth.uid() = created_by);

create table if not exists public.restaurant_bill_shares (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  bill_id uuid not null references public.restaurant_bills(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_cents integer not null default 0,
  drink_cents integer not null default 0,
  shared_item_cents integer not null default 0,
  tax_cents integer not null default 0,
  tip_cents integer not null default 0,
  final_amount_cents integer not null,
  payment_method text,
  payment_status text not null default 'unpaid',
  metadata jsonb not null default '{}'::jsonb,
  unique (bill_id, user_id)
);

alter table public.restaurant_bill_shares enable row level security;

drop policy if exists "Users can read their own restaurant bill shares" on public.restaurant_bill_shares;
create policy "Users can read their own restaurant bill shares"
  on public.restaurant_bill_shares for select
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.ride_share_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id text not null,
  destination_country text not null,
  provider_name text not null,
  pickup_location text not null,
  dropoff_location text not null,
  fare_cents integer not null,
  tax_cents integer not null default 0,
  toll_cents integer not null default 0,
  booking_fee_cents integer not null default 0,
  tip_cents integer not null default 0,
  final_total_cents integer not null,
  split_mode text not null,
  status text not null default 'shared',
  created_by uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.ride_share_expenses enable row level security;

drop policy if exists "Authenticated travelers can read ride share expenses" on public.ride_share_expenses;
create policy "Authenticated travelers can read ride share expenses"
  on public.ride_share_expenses for select
  to authenticated
  using (true);

drop policy if exists "Users can create ride share expenses" on public.ride_share_expenses;
create policy "Users can create ride share expenses"
  on public.ride_share_expenses for insert
  to authenticated
  with check (auth.uid() = created_by);

create table if not exists public.ride_share_expense_shares (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ride_expense_id uuid not null references public.ride_share_expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fare_share_cents integer not null,
  fee_share_cents integer not null default 0,
  tip_share_cents integer not null default 0,
  final_amount_cents integer not null,
  payment_method text,
  payment_status text not null default 'unpaid',
  metadata jsonb not null default '{}'::jsonb,
  unique (ride_expense_id, user_id)
);

alter table public.ride_share_expense_shares enable row level security;

drop policy if exists "Users can read their own ride expense shares" on public.ride_share_expense_shares;
create policy "Users can read their own ride expense shares"
  on public.ride_share_expense_shares for select
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.itinerary_notification_preferences (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled_categories text[] not null default array[]::text[],
  delivery_channels text[] not null default array['push', 'in_app']::text[],
  emergency_always_on boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  unique (trip_id, user_id)
);

alter table public.itinerary_notification_preferences enable row level security;

drop policy if exists "Users can read their own itinerary notification preferences" on public.itinerary_notification_preferences;
create policy "Users can read their own itinerary notification preferences"
  on public.itinerary_notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their own itinerary notification preferences" on public.itinerary_notification_preferences;
create policy "Users can manage their own itinerary notification preferences"
  on public.itinerary_notification_preferences for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.itinerary_notification_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trip_id text not null,
  event_type text not null,
  title text not null,
  message text not null,
  severity text not null default 'normal',
  channels text[] not null default array['push', 'in_app']::text[],
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.itinerary_notification_events enable row level security;

drop policy if exists "Authenticated travelers can read itinerary notification events" on public.itinerary_notification_events;
create policy "Authenticated travelers can read itinerary notification events"
  on public.itinerary_notification_events for select
  to authenticated
  using (true);

create table if not exists public.refund_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trip_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_amount_cents integer not null,
  refundable_amount_cents integer not null,
  status text not null default 'pending_review',
  reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.refund_requests enable row level security;

drop policy if exists "Users can read their own refund requests" on public.refund_requests;
create policy "Users can read their own refund requests"
  on public.refund_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own refund requests" on public.refund_requests;
create policy "Users can create their own refund requests"
  on public.refund_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.financial_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trip_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.financial_audit_log enable row level security;

drop policy if exists "Users can read audit entries about themselves" on public.financial_audit_log;
create policy "Users can read audit entries about themselves"
  on public.financial_audit_log for select
  to authenticated
  using (auth.uid() = actor_user_id or auth.uid() = subject_user_id);

create table if not exists public.corporate_retreats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  retreat_name text not null,
  retreat_type text not null,
  starts_on date,
  ends_on date,
  settings jsonb not null default '{}'::jsonb
);

alter table public.corporate_retreats enable row level security;

create table if not exists public.retreat_members (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  retreat_id uuid not null references public.corporate_retreats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  team_name text,
  permissions jsonb not null default '{}'::jsonb,
  unique (retreat_id, user_id)
);

alter table public.retreat_members enable row level security;

drop policy if exists "Users can read their retreat membership" on public.retreat_members;
create policy "Users can read their retreat membership"
  on public.retreat_members for select
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.retreat_permission_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  retreat_id uuid not null references public.corporate_retreats(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  access_area text not null,
  decision text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.retreat_permission_audit enable row level security;

drop policy if exists "Users can read permission audit entries about themselves" on public.retreat_permission_audit;
create policy "Users can read permission audit entries about themselves"
  on public.retreat_permission_audit for select
  to authenticated
  using (auth.uid() = actor_user_id or auth.uid() = subject_user_id);

create table if not exists public.trip_important_information (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_id text not null,
  section_type text not null,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  requires_acknowledgment boolean not null default false,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null
);

alter table public.trip_important_information enable row level security;

drop policy if exists "Authenticated travelers can read important information" on public.trip_important_information;
create policy "Authenticated travelers can read important information"
  on public.trip_important_information for select
  to authenticated
  using (true);

create table if not exists public.important_information_acknowledgments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  info_id bigint not null references public.trip_important_information(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  acknowledged_at timestamptz not null default now(),
  unique (info_id, user_id, version)
);

alter table public.important_information_acknowledgments enable row level security;

drop policy if exists "Users can read their own important info acknowledgments" on public.important_information_acknowledgments;
create policy "Users can read their own important info acknowledgments"
  on public.important_information_acknowledgments for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own important info acknowledgments" on public.important_information_acknowledgments;
create policy "Users can create their own important info acknowledgments"
  on public.important_information_acknowledgments for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.trip_attachments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trip_id text not null,
  info_id bigint references public.trip_important_information(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_type text not null,
  uploaded_by uuid references auth.users(id) on delete set null
);

alter table public.trip_attachments enable row level security;

drop policy if exists "Authenticated travelers can read trip attachments" on public.trip_attachments;
create policy "Authenticated travelers can read trip attachments"
  on public.trip_attachments for select
  to authenticated
  using (true);
