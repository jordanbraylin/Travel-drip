-- Private, user-scoped storage for Travel-Drip profile images and trip documents.
-- Run after supabase-backend.sql. Safe to rerun.

alter table public.invitations alter column invitee_email drop not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/heic','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'travel-memories',
  'travel-memories',
  false,
  104857600,
  array['image/jpeg','image/png','image/heic','image/webp','video/mp4','video/quicktime','video/webm']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-documents',
  'trip-documents',
  false,
  26214400,
  array['application/pdf','image/jpeg','image/png','image/heic','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own profile images" on storage.objects;
create policy "Users upload own profile images" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own profile images" on storage.objects;
create policy "Users read own profile images" on storage.objects
for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update own profile images" on storage.objects;
create policy "Users update own profile images" on storage.objects
for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own profile images" on storage.objects;
create policy "Users delete own profile images" on storage.objects
for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload own trip documents" on storage.objects;
create policy "Users upload own trip documents" on storage.objects
for insert to authenticated
with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own trip documents" on storage.objects;
create policy "Users read own trip documents" on storage.objects
for select to authenticated
using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update own trip documents" on storage.objects;
create policy "Users update own trip documents" on storage.objects
for update to authenticated
using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own trip documents" on storage.objects;
create policy "Users delete own trip documents" on storage.objects
for delete to authenticated
using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload own travel memories" on storage.objects;
create policy "Users upload own travel memories" on storage.objects
for insert to authenticated
with check (bucket_id = 'travel-memories' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own travel memories" on storage.objects;
create policy "Users read own travel memories" on storage.objects
for select to authenticated
using (bucket_id = 'travel-memories' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own travel memories" on storage.objects;
create policy "Users delete own travel memories" on storage.objects
for delete to authenticated
using (bucket_id = 'travel-memories' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users create own documents" on public.documents;
create policy "Users create own documents" on public.documents
for insert to authenticated
with check (
  user_id = auth.uid()
  and uploaded_by = auth.uid()
  and public.is_trip_member(trip_id)
);

drop policy if exists "Users update own documents" on public.documents;
create policy "Users update own documents" on public.documents
for update to authenticated
using (uploaded_by = auth.uid())
with check (uploaded_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Users delete own documents" on public.documents;
create policy "Users delete own documents" on public.documents
for delete to authenticated
using (uploaded_by = auth.uid());

drop policy if exists "Members read media" on public.media;
create policy "Members read media" on public.media
for select to authenticated
using (
  user_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'members' and public.is_trip_member(trip_id))
  or public.has_trip_role(trip_id, array['owner','admin','organizer'])
);

drop policy if exists "Users update own media" on public.media;
create policy "Users update own media" on public.media
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "Users delete own media" on public.media;
create policy "Users delete own media" on public.media
for delete to authenticated
using (user_id = auth.uid());
