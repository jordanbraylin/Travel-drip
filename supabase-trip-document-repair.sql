-- Private owner-only storage; does not alter existing memory sharing policies.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-documents', 'trip-documents', false, 26214400,
  array['application/pdf','image/jpeg','image/png','image/heic','image/webp']::text[])
on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Trip document owner access') then
    create policy "Trip document owner access" on storage.objects
      for all to authenticated
      using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documents' and policyname = 'Users create own documents') then
    create policy "Users create own documents" on public.documents
      for insert to authenticated
      with check (user_id = (select auth.uid()) and uploaded_by = (select auth.uid())
        and visibility = 'owner' and storage_bucket = 'trip-documents'
        and (storage.foldername(storage_path))[1] = (select auth.uid())::text
        and public.is_trip_member(trip_id));
  end if;
end $$;
commit;
