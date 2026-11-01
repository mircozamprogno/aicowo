-- Fix auto_renew_contracts() to respect custom contract duration (2026-11-01)
--
-- Bug: the renewal function always extended contracts by s.duration_days
-- (the service default), ignoring c.service_duration_days — the per-contract
-- snapshot. For contracts created with a manually overridden end date the
-- service default was stored in service_duration_days anyway (ContractForm
-- bug fixed in the same commit), so both bugs compounded: the stored value
-- was wrong AND the function didn't read it.
--
-- Fix 1 (this file): auto_renew_contracts() now uses
--   coalesce(c.service_duration_days, s.duration_days)
-- so the contract's own stored duration takes precedence.
--
-- Fix 2 (this file): backfill service_duration_days for active contracts
-- that have never been renewed (renewal_count = 0) and whose stored
-- service_duration_days doesn't match the actual end_date − start_date.
-- For those rows the actual period is still readable from the dates.
-- Contracts with renewal_count > 0 are skipped — their end_date has
-- already been extended and the original custom period can't be recovered.

-- ── Part 1: backfill service_duration_days for un-renewed custom-duration contracts ──

UPDATE contracts
SET
  service_duration_days = (end_date - start_date),
  updated_at            = now(),
  notes                 = coalesce(notes || E'\n\n', '') ||
    'service_duration_days backfilled to ' || (end_date - start_date) ||
    ' days on 2026-11-01 (was incorrectly stored as service default)'
WHERE
  service_type        = 'abbonamento'
  AND is_renewable    = true
  AND auto_renew      = true
  AND is_archived     = false
  AND contract_status = 'active'
  AND coalesce(renewal_count, 0) = 0
  AND (end_date - start_date) <> service_duration_days::integer;

-- ── Part 2: fix auto_renew_contracts() ──

create or replace function public.auto_renew_contracts()
 returns table(total_processed integer, successful_renewals integer, failed_renewals integer, execution_time timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_contract             record;
  v_active_booking_id    bigint;
  v_new_end_date         date;
  v_location_resource_id bigint;
  v_duration_days        integer;
  v_availability         jsonb;
  v_status               text;
  v_total_processed      integer := 0;
  v_successful_renewals  integer := 0;
  v_failed_renewals      integer := 0;
  v_execution_time       timestamp with time zone := now();
  v_system_user_id       uuid := '11111111-1111-1111-1111-111111111111';
  v_payment_terms_days   integer;
  v_due_date             date;
begin
  for v_contract in
    select c.*, s.duration_days as service_default_duration_days, s.location_resource_id
    from contracts c
    inner join services s on c.service_id = s.id
    where c.end_date = current_date
      and c.auto_renew = true
      and c.is_renewable = true
      and c.contract_status = 'active'
      and c.service_type = 'abbonamento'
      and c.is_archived = false
  loop
    v_total_processed      := v_total_processed + 1;
    v_active_booking_id    := null;

    begin
      -- Prefer the per-contract stored duration over the service default so
      -- contracts created with a custom end date renew for the correct period.
      v_duration_days        := coalesce(
                                  v_contract.service_duration_days,
                                  v_contract.service_default_duration_days
                                )::integer;
      v_new_end_date         := v_contract.end_date + v_duration_days;
      v_location_resource_id := v_contract.location_resource_id;

      -- No resource on this service: extend the contract but skip the booking.
      if v_location_resource_id is null then

        update contracts
           set end_date              = v_new_end_date,
               renewal_count         = coalesce(renewal_count, 0) + 1,
               renewal_alert_sent_at = null,
               updated_at            = v_execution_time,
               notes                 = coalesce(notes || E'\n\n', '') ||
                 'Renewed in place on ' || v_execution_time::date ||
                 ' to ' || v_new_end_date ||
                 ' (no resource assigned on service ' || v_contract.service_id || ')'
         where id = v_contract.id;

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
          'success_no_booking', v_contract.id, v_contract.contract_number,
          jsonb_build_object(
            'reason',     'no_resource_on_service',
            'service_id', v_contract.service_id
          ),
          v_contract.partner_uuid
        );

        v_successful_renewals := v_successful_renewals + 1;
        continue;
      end if;

      -- Resource exists: check availability for the extension window.
      select id into v_active_booking_id
        from bookings
       where contract_id  = v_contract.id
         and booking_status = 'active'
         and is_archived    = false
       limit 1;

      v_availability := check_resource_availability(
        v_location_resource_id,
        v_contract.end_date + 1,
        v_new_end_date,
        v_active_booking_id
      );

      -- Extend the contract in place regardless of availability.
      update contracts
         set end_date              = v_new_end_date,
             renewal_count         = coalesce(renewal_count, 0) + 1,
             renewal_alert_sent_at = null,
             updated_at            = v_execution_time,
             notes                 = coalesce(notes || E'\n\n', '') ||
               'Renewed in place on ' || v_execution_time::date ||
               ' to ' || v_new_end_date
       where id = v_contract.id;

      if (v_availability->>'available')::boolean then
        v_status := 'success';
        if v_active_booking_id is not null then
          update bookings
             set end_date   = v_new_end_date,
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
