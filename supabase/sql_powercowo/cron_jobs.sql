-- Scheduled jobs (pg_cron) for powercowo
--
-- Idempotent setup script — safe to re-run.
--
-- Prerequisites in the target Supabase project:
--   * pg_cron, pg_net, supabase_vault extensions enabled
--   * SQL functions referenced below exist in `public`:
--       - handle_contract_expiry()
--       - handle_invitation_expiry()
--       - update_expired_contracts()
--       - auto_renew_contracts()
--   * Edge Function `contract-expiry-reminders` deployed
--   * Vault secret named `service_role_key` holds the project's
--     service_role JWT (created with vault.create_secret(...))
--
-- Timezone strategy:
--   pg_cron on Supabase (1.6.x) schedules only in UTC. To pin business
--   jobs to Europe/Zurich local time despite DST, jobs wake up hourly
--   and the DO block gates real work on the local hour. Job 3 stays
--   truly hourly (invitations) and doesn't need this pattern.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- ---------------------------------------------------------------------
-- Vault secret bootstrap (idempotent placeholder)
-- ---------------------------------------------------------------------
-- The actual value MUST be set out-of-band (dashboard or one-off SQL):
--   select vault.create_secret('<SERVICE_ROLE_JWT>', 'service_role_key',
--                              'Service role JWT for edge function cron calls');
-- This block only warns if the secret is missing.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
    raise warning 'vault secret "service_role_key" is missing — cron job 5 will fail until it is created';
  end if;
end $$;

-- Helper: drop a job by name only if it exists (idempotent).
create or replace function pg_temp.drop_cron_if_exists(_name text) returns void as $$
begin
  if exists (select 1 from cron.job where jobname = _name) then
    perform cron.unschedule(_name);
  end if;
end $$ language plpgsql;

-- ---------------------------------------------------------------------
-- Job 1 — update-expired-contracts-daily (04:00 Europe/Zurich)
-- ---------------------------------------------------------------------
select pg_temp.drop_cron_if_exists('update-expired-contracts-daily');

select cron.schedule(
  'update-expired-contracts-daily',
  '0 * * * *',
  $CRON$
  do $$
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 4 then
      perform update_expired_contracts();
    end if;
  end $$;
  $CRON$
);

-- ---------------------------------------------------------------------
-- Job 2 — auto-renew-contracts-daily (04:00 Europe/Zurich)
-- ---------------------------------------------------------------------
select pg_temp.drop_cron_if_exists('auto-renew-contracts-daily');

select cron.schedule(
  'auto-renew-contracts-daily',
  '0 * * * *',
  $CRON$
  do $$
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 4 then
      perform auto_renew_contracts();
    end if;
  end $$;
  $CRON$
);

-- ---------------------------------------------------------------------
-- Job 3 — invitation-expiry-check (every hour, UTC)
-- ---------------------------------------------------------------------
select pg_temp.drop_cron_if_exists('invitation-expiry-check');

select cron.schedule(
  'invitation-expiry-check',
  '0 * * * *',
  $CRON$select handle_invitation_expiry();$CRON$
);

-- ---------------------------------------------------------------------
-- Job 4 — contract-expiry-check (01:00 Europe/Zurich)
-- ---------------------------------------------------------------------
select pg_temp.drop_cron_if_exists('contract-expiry-check');

select cron.schedule(
  'contract-expiry-check',
  '0 * * * *',
  $CRON$
  do $$
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 1 then
      perform handle_contract_expiry();
    end if;
  end $$;
  $CRON$
);

-- ---------------------------------------------------------------------
-- Job 5 — contract-expiry-reminders-daily (02:00 Europe/Zurich)
-- Calls the `contract-expiry-reminders` edge function. Auth token is
-- pulled from Vault at run time so the JWT never lives in cron.job.command.
-- Replace the project ref if applying to a different Supabase project.
-- ---------------------------------------------------------------------
select pg_temp.drop_cron_if_exists('contract-expiry-reminders-daily');

select cron.schedule(
  'contract-expiry-reminders-daily',
  '0 * * * *',
  $CRON$
  do $$
  declare
    req bigint;
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 2 then
      select net.http_post(
        url := 'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/contract-expiry-reminders',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'
        )
      ) into req;
    end if;
  end $$;
  $CRON$
);
