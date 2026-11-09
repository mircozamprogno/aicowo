-- Contract lifecycle notifications + calendar-month renewals (2026-11-09)
--
-- Nightly flow (Europe/Zurich):
--   01:00 handle_contract_expiry()  → contract-expired-notifications
--         (contract_expired → customer, contract_expired_partner → partner)
--   02:00 contract-expiry-reminders
--         (expiry_reminder → customer if auto-renew OFF, 3/2/1 days before;
--          renewal_reminder → customer if auto-renew ON, once within the lead window;
--          expiry_reminder_partner → partner, daily list of contracts ending within the lead window;
--          renewal_at_risk → partner, unchanged)
--   04:00 auto_renew_contracts()    → contract-renewal-confirmation
--         (contract_renewed → customer, contract_renewed_partner → partner)
--   05:00 contract-renewal-confirmation again as catch-up for anything not sent at 04:00
--
-- Renewal length: the service period, by calendar months for 30/60/90/180-day
-- services, instead of the custom first-period length.

-- ── Tracking columns ────────────────────────────────────────────────────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS expired_customer_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_partner_notified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at     timestamptz;

ALTER TABLE public.contract_renewal_log
  ADD COLUMN IF NOT EXISTS partner_email_sent_at timestamptz;

-- Don't email about the past: contracts already expired and renewals already
-- logged before this migration count as notified.
UPDATE public.contracts
   SET expired_customer_notified_at = now(),
       expired_partner_notified_at  = now()
 WHERE contract_status = 'expired';

UPDATE public.contract_renewal_log
   SET partner_email_sent_at = coalesce(email_sent_at, now())
 WHERE partner_email_sent_at IS NULL;

-- Contracts whose renewal length was overwritten with the custom first-period
-- length (2026-11-01 backfill) go back to the service period.
UPDATE public.contracts c
   SET service_duration_days = s.duration_days,
       updated_at            = now(),
       notes                 = coalesce(c.notes || E'\n\n', '') ||
         'service_duration_days reset to service period ' || s.duration_days ||
         ' days on 2026-11-09 (renewals follow the service period)'
  FROM public.services s
 WHERE s.id = c.service_id
   AND c.service_type = 'abbonamento'
   AND c.service_duration_days IS DISTINCT FROM s.duration_days
   AND c.notes LIKE '%service_duration_days backfilled%';

-- ── Email template types ────────────────────────────────────────────────────
ALTER TABLE public.email_templates
  DROP CONSTRAINT email_templates_template_type_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type::text = ANY (ARRAY[
    'customer_invitation', 'partner_admin_invitation',
    'customer_booking_confirmation', 'partner_booking_notification',
    'partner_invitation', 'confirmation_email', 'expiry_reminder',
    'contract_creation', 'customer_booking_deleted',
    'contract_renewed', 'renewal_at_risk',
    'vpn_credentials_partner', 'vpn_credentials_customer',
    'door_code_customer',
    'contract_expired', 'contract_expired_partner',
    'expiry_reminder_partner', 'renewal_reminder', 'contract_renewed_partner'
  ]));

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'contract_expired',
  $s$Il tuo contratto è scaduto — {{partner_name}}$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{customer_name}}</strong>,</p>
  <p>ti informiamo che il tuo contratto è scaduto:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Contratto</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{contract_number}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Servizio</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{service_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Scaduto il</td><td style="padding:10px 14px;">{{end_date}}</td></tr>
  </table>
  <p>Per continuare a usare i nostri spazi puoi acquistare un nuovo servizio dalla tua area personale oppure contattare <strong>{{partner_name}}</strong>.</p>
  <p style="margin-top:24px;">A presto,<br><strong>{{partner_name}}</strong></p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'contract_expired_partner',
  $s$Contratto scaduto: {{customer_name}} — {{contract_number}}$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>il seguente contratto è scaduto:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Email</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_email}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Contratto</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{contract_number}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Servizio</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{service_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Scaduto il</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{end_date}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Rinnovo automatico</td><td style="padding:10px 14px;">{{auto_renew}}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:14px;">Il cliente ha ricevuto un'email di avviso. Puoi creare un nuovo contratto dalla sezione <strong>Contratti</strong>.</p>
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">PowerCowo</p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'expiry_reminder_partner',
  $s$Contratti in scadenza nei prossimi {{lead_days}} giorni ({{contracts_count}})$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>ecco i <strong>{{contracts_count}}</strong> contratti che scadono nei prossimi <strong>{{lead_days}}</strong> giorni. Quelli con rinnovo automatico attivo verranno rinnovati il giorno della scadenza; gli altri scadranno.</p>
  {{contracts_table}}
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">PowerCowo</p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'renewal_reminder',
  $s$Il tuo abbonamento si rinnoverà il {{end_date}} — {{partner_name}}$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{customer_name}}</strong>,</p>
  <p>ti ricordiamo che il tuo abbonamento verrà <strong>rinnovato automaticamente</strong> alla scadenza:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Contratto</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{contract_number}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Servizio</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{service_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Data di rinnovo</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{end_date}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Importo</td><td style="padding:10px 14px;">{{amount}}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:14px;">Se non desideri rinnovare, puoi disattivare il rinnovo automatico dalla tua dashboard prima di tale data oppure contattare <strong>{{partner_name}}</strong>.</p>
  <p style="margin-top:24px;">A presto,<br><strong>{{partner_name}}</strong></p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'contract_renewed_partner',
  $s$Contratto rinnovato: {{customer_name}} — {{contract_number}}$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>il seguente contratto è stato <strong>rinnovato automaticamente</strong>:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Contratto</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{contract_number}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Servizio</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{service_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Nuova scadenza</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{new_end_date}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Importo</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{amount}} {{currency}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Rinnovi totali</td><td style="padding:10px 14px;">{{renewal_count}}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:14px;">Il cliente ha ricevuto la conferma del rinnovo. Se previsto, è stato creato un nuovo pagamento in attesa.</p>
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">PowerCowo</p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;


-- ── Renewal by calendar months ─────────────────────────────────────────────
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

-- ── Cron: send the notifications right after expiry (01:00) and renewal (04:00)
SELECT cron.alter_job(11, command := $cron$
  do $$
  declare
    req bigint;
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 1 then
      perform handle_contract_expiry();
      select net.http_post(
        url := 'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/contract-expired-notifications',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'
        )
      ) into req;
    end if;
  end $$;
  $cron$);
SELECT cron.alter_job(9,  command := $cron$
  do $$
  declare
    req bigint;
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 4 then
      perform auto_renew_contracts();
      select net.http_post(
        url := 'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/contract-renewal-confirmation',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'
        )
      ) into req;
    end if;
  end $$;
  $cron$);
