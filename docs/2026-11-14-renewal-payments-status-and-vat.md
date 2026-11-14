# 2026-11-14 — Renewal payments: status, view security, VAT

Session notes. Versions V 1.021 – V 1.023.

## Reported problem

"When you renew a contract you duplicate the payment" — after a renewal the
customer has not paid yet, so the renewal payment must be pending.

## Diagnosis

- `auto_renew_contracts()` (nightly, 04:00 Europe/Zurich) was already correct:
  one new payment per renewal, `payment_status = 'pending'`, `payment_date`
  null, `period_start`/`period_end` set to the new cycle. Nothing duplicated.
- The bug was in the **`contract_payment_status` view** used for the payment
  badge in the contracts list, booking hover card, etc. It compared the sum of
  *completed* payments with `service_cost` (one period) and ignored pending
  rows. After a renewal the first period's completed payment already covered
  `service_cost`, so the contract showed **"paid"**, outstanding 0 (or
  negative), never overdue — looking like the payment had been carried over.
- No manual "renew" action exists in the UI; renewals only come from the DB
  function.

## V 1.021 — view counts pending payments

Migration: `supabase/migrations/20261114_payment_status_counts_pending_renewals.sql`

When a contract has pending payments:

- `payment_status` = `partial` (something already paid) or `unpaid`
- `outstanding_amount` = sum of pending payments
- `next_due_date` = earliest pending `due_date`
- `is_overdue` = that date is in the past

Contracts without pending payments keep the old logic. Dry run (rolled back)
showed only the 6 renewed contracts changed (paid → partial). Some are overdue
because the 2026-10-31 retroactive fix created renewal payments with past due
dates.

## V 1.022 — view security

The view had no `security_invoker` and `anon` had full grants, so the **public
anon key could read contract numbers, customer names and amounts of every
partner** (verified with curl).

Migration: `supabase/migrations/20261114_secure_contract_payment_status.sql`

- `alter view ... set (security_invoker = true)` → RLS of contracts,
  customers, payments, payment_plans applies
- revoke all from `anon`; `authenticated` keeps `SELECT` only

Verified: anon → `permission denied`; simulated partner admins of the two
partners see 9 and 1 rows (only their own). All other public views already had
`security_invoker`.

## V 1.023 — VAT on renewal payments

Payments recorded in the app (PaymentForm) are stored gross with
`amount_net` / `amount_vat` / `amount_gross` / `vat_percentage`, VAT taken from
`locations.vat_percentage` (22% on all 4 locations). Renewal payments were net
with no breakdown.

Migration: `supabase/migrations/20261114_renewal_payments_include_vat.sql`

- `auto_renew_contracts()` joins `locations` via `contracts.location_id` and
  inserts `amount = amount_gross = service_cost + VAT`, plus the breakdown.
- Backfill: 153 pending auto-generated payments (`created_by` = system user,
  `amount_gross is null`) updated the same way. Old net amount is preserved in
  `amount_net` (revert possible: `amount = amount_net`, clear breakdown).
- Tested by forcing a renewal in a rolled-back transaction:
  675.00 net → 823.50 gross, pending.

Note: CONT-20260807-0026's first payment was recorded with 0% VAT; its renewal
payment now includes 22%.

## Deploy

All three migrations applied to production via psql
(`supabase/connection.sql`). Commits pushed to `origin/main` (Vercel
production build triggered; commits contain only README + migrations, no app
code).

## Open points

- CONT-20261105-5638 (id 242) is `active` but `is_archived = true`, so it is
  hidden from `contract_payment_status`. Not changed — user: **do not touch
  contracts**.
- `PaymentForm` "remaining amount" still compares with one period's cost; when
  recording a payment on a renewed contract, prefer marking the pending renewal
  payment as paid.
