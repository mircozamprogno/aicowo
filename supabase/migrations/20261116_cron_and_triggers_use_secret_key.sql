-- Move pg_cron jobs and the vpn-lifecycle trigger from the legacy service_role JWT to the new secret key.
-- The edge functions they call now run with verify_jwt = false and check the `apikey` header
-- (supabase/functions/_shared/secretKeyOnly.ts).
--
-- Prerequisite (out-of-band, never committed): the Vault secret `secret_key` holds the sb_secret_… key:
--   select vault.create_secret('<sb_secret_...>', 'secret_key', 'Secret API key for edge function cron/trigger calls');

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'secret_key') then
    raise exception 'vault secret "secret_key" is missing';
  end if;
end $$;

-- Cron jobs: swap the Authorization header for the apikey header
select cron.alter_job(
  jobid,
  command := replace(
    command,
    $$'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')$$,
    $$'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')$$
  )
)
from cron.job
where command like '%service_role_key%';

do $$
begin
  if exists (select 1 from cron.job where command like '%service_role_key%') then
    raise exception 'a cron job still references service_role_key';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.trigger_vpn_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_action  text;
  v_payload jsonb;
  v_token   text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.contract_status = 'active' AND NOT NEW.is_archived THEN
      v_action := 'provision';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.contract_status IN ('expired', 'cancelled')
       AND OLD.contract_status = 'active' THEN
      v_action := 'deprovision';
    ELSIF NEW.is_archived = true
          AND OLD.is_archived = false
          AND OLD.contract_status = 'active' THEN
      v_action := 'deprovision';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_token
      FROM vault.decrypted_secrets
     WHERE name = 'secret_key'
     LIMIT 1;

    v_payload := jsonb_build_object(
      'action',           v_action,
      'contract_id',      NEW.id,
      'contract_number',  NEW.contract_number,
      'customer_id',      NEW.customer_id,
      'partner_uuid',     NEW.partner_uuid
    );

    -- Correct signature: net.http_post(url, body jsonb, params jsonb, headers jsonb)
    PERFORM net.http_post(
      'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/vpn-lifecycle',
      v_payload,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type',  'application/json',
        'apikey',        v_token
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'vpn-lifecycle trigger failed (non-blocking): %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
