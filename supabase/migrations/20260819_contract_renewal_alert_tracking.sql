-- Renewal alert tracking (2026-08-19)
--
-- 1. contracts.renewal_alert_sent_at — the preflight edge function
--    stamps this once per upcoming renewal cycle so we don't email
--    the partner every day for 7 days.
-- 2. contract_renewal_log.email_sent_at — the renewal confirmation
--    edge function stamps this so we don't email customers twice.
-- 3. contract_renewal_log.renewal_status gains 'success_no_booking' —
--    contract extended in place, booking NOT extended because the
--    resource was unavailable for the extension window.
-- 4. partners.renewal_alert_lead_days — per-partner preflight lead time.

alter table public.contracts
  add column if not exists renewal_alert_sent_at timestamptz;

comment on column public.contracts.renewal_alert_sent_at is
  'Stamped when the preflight availability check emailed the partner admin. Reset to null on successful booking extension.';

alter table public.contract_renewal_log
  add column if not exists email_sent_at timestamptz;

comment on column public.contract_renewal_log.email_sent_at is
  'Stamped when the customer renewal-confirmation email has been sent.';

-- Extend renewal_status. Constraint name and existing values verified
-- against live prod via pg_get_constraintdef.
alter table public.contract_renewal_log
  drop constraint if exists chk_renewal_status;

alter table public.contract_renewal_log
  add constraint chk_renewal_status
  check (renewal_status::text = any (array[
    'success'::text,
    'success_no_booking'::text,
    'failed_no_availability'::text,
    'failed_booking_error'::text,
    'failed_payment_error'::text,
    'failed_error'::text
  ]));

alter table public.partners
  add column if not exists renewal_alert_lead_days integer not null default 7;

comment on column public.partners.renewal_alert_lead_days is
  'How many days before contract end_date to run the auto-renewal preflight availability check and alert this partner admin if the resource is unavailable.';
