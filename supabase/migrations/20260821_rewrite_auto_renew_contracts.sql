-- Rewrite auto_renew_contracts() for extend-in-place model (2026-08-21)
--
-- Old model: insert a new contracts row, mark old as 'renewed'.
-- New model: update the existing contract's end_date and extend its
-- booking; contract_number, id, customer_id all stay the same.
-- If the resource is not available for the extension window, still
-- extend the contract but skip the booking update — logged as
-- 'success_no_booking' so the admin dashboard can surface it.
--
-- Return signature unchanged so the pg_cron job at 04:00 Europe/Zurich
-- (Job 2 in cron_jobs.sql) continues to work.

create or replace function public.auto_renew_contracts()
 returns table(total_processed integer, successful_renewals integer, failed_renewals integer, execution_time timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_contract record;
  v_active_booking_id bigint;
  v_new_end_date date;
  v_location_resource_id bigint;
  v_duration_days integer;
  v_availability jsonb;
  v_status text;
  v_total_processed integer := 0;
  v_successful_renewals integer := 0;
  v_failed_renewals integer := 0;
  v_execution_time timestamp with time zone := now();
  v_system_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_payment_terms_days integer;
  v_due_date date;
begin
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
      v_active_booking_id := null;

    begin
      v_duration_days := v_contract.duration_days::integer;
      v_new_end_date := v_contract.end_date + v_duration_days;
      v_location_resource_id := v_contract.location_resource_id;

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

      select id into v_active_booking_id
        from bookings
       where contract_id = v_contract.id
         and booking_status = 'active'
         and is_archived = false
       limit 1;

      v_availability := check_resource_availability(
        v_location_resource_id,
        v_contract.end_date + 1,
        v_new_end_date,
        v_active_booking_id
      );

      -- Extend the contract in place regardless of availability.
      update contracts
         set end_date = v_new_end_date,
             renewal_count = coalesce(renewal_count, 0) + 1,
             renewal_alert_sent_at = null,
             updated_at = v_execution_time,
             notes = coalesce(notes || E'\n\n', '') ||
               'Renewed in place on ' || v_execution_time::date ||
               ' to ' || v_new_end_date
       where id = v_contract.id;

      if (v_availability->>'available')::boolean then
        v_status := 'success';
        if v_active_booking_id is not null then
          update bookings
             set end_date = v_new_end_date,
                 updated_at = v_execution_time
           where id = v_active_booking_id;
        end if;
      else
        v_status := 'success_no_booking';
      end if;

      if v_contract.requires_payment then
        v_payment_terms_days := case v_contract.payment_terms
          when 'net_7'  then  7
          when 'net_15' then 15
          when 'net_30' then 30
          when 'net_60' then 60
          when 'net_90' then 90
          else 30
        end;
        v_due_date := (v_contract.end_date + 1) + v_payment_terms_days;

        insert into payments (
          contract_id, partner_uuid, amount, currency, payment_method,
          payment_status, payment_type, payment_date, due_date,
          period_start, period_end,
          notes, created_by, created_at, updated_at
        ) values (
          v_contract.id, v_contract.partner_uuid, v_contract.service_cost,
          v_contract.service_currency, 'bank_transfer', 'pending', 'full',
          null, v_due_date,
          v_contract.end_date + 1, v_new_end_date,
          'Auto-generated payment for renewal cycle ending ' || v_new_end_date,
          v_system_user_id, v_execution_time, v_execution_time
        );
      end if;

      insert into contract_renewal_log (
        original_contract_id, original_contract_number, renewal_attempt_date,
        renewal_status, new_contract_id, new_contract_number,
        resource_availability_details, partner_uuid
      ) values (
        v_contract.id, v_contract.contract_number, v_execution_time,
        v_status, v_contract.id, v_contract.contract_number,
        v_availability, v_contract.partner_uuid
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
