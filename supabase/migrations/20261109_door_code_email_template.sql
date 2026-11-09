-- Door code email template (2026-11-09)
--
-- New template type door_code_customer: sent from the customer form when the
-- partner saves the door code with "send by email" checked.
-- Variables: {{customer_name}} {{door_code}} {{partner_name}}

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
    'door_code_customer'
  ]));

INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
SELECT DISTINCT partner_uuid, 'door_code_customer',
  $subj$Il tuo codice porta — {{partner_name}}$subj$,
  $body$<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{customer_name}}</strong>,</p>
  <p>Ecco il tuo codice di accesso alla struttura:</p>
  <div style="text-align:center;margin:24px 0;padding:20px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
    <div style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#1e40af;">{{door_code}}</div>
  </div>
  <p style="color:#6b7280;font-size:14px;">Il codice è personale: non condividerlo con altri. In caso di problemi contatta <strong>{{partner_name}}</strong>.</p>
  <p style="margin-top:24px;">A presto,<br><strong>{{partner_name}}</strong></p>
</div>$body$
FROM public.email_templates
ON CONFLICT (partner_uuid, template_type) DO NOTHING;
