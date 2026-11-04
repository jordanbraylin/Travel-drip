-- Keep full financial rows behind authorized roles. Employees and team leads
-- receive their operational fields from the authenticated corporate API.
begin;
do $$
declare
  table_name text;
begin
  foreach table_name in array array['corporate_travel_policies','corporate_bookings','corporate_booking_approvals','corporate_service_cases'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing corporate table: %', table_name;
    end if;
    if not exists (select 1 from pg_policies p where p.schemaname = 'public'
      and p.tablename = table_name and p.policyname = 'Corporate full rows require financial access') then
      execute format('create policy %I on public.%I as restrictive for select to authenticated using (public.has_trip_role(trip_id, array[''owner'',''admin'',''organizer'',''finance_admin'']))',
        'Corporate full rows require financial access', table_name);
    end if;
  end loop;
end $$;
commit;
