-- contract_payment_status ran with its owner's rights (no security_invoker),
-- bypassing RLS: the anon key could read contract numbers, customer names and
-- paid amounts of every partner. Run it with the caller's rights so the RLS of
-- contracts/customers/payments/payment_plans applies, and drop anon access.

alter view public.contract_payment_status set (security_invoker = true);

revoke all on public.contract_payment_status from anon;
revoke all on public.contract_payment_status from authenticated;
grant select on public.contract_payment_status to authenticated;
