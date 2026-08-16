-- Renewal-related email templates (2026-08-18)
--
-- 1. contract_renewed  → sent to the customer after a successful renewal
-- 2. renewal_at_risk   → sent to the partner admin when the daily preflight
--    detects that the resource will not be available for the upcoming
--    renewal window
--
-- Extends the email_templates.template_type check constraint and seeds one
-- default row per partner per type so send-email won't fall through to a
-- generic fallback.

alter table public.email_templates
  drop constraint email_templates_template_type_check;

alter table public.email_templates
  add constraint email_templates_template_type_check
  check (template_type::text = any (array[
    'customer_invitation'::text,
    'partner_admin_invitation'::text,
    'customer_booking_confirmation'::text,
    'partner_booking_notification'::text,
    'partner_invitation'::text,
    'confirmation_email'::text,
    'expiry_reminder'::text,
    'contract_creation'::text,
    'customer_booking_deleted'::text,
    'contract_renewed'::text,
    'renewal_at_risk'::text
  ]));

insert into public.email_templates
  (partner_uuid, template_type, subject_line, body_html)
select p.partner_uuid,
       'contract_renewed',
       'Il tuo contratto {{contract_number}} è stato rinnovato',
       '<p>Ciao {{customer_name}},</p>' ||
       '<p>Il tuo contratto <strong>{{contract_number}}</strong> con {{partner_name}} è stato rinnovato automaticamente.</p>' ||
       '<p>La nuova scadenza è <strong>{{new_end_date}}</strong>.</p>' ||
       '<p>Importo del rinnovo: <strong>{{amount}} {{currency}}</strong>.</p>' ||
       '<p>Grazie,<br>{{partner_name}}</p>'
  from public.partners p
 where not exists (
   select 1 from public.email_templates t
    where t.partner_uuid = p.partner_uuid
      and t.template_type = 'contract_renewed'
 );

insert into public.email_templates
  (partner_uuid, template_type, subject_line, body_html)
select p.partner_uuid,
       'renewal_at_risk',
       'Attenzione: rinnovo contratto {{contract_number}} senza risorsa disponibile',
       '<p>Ciao,</p>' ||
       '<p>Il contratto <strong>{{contract_number}}</strong> di {{customer_name}} si rinnoverà tra {{days_until_renewal}} giorni ' ||
       'ma la risorsa <em>{{resource_name}}</em> non risulta disponibile per il periodo successivo.</p>' ||
       '<p>Ti consigliamo di riassegnare una risorsa al contratto prima del {{end_date}}.</p>' ||
       '<p>Grazie,<br>PowerCowo</p>'
  from public.partners p
 where not exists (
   select 1 from public.email_templates t
    where t.partner_uuid = p.partner_uuid
      and t.template_type = 'renewal_at_risk'
 );
