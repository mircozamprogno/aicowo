import { supabase } from './supabase';

// Partner secrets live in partner_secrets (readable by the partner's admins and superadmins only).
// Writes through partners.* are moved there by a DB trigger.
export const fetchPartnerSecrets = async (partnerUuid) => {
  if (!partnerUuid) return {};
  const { data } = await supabase
    .from('partner_secrets')
    .select('mikrotik_agent_secret, fattureincloud_api_token')
    .eq('partner_uuid', partnerUuid)
    .maybeSingle();
  return data || {};
};

// Overlays the secrets on a partners row (the old columns are blank)
export const withPartnerSecrets = async (partnerUuid, row) => {
  const secrets = await fetchPartnerSecrets(partnerUuid);
  return {
    ...row,
    ...Object.fromEntries(Object.entries(secrets).filter(([key, value]) => value && key in row))
  };
};
