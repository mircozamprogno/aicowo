-- Door code unique per partner (2026-11-09)
--
-- Two customers of the same structure can't share a door code.
-- Different partners may use the same code. NULLs (no code) are allowed.

CREATE UNIQUE INDEX IF NOT EXISTS uidx_customer_door_code
  ON public.customers (partner_uuid, door_code)
  WHERE door_code IS NOT NULL;
