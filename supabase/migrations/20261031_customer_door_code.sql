-- Customer door code (2026-10-31)
--
-- Each customer can be assigned a 6-letter uppercase door code and a position
-- slot (1-100) that is unique per partner. Assigned automatically on first
-- active contract via the vpn-lifecycle edge function; editable by the partner
-- from the customer edit form.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS door_code     varchar(6),
  ADD COLUMN IF NOT EXISTS door_position smallint;

-- Position must be 1-100
ALTER TABLE public.customers
  ADD CONSTRAINT chk_door_position
  CHECK (door_position IS NULL OR (door_position >= 1 AND door_position <= 100));

-- Code must be 6 uppercase letters when set
ALTER TABLE public.customers
  ADD CONSTRAINT chk_door_code
  CHECK (door_code IS NULL OR door_code ~ '^[A-Z]{6}$');

-- One position per partner (NULLs are not unique, so free slots stay open)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_customer_door_position
  ON public.customers (partner_uuid, door_position)
  WHERE door_position IS NOT NULL;
