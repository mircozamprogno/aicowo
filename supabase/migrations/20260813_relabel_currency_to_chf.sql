-- Relabel currency EUR -> CHF (2026-08-13)
--
-- Business decision: amounts were always meant to be Swiss francs.
-- The prior EUR default was a scaffolding mistake. This migration
-- relabels every existing row and updates all column defaults to CHF.
-- No numeric conversion is performed — values stay identical, only the
-- currency code changes.
--
-- Idempotent: rerunning is a no-op once all rows are already CHF.

update public.contracts               set service_currency='CHF' where service_currency='EUR';
update public.payments                set currency='CHF'         where currency='EUR';
update public.services                set currency='CHF'         where currency='EUR';
update public.partners_contracts      set currency='CHF'         where currency='EUR';
update public.partners_payments       set currency='CHF'         where currency='EUR';
update public.partners_pricing_plans  set currency='CHF'         where currency='EUR';

alter table public.contracts              alter column service_currency set default 'CHF';
alter table public.payments               alter column currency         set default 'CHF';
alter table public.services               alter column currency         set default 'CHF';
alter table public.partners_contracts     alter column currency         set default 'CHF';
alter table public.partners_payments      alter column currency         set default 'CHF';
alter table public.partners_pricing_plans alter column currency         set default 'CHF';
