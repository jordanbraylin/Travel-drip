begin;
-- Private comparisons are accessed only through the authenticated server endpoint.
create table if not exists public.transport_comparisons (
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  document jsonb not null check (octet_length(document::text) <= 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.transport_comparisons enable row level security;
revoke all on public.transport_comparisons from public, anon, authenticated;
grant select, insert, update, delete on public.transport_comparisons to service_role;

-- No raw IP addresses, user records, credentials or private files belong in these tables.
create table if not exists public.app_search_limits (
  key text primary key check (length(key) = 64),
  count integer not null default 1,
  expires_at timestamptz not null
);
create index if not exists app_search_limits_expiry on public.app_search_limits(expires_at);
alter table public.app_search_limits enable row level security;
revoke all on public.app_search_limits from public, anon, authenticated;
grant select, insert, update, delete on public.app_search_limits to service_role;
create table if not exists public.app_public_cache (
  key text primary key check (length(key) = 64),
  payload jsonb not null check (octet_length(payload::text) <= 262144),
  expires_at timestamptz not null
);
create index if not exists app_public_cache_expiry on public.app_public_cache(expires_at);
alter table public.app_public_cache enable row level security;
revoke all on public.app_public_cache from public, anon, authenticated;
grant select, insert, update, delete on public.app_public_cache to service_role;

create or replace function public.app_take_search_slot(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if length(p_key) <> 64 or p_limit not between 1 and 2000 or p_seconds not between 1 and 3600 then
    raise exception 'Invalid search limit';
  end if;
  insert into public.app_search_limits(key,count,expires_at)
  values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set
    count=case when app_search_limits.expires_at<=now() then 1 else least(app_search_limits.count+1,p_limit+1) end,
    expires_at=case when app_search_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else app_search_limits.expires_at end
  returning count into n;
  return n<=p_limit;
end;
$$;
revoke all on function public.app_take_search_slot(text,integer,integer) from public, anon, authenticated;
grant execute on function public.app_take_search_slot(text,integer,integer) to service_role;

create or replace function public.app_expire_search_cache()
returns void language sql security invoker set search_path = '' as $$
  delete from public.app_search_limits where expires_at < now();
  delete from public.app_public_cache where expires_at < now();
$$;
revoke all on function public.app_expire_search_cache() from public, anon, authenticated;
grant execute on function public.app_expire_search_cache() to service_role;
notify pgrst, 'reload schema';
commit;
