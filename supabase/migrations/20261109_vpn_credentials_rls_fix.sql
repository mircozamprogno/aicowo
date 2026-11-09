-- Fix RLS on customer_vpn_credentials (2026-11-09)
--
-- The original policy used a nested subquery through partners/profiles and was
-- created inside a DO/IF NOT EXISTS block. Partner admins got an empty result
-- (RLS filters silently), so the customer detail page showed
-- "No WiFi access assigned" even though the credential row existed.
-- It also let any authenticated user of the partner (customers included)
-- read every WiFi password.
--
-- Replace it with the same helper-based pattern used by the other tables.

DROP POLICY IF EXISTS "Partners manage own VPN credentials" ON public.customer_vpn_credentials;
DROP POLICY IF EXISTS "Admins manage own partner VPN credentials" ON public.customer_vpn_credentials;
DROP POLICY IF EXISTS "Superadmins manage VPN credentials" ON public.customer_vpn_credentials;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_vpn_credentials TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.customer_vpn_credentials_id_seq TO authenticated;

CREATE POLICY "Admins manage own partner VPN credentials"
  ON public.customer_vpn_credentials
  FOR ALL
  TO authenticated
  USING (public.is_admin() AND partner_uuid = public.get_my_partner_uuid())
  WITH CHECK (public.is_admin() AND partner_uuid = public.get_my_partner_uuid());

CREATE POLICY "Superadmins manage VPN credentials"
  ON public.customer_vpn_credentials
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
