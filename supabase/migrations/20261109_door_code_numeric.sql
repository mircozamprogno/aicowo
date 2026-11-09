-- Door code: 6 digits, set manually (2026-11-09)
--
-- The physical door uses a 6-digit numeric code chosen by the partner, so:
-- 1. the code must be 6 digits (was 6 uppercase letters);
-- 2. the auto-generated letter codes are cleared (they never matched a real door);
-- 3. the code is no longer sent in the customer WiFi credentials email.
-- The door position slot is still assigned automatically by vpn-lifecycle.

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS chk_door_code;

UPDATE public.customers
   SET door_code = NULL
 WHERE door_code IS NOT NULL
   AND door_code !~ '^[0-9]{6}$';

ALTER TABLE public.customers
  ADD CONSTRAINT chk_door_code
  CHECK (door_code IS NULL OR door_code ~ '^[0-9]{6}$');

-- Remove the door code row (code + position) and the door code sentence
UPDATE public.email_templates
   SET body_html = regexp_replace(
         regexp_replace(
           body_html,
           '\s*<tr>\s*<td[^>]*>Codice Porta[^<]*</td>\s*<td[^>]*>\{\{door_code\}\}</td>\s*</tr>',
           '', 'g'),
         '\s*Usa il codice porta <strong>\{\{door_code\}\}</strong> per accedere alla struttura\.',
         '', 'g')
 WHERE template_type = 'vpn_credentials_customer'
   AND body_html LIKE '%{{door_code}}%';
