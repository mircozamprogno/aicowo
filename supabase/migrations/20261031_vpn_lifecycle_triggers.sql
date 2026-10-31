-- VPN lifecycle triggers (2026-10-31)
--
-- Fires the vpn-lifecycle edge function asynchronously via pg_net after
-- every contract INSERT (provision) or UPDATE (deprovision).
--
-- Provision triggers when:
--   a new contract is inserted with contract_status = 'active' and is_archived = false
--
-- Deprovision triggers when:
--   contract_status flips to 'expired' or 'cancelled' from 'active'  (cron / any path)
--   OR is_archived flips to true while contract was active           (manual archive)
--
-- The function is EXCEPTION-safe so it never blocks the triggering operation.

CREATE OR REPLACE FUNCTION public.trigger_vpn_lifecycle()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_action  text;
  v_payload jsonb;
  v_token   text;
BEGIN
  -- ── Determine action ──────────────────────────────────────────────────────
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

  -- ── Fire async HTTP call ──────────────────────────────────────────────────
  BEGIN
    SELECT decrypted_secret INTO v_token
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key'
     LIMIT 1;

    v_payload := jsonb_build_object(
      'action',           v_action,
      'contract_id',      NEW.id,
      'contract_number',  NEW.contract_number,
      'customer_id',      NEW.customer_id,
      'partner_uuid',     NEW.partner_uuid
    );

    PERFORM net.http_post(
      url     := 'https://idtwxzccuehxsoipjixf.supabase.co/functions/v1/vpn-lifecycle',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_token
      ),
      body    := v_payload::text
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'vpn-lifecycle trigger failed (non-blocking): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- INSERT trigger
DROP TRIGGER IF EXISTS trg_vpn_provision   ON public.contracts;
CREATE TRIGGER trg_vpn_provision
  AFTER INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_vpn_lifecycle();

-- UPDATE trigger
DROP TRIGGER IF EXISTS trg_vpn_deprovision ON public.contracts;
CREATE TRIGGER trg_vpn_deprovision
  AFTER UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_vpn_lifecycle();
