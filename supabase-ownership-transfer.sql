-- Travel-Drip ownership transfer migration.
-- Run after supabase-backend.sql and supabase-event-planning.sql.
-- The API is the only caller; browser roles cannot execute this function directly.

create or replace function public.transfer_trip_or_event_ownership(
  p_trip_id uuid,
  p_new_owner_user_id uuid,
  p_actor_user_id uuid,
  p_leave_after_transfer boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_record public.trips%rowtype;
  event_record public.events%rowtype;
  old_trip_member public.trip_members%rowtype;
  new_trip_member public.trip_members%rowtype;
  old_event_member public.event_members%rowtype;
  new_event_member public.event_members%rowtype;
  workspace_type text := 'trip';
begin
  if p_trip_id is null or p_new_owner_user_id is null or p_actor_user_id is null then
    raise exception 'Trip, new owner, and current owner are required';
  end if;

  if p_actor_user_id = p_new_owner_user_id then
    raise exception 'Choose another active trip member as the new owner';
  end if;

  select *
    into trip_record
    from public.trips
   where id = p_trip_id
   for update;

  if not found then
    raise exception 'Trip was not found';
  end if;

  if trip_record.owner_user_id <> p_actor_user_id then
    raise exception 'Only the current trip owner can transfer ownership';
  end if;

  select *
    into old_trip_member
    from public.trip_members
   where trip_id = p_trip_id
     and user_id = p_actor_user_id
     and status = 'active'
   for update;

  if not found or old_trip_member.role <> 'owner' then
    raise exception 'Current owner membership is not active';
  end if;

  select *
    into new_trip_member
    from public.trip_members
   where trip_id = p_trip_id
     and user_id = p_new_owner_user_id
     and status = 'active'
   for update;

  if not found then
    raise exception 'The new owner must be an active member of this trip';
  end if;

  select *
    into event_record
    from public.events
   where id = p_trip_id
   for update;

  if found then
    workspace_type := 'event';
    if event_record.host_user_id <> p_actor_user_id then
      raise exception 'Only the current event owner can transfer ownership';
    end if;

    select *
      into old_event_member
      from public.event_members
     where event_id = p_trip_id
       and user_id = p_actor_user_id
       and status = 'active'
     for update;

    if not found or old_event_member.role <> 'owner' then
      raise exception 'Current event owner membership is not active';
    end if;

    select *
      into new_event_member
      from public.event_members
     where event_id = p_trip_id
       and user_id = p_new_owner_user_id
       and status = 'active'
     for update;

    if not found then
      raise exception 'The new owner must be an active member of this event';
    end if;
  end if;

  update public.trips
     set owner_user_id = p_new_owner_user_id
   where id = p_trip_id;

  update public.trip_members
     set role = case when p_leave_after_transfer then 'traveler' else 'organizer' end,
         status = case when p_leave_after_transfer then 'left' else 'active' end,
         permissions = case
           when p_leave_after_transfer then coalesce(permissions, '{}'::jsonb) - 'all'
           else coalesce(permissions, '{}'::jsonb) || jsonb_build_object('ownershipTransferred', true)
         end
   where id = old_trip_member.id;

  update public.trip_members
     set role = 'owner',
         status = 'active',
         permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object('all', true, 'ownershipTransferred', true)
   where id = new_trip_member.id;

  if event_record.id is not null then
    update public.events
       set host_user_id = p_new_owner_user_id
     where id = p_trip_id;

    update public.event_members
       set role = case when p_leave_after_transfer then 'attendee' else 'organizer' end,
           status = case when p_leave_after_transfer then 'left' else 'active' end,
           permissions = case
             when p_leave_after_transfer then coalesce(permissions, '{}'::jsonb) - 'all'
             else coalesce(permissions, '{}'::jsonb) || jsonb_build_object('ownershipTransferred', true)
           end
     where id = old_event_member.id;

    update public.event_members
       set role = 'owner',
           status = 'active',
           permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object('all', true, 'ownershipTransferred', true)
     where id = new_event_member.id;

    insert into public.event_audit_logs (event_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (
      p_trip_id,
      p_actor_user_id,
      'event.ownership_transferred',
      'event',
      p_trip_id::text,
      jsonb_build_object(
        'previousOwnerUserId', p_actor_user_id,
        'newOwnerUserId', p_new_owner_user_id,
        'leaveAfterTransfer', p_leave_after_transfer
      )
    );
  end if;

  insert into public.audit_logs (actor_user_id, organization_id, trip_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_user_id,
    trip_record.organization_id,
    p_trip_id,
    'ownership.transferred',
    workspace_type,
    p_trip_id::text,
    jsonb_build_object(
      'previousOwnerUserId', p_actor_user_id,
      'newOwnerUserId', p_new_owner_user_id,
      'leaveAfterTransfer', p_leave_after_transfer,
      'eventUpdated', event_record.id is not null
    )
  );

  return jsonb_build_object(
    'tripId', p_trip_id,
    'entityType', workspace_type,
    'previousOwnerUserId', p_actor_user_id,
    'newOwnerUserId', p_new_owner_user_id,
    'leaveAfterTransfer', p_leave_after_transfer
  );
end;
$$;

revoke all on function public.transfer_trip_or_event_ownership(uuid, uuid, uuid, boolean) from public;
revoke all on function public.transfer_trip_or_event_ownership(uuid, uuid, uuid, boolean) from anon;
revoke all on function public.transfer_trip_or_event_ownership(uuid, uuid, uuid, boolean) from authenticated;
grant execute on function public.transfer_trip_or_event_ownership(uuid, uuid, uuid, boolean) to service_role;
