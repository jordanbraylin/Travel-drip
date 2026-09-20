-- Travel-Drip registration safeguards.
-- Run after supabase-backend.sql. This migration is additive and rerunnable.

create or replace function public.normalize_username(candidate text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(candidate, '')), '^@', '')), '');
$$;

update public.profiles
set username = public.normalize_username(username)
where username is distinct from public.normalize_username(username);

-- Keep the first existing username and safely disambiguate any historical duplicates.
with ranked as (
  select
    id,
    row_number() over (
      partition by lower(username)
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.profiles
  where username is not null
)
update public.profiles as profile
set username = left(profile.username, 15) || '_' || left(replace(profile.id::text, '-', ''), 8)
from ranked
where ranked.id = profile.id
  and ranked.duplicate_rank > 1;

create unique index if not exists profiles_username_unique_ci
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.enforce_profile_username()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.username := public.normalize_username(new.username);
  if new.username is not null and new.username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must contain 3-24 letters, numbers, or underscores'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profiles_username on public.profiles;
create trigger enforce_profiles_username
before insert or update of username on public.profiles
for each row execute function public.enforce_profile_username();

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.normalize_username(candidate_username) ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = public.normalize_username(candidate_username)
        and id is distinct from auth.uid()
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    public.normalize_username(new.raw_user_meta_data ->> 'username')
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        username = coalesce(excluded.username, public.profiles.username),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();
