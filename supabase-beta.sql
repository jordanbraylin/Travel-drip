-- Travel-Drip beta migration.
-- Run this in the Supabase SQL editor after supabase-backend.sql.
-- It is safe to run more than once.

alter table if exists public.profiles
  add column if not exists username text,
  add column if not exists bio text;

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
    nullif(new.raw_user_meta_data ->> 'username', '')
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

create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  relationship text not null check (char_length(trim(relationship)) between 1 and 80),
  phone text not null check (char_length(trim(phone)) between 3 and 40),
  email text check (email is null or char_length(trim(email)) <= 254),
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists set_trusted_contacts_updated_at on public.trusted_contacts;
create trigger set_trusted_contacts_updated_at
before update on public.trusted_contacts
for each row execute function public.set_updated_at();

create index if not exists idx_trusted_contacts_user
  on public.trusted_contacts(user_id, is_primary desc, created_at);

alter table public.trusted_contacts enable row level security;
revoke all on public.trusted_contacts from anon;
grant select, insert, update, delete on public.trusted_contacts to authenticated;

drop policy if exists "Users read their own trusted contacts" on public.trusted_contacts;
create policy "Users read their own trusted contacts" on public.trusted_contacts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own trusted contacts" on public.trusted_contacts;
create policy "Users create their own trusted contacts" on public.trusted_contacts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own trusted contacts" on public.trusted_contacts;
create policy "Users update their own trusted contacts" on public.trusted_contacts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own trusted contacts" on public.trusted_contacts;
create policy "Users delete their own trusted contacts" on public.trusted_contacts
  for delete to authenticated using ((select auth.uid()) = user_id);
