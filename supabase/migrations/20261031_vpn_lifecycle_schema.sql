-- VPN lifecycle schema (2026-10-31)
--
-- 1. Per-partner MikroTik connection settings on the partners table.
-- 2. customer_vpn_credentials — one row per (partner, customer) pair,
--    stores the generated vpn_name, password, and the RouterOS .id
--    needed to delete the user later.

-- ── Partners: MikroTik settings ─────────────────────────────────────────────
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS mikrotik_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mikrotik_agent_url     text,
  ADD COLUMN IF NOT EXISTS mikrotik_agent_secret  text,
  ADD COLUMN IF NOT EXISTS mikrotik_group         text    NOT NULL DEFAULT 'IGY',
  ADD COLUMN IF NOT EXISTS mikrotik_shared_users  text    NOT NULL DEFAULT '5';

-- ── VPN credentials table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_vpn_credentials (
  id            bigserial   PRIMARY KEY,
  partner_uuid  uuid        NOT NULL,
  customer_id   bigint      NOT NULL,
  vpn_name      text        NOT NULL,
  vpn_password  text        NOT NULL,
  mikrotik_id   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  UNIQUE (partner_uuid, customer_id),
  UNIQUE (partner_uuid, vpn_name)
);

CREATE INDEX IF NOT EXISTS idx_vpn_credentials_partner_customer
  ON public.customer_vpn_credentials (partner_uuid, customer_id);

ALTER TABLE public.customer_vpn_credentials ENABLE ROW LEVEL SECURITY;

-- Authenticated partner admins can read/write their own rows.
-- The edge function uses service_role and bypasses RLS entirely.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customer_vpn_credentials'
      AND policyname = 'Partners manage own VPN credentials'
  ) THEN
    CREATE POLICY "Partners manage own VPN credentials"
      ON public.customer_vpn_credentials
      FOR ALL
      TO authenticated
      USING (
        partner_uuid IN (
          SELECT partner_uuid FROM public.partners
          WHERE partner_uuid = customer_vpn_credentials.partner_uuid
            AND id IN (
              SELECT id FROM public.partners
              WHERE partner_uuid = (
                SELECT partner_uuid FROM public.profiles
                WHERE id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;
