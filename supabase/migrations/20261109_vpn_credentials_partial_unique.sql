-- VPN credentials: uniqueness only among active (non-revoked) rows (2026-11-09)
--
-- The original UNIQUE (partner_uuid, customer_id) also counted revoked rows,
-- so once a customer's WiFi was revoked, re-provisioning (new contract) or
-- re-linking created the user on the router but failed the DB insert —
-- leaving a router user not associated with any customer.

ALTER TABLE public.customer_vpn_credentials
  DROP CONSTRAINT IF EXISTS customer_vpn_credentials_partner_uuid_customer_id_key,
  DROP CONSTRAINT IF EXISTS customer_vpn_credentials_partner_uuid_vpn_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vpn_credentials_active_customer
  ON public.customer_vpn_credentials (partner_uuid, customer_id)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vpn_credentials_active_name
  ON public.customer_vpn_credentials (partner_uuid, vpn_name)
  WHERE revoked_at IS NULL;
