create table if not exists public.ghl_sync_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ghl_sync_logs_user_created_idx
  on public.ghl_sync_logs (user_id, created_at desc);

alter table public.ghl_sync_logs enable row level security;

drop policy if exists "Users can view their own GHL sync logs" on public.ghl_sync_logs;
create policy "Users can view their own GHL sync logs"
  on public.ghl_sync_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own GHL sync logs" on public.ghl_sync_logs;
create policy "Users can insert their own GHL sync logs"
  on public.ghl_sync_logs for insert
  with check (auth.uid() = user_id);
