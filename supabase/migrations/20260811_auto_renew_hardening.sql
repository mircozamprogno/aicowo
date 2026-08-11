-- Auto-renewal hardening (2026-08-11)
--
-- 1. Add 'renewed' as a valid contract_status so we can distinguish
--    contracts that were closed because they auto-renewed from ones
--    that expired without renewal.
-- 2. Guard auto_renew_contracts() against services missing a
--    location_resource_id (previously threw a NOT-NULL violation on the
--    bookings insert and left the run half-applied).
-- 3. Flip renewed contracts to the new 'renewed' status instead of
--    reusing 'expired'.

alter table public.contracts drop constraint chk_contract_status;

alter table public.contracts add constraint chk_contract_status
  check (contract_status::text = any (array[
    'active'::text, 'expired'::text, 'cancelled'::text,
    'suspended'::text, 'renewed'::text
  ]));

create or replace function public.auto_renew_contracts()
 returns table(total_processed integer, successful_renewals integer, failed_renewals integer, execution_time timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_contract record;
  v_old_booking_id bigint;
  v_new_contract_id bigint;
  v_new_contract_number varchar(50);
  v_new_start_date date;
  v_new_end_date date;
  v_location_resource_id bigint;
  v_total_processed integer := 0;
  v_successful_renewals integer := 0;
  v_failed_renewals integer := 0;
  v_execution_time timestamp with time zone;
  v_system_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_availability_check jsonb;
  v_resource_available boolean;
  v_payment_id bigint;
  v_due_date date;
  v_payment_terms_days integer;
  v_duration_days integer;
begin
  v_execution_time := now();

  for v_contract in
    select c.*, s.duration_days, s.location_resource_id
    from contracts c
    inner join services s on c.service_id = s.id
    where c.end_date = current_date
      and c.auto_renew = true
      and c.is_renewable = true
      and c.contract_status = 'active'
      and c.service_type = 'abbonamento'
      and c.is_archived = false
  loop
    v_total_processed := v_total_processed + 1;

    begin
      v_duration_days := v_contract.duration_days::integer;
      v_new_start_date := v_contract.end_date + 1;
      v_new_end_date := v_new_start_date + v_duration_days - 1;
      v_location_resource_id := v_contract.location_resource_id;

      -- Guard: the underlying service must have a valid resource
      if v_location_resource_id is null then
        insert into contract_renewal_log (
          original_contract_id, original_contract_number, renewal_attempt_date,
          renewal_status, error_message, partner_uuid
        ) values (
          v_contract.id, v_contract.contract_number, v_execution_time,
          'failed_error',
          'Service ' || v_contract.service_id || ' has no location_resource_id; cannot renew',
          v_contract.partner_uuid
        );
        v_failed_renewals := v_failed_renewals + 1;
        continue;
      end if;

      select id into v_old_booking_id
      from bookings
      where contract_id = v_contract.id
        and booking_status = 'active'
        and is_archived = false
      limit 1;

      declare
        v_total_quantity integer;
        v_booked_quantity integer;
        v_available_quantity integer;
      begin
        select quantity into v_total_quantity
        from location_resources
        where id = v_location_resource_id;

        select count(*) into v_booked_quantity
        from bookings
        where location_resource_id = v_location_resource_id
          and booking_status = 'active'
          and is_archived = false
          and id != coalesce(v_old_booking_id, -1)
          and (start_date <= v_new_end_date and end_date >= v_new_start_date);

        v_available_quantity := v_total_quantity - v_booked_quantity;
        v_resource_available := v_available_quantity > 0;

        v_availability_check := jsonb_build_object(
          'total_quantity', v_total_quantity,
          'booked_quantity', v_booked_quantity,
          'available_quantity', v_available_quantity,
          'resource_id', v_location_resource_id,
          'old_booking_excluded', v_old_booking_id,
          'checked_period', jsonb_build_object(
            'start_date', v_new_start_date,
            'end_date', v_new_end_date
          )
        );
      end;

      if not v_resource_available then
        insert into contract_renewal_log (
          original_contract_id, original_contract_number, renewal_attempt_date,
          renewal_status, error_message, resource_availability_details, partner_uuid
        ) values (
          v_contract.id, v_contract.contract_number, v_execution_time,
          'failed_no_availability', 'Resource not available for renewal period',
          v_availability_check, v_contract.partner_uuid
        );
        v_failed_renewals := v_failed_renewals + 1;
        continue;
      end if;

      v_new_contract_number := 'CONT-' ||
        to_char(current_date, 'YYYYMMDD') || '-' ||
        lpad(floor(random() * 10000)::text, 4, '0');

      insert into contracts (
        contract_number, customer_id, service_id, location_id, partner_uuid,
        start_date, end_date, service_name, service_type, service_cost,
        service_currency, service_duration_days, service_max_entries,
        location_name, resource_name, resource_type,
        contract_status, entries_used, is_renewable, auto_renew, renewal_count,
        created_by_user_id, created_by_role,
        payment_terms, requires_payment, created_at, updated_at
      ) values (
        v_new_contract_number, v_contract.customer_id, v_contract.service_id,
        v_contract.location_id, v_contract.partner_uuid,
        v_new_start_date, v_new_end_date, v_contract.service_name, v_contract.service_type,
        v_contract.service_cost, v_contract.service_currency, v_contract.service_duration_days,
        v_contract.service_max_entries, v_contract.location_name, v_contract.resource_name,
        v_contract.resource_type, 'active', 0, v_contract.is_renewable, v_contract.auto_renew,
        coalesce(v_contract.renewal_count, 0) + 1, v_system_user_id, 'system',
        v_contract.payment_terms, v_contract.requires_payment, v_execution_time, v_execution_time
      ) returning id into v_new_contract_id;

      -- Old contract flipped to 'renewed' (distinct from customer-driven expiry)
      update contracts
      set contract_status = 'renewed',
          auto_renew = false,
          updated_at = v_execution_time,
          notes = coalesce(notes || E'\n\n', '') ||
            'Contract renewed automatically on ' || v_execution_time::date ||
            '. New contract: ' || v_new_contract_number
      where id = v_contract.id;

      if v_old_booking_id is not null then
        update bookings
        set booking_status = 'completed', is_archived = true, updated_at = v_execution_time
        where id = v_old_booking_id;
      end if;

      insert into bookings (
        contract_id, location_resource_id, partner_uuid, customer_id,
        start_date, end_date, booking_status, created_by, created_at, updated_at
      ) values (
        v_new_contract_id, v_location_resource_id, v_contract.partner_uuid, v_contract.customer_id,
        v_new_start_date, v_new_end_date, 'active', v_system_user_id, v_execution_time, v_execution_time
      );

      if v_contract.requires_payment then
        v_payment_terms_days := case v_contract.payment_terms
          when 'net_7' then 7
          when 'net_15' then 15
          when 'net_30' then 30
          when 'net_60' then 60
          when 'net_90' then 90
          else 30
        end;
        v_due_date := v_new_start_date + v_payment_terms_days;

        insert into payments (
          contract_id, partner_uuid, amount, currency, payment_method,
          payment_status, payment_type, payment_date, due_date, notes, created_by,
          created_at, updated_at
        ) values (
          v_new_contract_id, v_contract.partner_uuid, v_contract.service_cost,
          v_contract.service_currency, 'bank_transfer', 'pending', 'full', null, v_due_date,
          'Auto-generated payment for renewed contract ' || v_new_contract_number,
          v_system_user_id, v_execution_time, v_execution_time
        ) returning id into v_payment_id;
      end if;

      insert into contract_renewal_log (
        original_contract_id, original_contract_number, renewal_attempt_date,
        renewal_status, new_contract_id, new_contract_number,
        resource_availability_details, partner_uuid
      ) values (
        v_contract.id, v_contract.contract_number, v_execution_time,
        'success', v_new_contract_id, v_new_contract_number,
        v_availability_check, v_contract.partner_uuid
      );

      v_successful_renewals := v_successful_renewals + 1;

    exception when others then
      insert into contract_renewal_log (
        original_contract_id, original_contract_number, renewal_attempt_date,
        renewal_status, error_message, partner_uuid
      ) values (
        v_contract.id, v_contract.contract_number, v_execution_time,
        'failed_error', 'Unexpected error: ' || sqlerrm, v_contract.partner_uuid
      );
      v_failed_renewals := v_failed_renewals + 1;
    end;
  end loop;

  return query
  select v_total_processed, v_successful_renewals, v_failed_renewals, v_execution_time;
end;
$function$;
