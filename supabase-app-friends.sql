begin;
create table if not exists public.app_friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key(user_a,user_b),
  check(user_a < user_b), check(requested_by in (user_a,user_b))
);
create index if not exists app_friendships_recipient on public.app_friendships(user_b,status);
alter table public.app_friendships enable row level security;
revoke all on public.app_friendships from anon,authenticated;
grant all on public.app_friendships to service_role;
create or replace function public.is_app_friend(other_user uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.app_friendships where status='accepted' and ((user_a=auth.uid() and user_b=other_user) or (user_b=auth.uid() and user_a=other_user))); $$;
revoke all on function public.is_app_friend(uuid) from public,anon;
grant execute on function public.is_app_friend(uuid) to authenticated;
drop policy if exists "Members read media" on public.media;
create policy "Members read media" on public.media for select to authenticated using
  (user_id=auth.uid() or (visibility='members' and public.is_trip_member(trip_id)) or (visibility='friends' and public.is_app_friend(user_id)));
commit;
