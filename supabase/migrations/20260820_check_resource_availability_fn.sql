-- Shared resource-availability helper (2026-08-20)
--
-- Used by both the auto-renewal SQL function and the preflight edge
-- function so the two cannot drift.
--
-- Returns a jsonb envelope describing whether the resource has at least
-- one free slot for the whole [p_start_date, p_end_date] window,
-- optionally excluding one existing booking (the contract's own current
-- booking, when checking a would-be extension).

create or replace function public.check_resource_availability(
  p_resource_id        bigint,
  p_start_date         date,
  p_end_date           date,
  p_exclude_booking_id bigint default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_total    integer;
  v_booked   integer;
  v_available integer;
begin
  select quantity into v_total
    from location_resources
   where id = p_resource_id;

  if v_total is null then
    return jsonb_build_object(
      'available',      false,
      'error',          'resource_not_found',
      'resource_id',    p_resource_id,
      'checked_period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date)
    );
  end if;

  select count(*) into v_booked
    from bookings
   where location_resource_id = p_resource_id
     and booking_status = 'active'
     and is_archived = false
     and id != coalesce(p_exclude_booking_id, -1)
     and (start_date <= p_end_date and end_date >= p_start_date);

  v_available := v_total - v_booked;

  return jsonb_build_object(
    'available',           v_available > 0,
    'total_quantity',      v_total,
    'booked_quantity',     v_booked,
    'available_quantity',  v_available,
    'resource_id',         p_resource_id,
    'excluded_booking_id', p_exclude_booking_id,
    'checked_period',      jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date)
  );
end;
$function$;

grant execute on function public.check_resource_availability(bigint, date, date, bigint) to authenticated, service_role;
