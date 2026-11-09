-- Access cleanup when a customer's last contract ends (expired / closed / archived)
--  a) vpn-lifecycle clears the customer's door code and emails the partner
--     (door_code_cleared_partner) so they disable it on the lock too
--  b) a failed WiFi deletion on the MikroTik router is recorded on the credential
--     and retried every night at 03:00 (Europe/Zurich); after 3 failed attempts
--     the partner is emailed once (wifi_revoke_failed_partner)

ALTER TABLE public.customer_vpn_credentials
  ADD COLUMN IF NOT EXISTS revoke_requested_at        timestamptz,
  ADD COLUMN IF NOT EXISTS revoke_attempts            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revoke_last_error          text,
  ADD COLUMN IF NOT EXISTS revoke_failure_notified_at timestamptz;

COMMENT ON COLUMN public.customer_vpn_credentials.revoke_requested_at IS
  'Set when deleting the WiFi user from the router failed; cleared when the customer gets a new active contract';

CREATE INDEX IF NOT EXISTS idx_vpn_credentials_pending_revoke
  ON public.customer_vpn_credentials (revoke_requested_at)
  WHERE revoked_at IS NULL AND revoke_requested_at IS NOT NULL;

ALTER TABLE public.email_templates
  DROP CONSTRAINT email_templates_template_type_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type::text = ANY (ARRAY[
    'customer_invitation', 'partner_admin_invitation', 'customer_booking_confirmation',
    'partner_booking_notification', 'partner_invitation', 'confirmation_email',
    'expiry_reminder', 'contract_creation', 'customer_booking_deleted', 'contract_renewed',
    'renewal_at_risk', 'vpn_credentials_partner', 'vpn_credentials_customer', 'door_code_customer',
    'contract_expired', 'contract_expired_partner', 'expiry_reminder_partner', 'renewal_reminder',
    'contract_renewed_partner', 'door_code_cleared_partner', 'wifi_revoke_failed_partner'
  ]::text[]));

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'door_code_cleared_partner',
  $s$Codice porta da disattivare: {{customer_name}}$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>l'ultimo contratto attivo di questo cliente è terminato, quindi il suo codice porta è stato <strong>rimosso dalla scheda cliente</strong> ed è di nuovo disponibile:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Email</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_email}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Codice porta</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;"><strong>{{door_code}}</strong></td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Ultimo contratto</td><td style="padding:10px 14px;">{{contract_number}}</td></tr>
  </table>
  <p style="color:#b45309;"><strong>Ricordati di disattivare questo codice anche sulla serratura</strong>: PowerCowo non è collegato alla porta, quindi il codice funziona finché non lo rimuovi tu.</p>
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">PowerCowo</p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT partner_uuid, 'wifi_revoke_failed_partner',
  $s$WiFi non rimosso dal router: {{customer_name}}$s$,
  $b$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>il contratto di questo cliente è terminato ma <strong>non è stato possibile eliminare il suo utente WiFi dal router</strong> MikroTik:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{customer_name}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Utente WiFi</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;"><strong>{{vpn_name}}</strong></td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%;">Tentativi</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{{attempts}}</td></tr>
    <tr><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;">Ultimo errore</td><td style="padding:10px 14px;"><code>{{last_error}}</code></td></tr>
  </table>
  <p style="color:#6b7280;font-size:14px;">L'utente WiFi è ancora attivo. Controlla che il router sia raggiungibile: il sistema riproverà ogni notte; in alternativa eliminalo a mano dalla pagina <strong>MikroTik</strong>.</p>
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">PowerCowo</p>
</div>$b$
FROM public.partners
ON CONFLICT (partner_uuid, template_type) DO NOTHING;


-- Nightly retry of failed WiFi deletions (03:00 Europe/Zurich, same hourly pattern as the other jobs)
SELECT cron.schedule('vpn-revoke-retry', '0 * * * *', $cron$
  do $$
  declare
    req bigint;
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 3 then
      select net.http_post(
        url := 'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/vpn-lifecycle',
        body := '{"action": "retry_revocations"}'::jsonb,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'
        )
      ) into req;
    end if;
  end $$;
$cron$);
