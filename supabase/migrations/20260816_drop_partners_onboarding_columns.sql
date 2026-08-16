-- Drop onboarding feature columns from partners (2026-08-16)
--
-- The onboarding tour/welcome-modal feature has been removed from the app.
-- These columns and their supporting index are no longer read or written.

drop index if exists public.idx_partners_onboarding_completed;

alter table public.partners drop column if exists onboarding_completed;
alter table public.partners drop column if exists onboarding_steps;
