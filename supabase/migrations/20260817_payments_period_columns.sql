-- Payments: add billing-period columns (2026-08-17)
--
-- With the upcoming renewal-in-place refactor, one contract will accrue
-- multiple payments (one per billing cycle). These columns record which
-- cycle each payment covers. Nullable for backward compatibility.

alter table public.payments
  add column if not exists period_start date,
  add column if not exists period_end   date;

comment on column public.payments.period_start is
  'Start of the billing period this payment covers. Nullable for legacy rows.';
comment on column public.payments.period_end is
  'End of the billing period this payment covers. Nullable for legacy rows.';

-- Backfill: for existing payments, mirror the parent contract window.
-- Legacy model was one-payment-per-contract, so this is unambiguous.
update public.payments p
   set period_start = c.start_date,
       period_end   = c.end_date
  from public.contracts c
 where p.contract_id = c.id
   and p.period_start is null;
