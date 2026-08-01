-- Travel-Drip wallet contribution visibility and payment reminder migration.
-- Run after supabase-backend.sql and supabase-event-planning.sql.
-- This migration is additive and safe to rerun.

create table if not exists public.trip_wallet_payment_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_wallet_id uuid not null references public.trip_virtual_wallets(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  amount_cents bigint not null check (amount_cents >= 100),
  currency text not null default 'USD',
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled','overdue')),
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_trip_wallet_payment_requests_updated_at on public.trip_wallet_payment_requests;
create trigger set_trip_wallet_payment_requests_updated_at
before update on public.trip_wallet_payment_requests
for each row execute function public.set_updated_at();

create index if not exists idx_trip_wallet_payment_requests_trip_due
  on public.trip_wallet_payment_requests(trip_id, due_at, status);
create index if not exists idx_trip_wallet_payment_requests_assigned
  on public.trip_wallet_payment_requests(assigned_to, due_at, status);

alter table public.trip_wallet_payment_requests enable row level security;
revoke all on public.trip_wallet_payment_requests from anon;
grant select on public.trip_wallet_payment_requests to authenticated;
grant all on public.trip_wallet_payment_requests to service_role;

drop policy if exists "Members read eligible wallet payment requests" on public.trip_wallet_payment_requests;
create policy "Members read eligible wallet payment requests" on public.trip_wallet_payment_requests
  for select to authenticated using (
    public.is_trip_member(trip_id)
    and (
      public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin'])
      or (
        assigned_to is null
        or assigned_to = auth.uid()
      )
      and exists (
        select 1 from public.trips t
        where t.id = trip_id
          and t.trip_type not in ('corporate_retreat','business_event','conference')
      )
    )
  );

drop policy if exists "Trip finance roles manage wallet payment requests" on public.trip_wallet_payment_requests;
create policy "Trip finance roles manage wallet payment requests" on public.trip_wallet_payment_requests
  for all to authenticated
  using (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']))
  with check (public.has_trip_role(trip_id, array['owner','admin','organizer','finance_admin']));

-- Mark due requests as overdue and queue one notification per eligible member.
-- This function is service-role-only and is called by /api/wallet-reminders.
create or replace function public.notify_due_trip_wallet_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.trip_wallet_payment_requests%rowtype;
  member_record record;
  queued_count integer := 0;
begin
  for request_record in
    select *
      from public.trip_wallet_payment_requests
     where status = 'pending'
       and due_at <= now()
       and coalesce(metadata ->> 'due_notification_sent', 'false') <> 'true'
     for update
  loop
    for member_record in
      select tm.user_id
        from public.trip_members tm
       where tm.trip_id = request_record.trip_id
         and tm.status = 'active'
         and (request_record.assigned_to is null or tm.user_id = request_record.assigned_to)
    loop
      insert into public.notifications (
        trip_id,
        user_id,
        notification_type,
        title,
        body,
        channels,
        status,
        metadata
      ) values (
        request_record.trip_id,
        member_record.user_id,
        'wallet_payment_due',
        'Trip wallet payment due',
        'A trip wallet payment is due now. Open Travel-Drip to review the request and next step.',
        array['in_app','push']::text[],
        'queued',
        jsonb_build_object(
          'payment_request_id', request_record.id,
          'due_at', request_record.due_at,
          'title', request_record.title
        )
      );
    end loop;

    update public.trip_wallet_payment_requests
       set status = 'overdue',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'due_notification_sent', true,
             'due_notification_sent_at', now()
           )
     where id = request_record.id;
    queued_count := queued_count + 1;
  end loop;

  return queued_count;
end;
$$;

revoke execute on function public.notify_due_trip_wallet_payments() from public, anon, authenticated;
grant execute on function public.notify_due_trip_wallet_payments() to service_role;

-- Replace the core webhook settlement function after notifications exists so
-- every confirmed deposit queues a notification for the active trip members.
create or replace function public.complete_trip_wallet_contribution(
  p_contribution_id uuid,
  p_trip_id uuid,
  p_amount_cents bigint,
  p_provider_ref text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contribution_record public.trip_wallet_contributions%rowtype;
  wallet_record public.trip_virtual_wallets%rowtype;
begin
  select * into contribution_record
    from public.trip_wallet_contributions
   where id = p_contribution_id
   for update;

  if contribution_record.id is null then
    raise exception 'Wallet contribution was not found';
  end if;
  if contribution_record.trip_id <> p_trip_id
     or contribution_record.amount_cents <> p_amount_cents then
    raise exception 'Wallet contribution metadata does not match';
  end if;
  if contribution_record.status = 'completed' then
    return;
  end if;
  if contribution_record.status not in ('pending', 'processing') then
    raise exception 'Wallet contribution is not payable';
  end if;

  select * into wallet_record
    from public.trip_virtual_wallets
   where id = contribution_record.trip_wallet_id
     and trip_id = contribution_record.trip_id
   for update;
  if wallet_record.id is null or wallet_record.status <> 'active' then
    raise exception 'Trip wallet is not active';
  end if;

  update public.trip_wallet_contributions
     set status = 'completed',
         refundable_cents = contribution_record.amount_cents,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'provider', 'stripe_checkout',
           'provider_ref', p_provider_ref,
           'completed_at', now()
         )
   where id = contribution_record.id;

  update public.trip_virtual_wallets
     set available_cents = available_cents + contribution_record.amount_cents,
         total_contributions_cents = total_contributions_cents + contribution_record.amount_cents
   where id = wallet_record.id;

  insert into public.wallet_transactions (
    trip_id, wallet_id, group_bank_id, user_id, transaction_type,
    amount_cents, refundable_cents, status, provider, provider_ref,
    requires_pin, metadata
  ) values (
    contribution_record.trip_id, null, wallet_record.group_bank_id,
    contribution_record.user_id, 'deposit', contribution_record.amount_cents,
    contribution_record.amount_cents, 'completed', 'stripe_checkout',
    p_provider_ref, true,
    jsonb_build_object('contribution_id', contribution_record.id, 'source', 'trip_wallet_add_funds')
  );

  insert into public.notifications (
    trip_id, user_id, notification_type, title, body, channels, status, metadata
  )
  select
    contribution_record.trip_id,
    tm.user_id,
    'wallet_deposit_confirmed',
    'Trip wallet deposit confirmed',
    'A trip wallet deposit was confirmed. Open Travel-Drip to review your contribution and shared wallet.',
    array['in_app','push']::text[],
    'queued',
    jsonb_build_object(
      'contribution_id', contribution_record.id,
      'provider_ref', p_provider_ref
    )
  from public.trip_members tm
  where tm.trip_id = contribution_record.trip_id
    and tm.status = 'active';
end;
$$;

revoke execute on function public.complete_trip_wallet_contribution(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.complete_trip_wallet_contribution(uuid, uuid, bigint, text) to service_role;

-- Allow the open PWA to receive wallet notifications through Supabase Realtime.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
