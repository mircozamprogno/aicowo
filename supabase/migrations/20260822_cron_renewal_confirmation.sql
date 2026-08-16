-- Cron: contract-renewal-confirmation (05:00 Europe/Zurich) (2026-08-22)
--
-- Runs one hour after auto_renew_contracts() (Job 2, 04:00) to email the
-- customer for every successful renewal that hasn't been notified yet.
-- Follows the same "hourly cron gated on the target hour in Europe/Zurich"
-- pattern used by the other jobs in cron_jobs.sql.

do $$
begin
  perform cron.unschedule('contract-renewal-confirmation-daily');
exception when others then null;
end $$;

select cron.schedule(
  'contract-renewal-confirmation-daily',
  '0 * * * *',
  $CRON$
  do $$
  declare
    req bigint;
  begin
    if extract(hour from (now() at time zone 'Europe/Zurich')) = 5 then
      select net.http_post(
        url := 'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/contract-renewal-confirmation',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'
        )
      ) into req;
    end if;
  end $$;
  $CRON$
);
