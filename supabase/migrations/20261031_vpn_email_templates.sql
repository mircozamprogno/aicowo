-- Default email templates for VPN lifecycle (2026-10-31)
--
-- Inserted for every partner that already has email_templates rows.
-- Partners can customise these freely from Settings → Email Templates.
--
-- Variables available:
--   vpn_credentials_partner : {{customer_name}} {{vpn_name}} {{contract_number}} {{partner_name}}
--   vpn_credentials_customer: {{customer_name}} {{vpn_name}} {{vpn_password}}    {{partner_name}}

-- Extend the template_type check constraint to allow the two new VPN types
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
    'vpn_credentials_partner', 'vpn_credentials_customer'
  ]));

DO $$
DECLARE
  v_partner uuid;
  v_partners uuid[] := ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '1392b8dc-2e65-442c-a3f0-fc97f3cd187e'::uuid,
    'bc08255b-3ae9-49da-a403-c9453f58847f'::uuid
  ];

  v_subject_partner  text := 'Nuova credenziale WiFi creata — {{customer_name}}';
  v_body_partner     text :=
'<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{partner_name}}</strong>,</p>
  <p>È stata creata automaticamente una nuova credenziale WiFi per il cliente:</p>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:12px 16px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Cliente</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">{{customer_name}}</td>
    </tr>
    <tr>
      <td style="padding:12px 16px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Nome WiFi (login)</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:15px;color:#2563eb;">{{vpn_name}}</td>
    </tr>
    <tr>
      <td style="padding:12px 16px;font-weight:600;color:#374151;">Contratto</td>
      <td style="padding:12px 16px;">{{contract_number}}</td>
    </tr>
  </table>

  <p style="color:#6b7280;font-size:14px;">
    Il cliente ha ricevuto separatamente un''email con la password di accesso.
    Puoi verificare o revocare le credenziali dalla sezione <strong>Clienti</strong> dell''applicazione.
  </p>

  <p style="margin-top:24px;">Cordiali saluti,<br><strong>{{partner_name}}</strong> via PowerCowo</p>
</div>';

  v_subject_customer  text := 'Le tue credenziali WiFi — {{partner_name}}';
  v_body_customer     text :=
'<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <p style="font-size:16px;">Ciao <strong>{{customer_name}}</strong>,</p>
  <p>Il tuo account WiFi è stato attivato. Ecco i tuoi dati di accesso:</p>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:14px 18px;font-weight:600;color:#0369a1;border-bottom:1px solid #bae6fd;width:40%;">Nome utente (login)</td>
      <td style="padding:14px 18px;border-bottom:1px solid #bae6fd;font-family:monospace;font-size:16px;letter-spacing:0.5px;color:#1e40af;">{{vpn_name}}</td>
    </tr>
    <tr>
      <td style="padding:14px 18px;font-weight:600;color:#0369a1;width:40%;">Password</td>
      <td style="padding:14px 18px;font-family:monospace;font-size:16px;letter-spacing:0.5px;color:#1e40af;">{{vpn_password}}</td>
    </tr>
  </table>

  <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin:20px 0;font-size:14px;color:#854d0e;">
    <strong>⚠️ Conserva questa email.</strong> La password non può essere recuperata in seguito.
    In caso di smarrimento contatta <strong>{{partner_name}}</strong>.
  </div>

  <p style="color:#6b7280;font-size:14px;">
    Utilizza queste credenziali per connetterti alla rete WiFi della struttura.
  </p>

  <p style="margin-top:24px;">A presto,<br><strong>{{partner_name}}</strong></p>
</div>';

BEGIN
  FOREACH v_partner IN ARRAY v_partners LOOP

    INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
    VALUES (v_partner, 'vpn_credentials_partner', v_subject_partner, v_body_partner)
    ON CONFLICT (partner_uuid, template_type) DO NOTHING;

    INSERT INTO public.email_templates (partner_uuid, template_type, subject_line, body_html)
    VALUES (v_partner, 'vpn_credentials_customer', v_subject_customer, v_body_customer)
    ON CONFLICT (partner_uuid, template_type) DO NOTHING;

  END LOOP;
END $$;
