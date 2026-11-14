-- Renewal payments include VAT.
--
-- auto_renew_contracts() created renewal payments with amount = service_cost
-- (net) and no VAT breakdown, while payments recorded in the app store the
-- gross amount plus amount_net / amount_vat / amount_gross / vat_percentage.
-- Renewal payments now apply the VAT of the contract's location (22% on all
-- locations today), the same way PaymentForm does.
--
-- Backfill: pending auto-generated payments without a VAT breakdown get the
-- same treatment.

CREATE OR REPLACE FUNCTION public.auto_renew_contracts()
 RETURNS TABLE(total_processed integer, successful_renewals integer, failed_renewals integer, execution_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  v_vat_percentage       numeric;
  v_amount_vat           numeric;
begin
  for v_contract in
    select c.*, s.duration_days as service_default_duration_days, s.location_resource_id,
           coalesce(l.vat_percentage, 0) as location_vat_percentage
    from contracts c
    inner join services s on c.service_id = s.id
    left join locations l on l.id = c.location_id
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
      -- Renew by the service period (snapshot on the contract, else service
      -- default). A custom end date only aligns the first period.
      v_duration_days        := coalesce(
                                  v_contract.service_duration_days,
                                  v_contract.service_default_duration_days
                                )::integer;
      -- Month-based periods (30/60/90/180 days) renew by calendar months so the
      -- end date keeps the same day of the month; yearly by one year; else days.
      if v_duration_days >= 30 and v_duration_days % 30 = 0 then
        v_new_end_date := (v_contract.end_date + make_interval(months => v_duration_days / 30))::date;
      elsif v_duration_days in (365, 366) then
        v_new_end_date := (v_contract.end_date + interval '1 year')::date;
      else
        v_new_end_date := v_contract.end_date + v_duration_days;
      end if;
      v_location_resource_id := v_contract.location_resource_id;

      -- No resource on this service: extend the contract but skip the booking.
      if v_location_resource_id is null then

        update contracts
           set end_date              = v_new_end_date,
               renewal_count         = coalesce(renewal_count, 0) + 1,
               renewal_alert_sent_at = null,
               renewal_reminder_sent_at = null,
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
          v_vat_percentage := v_contract.location_vat_percentage;
          v_amount_vat := round(v_contract.service_cost * v_vat_percentage / 100, 2);

          insert into payments (
            contract_id, partner_uuid, amount, amount_net, amount_vat, amount_gross,
            vat_percentage, currency, payment_method,
            payment_status, payment_type, payment_date, due_date,
            period_start, period_end,
            notes, created_by, created_at, updated_at
          ) values (
            v_contract.id, v_contract.partner_uuid, v_contract.service_cost + v_amount_vat,
            v_contract.service_cost, v_amount_vat, v_contract.service_cost + v_amount_vat,
            v_vat_percentage, v_contract.service_currency, 'bank_transfer', 'pending', 'full',
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
               renewal_reminder_sent_at = null,
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
        v_vat_percentage := v_contract.location_vat_percentage;
        v_amount_vat := round(v_contract.service_cost * v_vat_percentage / 100, 2);

        insert into payments (
          contract_id, partner_uuid, amount, amount_net, amount_vat, amount_gross,
          vat_percentage, currency, payment_method,
          payment_status, payment_type, payment_date, due_date,
          period_start, period_end,
          notes, created_by, created_at, updated_at
        ) values (
          v_contract.id, v_contract.partner_uuid, v_contract.service_cost + v_amount_vat,
          v_contract.service_cost, v_amount_vat, v_contract.service_cost + v_amount_vat,
          v_vat_percentage, v_contract.service_currency, 'bank_transfer', 'pending', 'full',
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
$function$

;

update payments p
   set vat_percentage = coalesce(l.vat_percentage, 0),
       amount_net     = p.amount,
       amount_vat     = round(p.amount * coalesce(l.vat_percentage, 0) / 100, 2),
       amount_gross   = p.amount + round(p.amount * coalesce(l.vat_percentage, 0) / 100, 2),
       amount         = p.amount + round(p.amount * coalesce(l.vat_percentage, 0) / 100, 2),
       updated_at     = now()
  from contracts c
  left join locations l on l.id = c.location_id
 where c.id = p.contract_id
   and p.payment_status = 'pending'
   and p.created_by = '11111111-1111-1111-1111-111111111111'
   and p.amount_gross is null;
