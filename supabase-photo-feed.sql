-- Run once in the project's Supabase SQL editor. Keep the storage bucket private.
begin;
create table if not exists public.photo_likes (
  media_id uuid not null references public.media(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id,user_id)
);
create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists photo_comments_feed on public.photo_comments(media_id,created_at desc,id desc);
create table if not exists public.photo_reports (
  media_id uuid not null references public.media(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('Harassment','Privacy concern','Inappropriate content','Spam','Other')),
  created_at timestamptz not null default now(),
  primary key (media_id,user_id)
);
-- Engagement goes through the authenticated API. Reports are never exposed to members.
alter table public.photo_likes enable row level security;
alter table public.photo_comments enable row level security;
alter table public.photo_reports enable row level security;
revoke all on public.photo_likes, public.photo_comments, public.photo_reports from anon, authenticated;
grant all on public.photo_likes, public.photo_comments, public.photo_reports to service_role;
drop policy if exists "Members read media" on public.media;
create policy "Members read media" on public.media for select to authenticated
  using (public.is_trip_member(trip_id) and (user_id = auth.uid() or visibility = 'members'));
commit;
