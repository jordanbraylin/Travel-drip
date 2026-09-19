-- Private media storage for Travel-Drip memory uploads.
-- Paths are scoped to the authenticated user's UUID.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'travel-memories',
  'travel-memories',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own travel memories" on storage.objects;
create policy "Users upload own travel memories"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'travel-memories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users read own travel memories" on storage.objects;
create policy "Users read own travel memories"
on storage.objects for select to authenticated
using (
  bucket_id = 'travel-memories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update own travel memories" on storage.objects;
create policy "Users update own travel memories"
on storage.objects for update to authenticated
using (
  bucket_id = 'travel-memories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'travel-memories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete own travel memories" on storage.objects;
create policy "Users delete own travel memories"
on storage.objects for delete to authenticated
using (
  bucket_id = 'travel-memories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
