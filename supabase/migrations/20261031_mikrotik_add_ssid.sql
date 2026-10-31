-- Add mikrotik_ssid to partners (2026-10-31)
-- The WiFi network name (SSID) the customer must select when connecting
-- with the credentials sent by the vpn-lifecycle edge function.
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS mikrotik_ssid text;
