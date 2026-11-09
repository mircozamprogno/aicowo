// Vercel serverless proxy that forwards requests to the on-router PowerCowo agent.
// Chain: React → /api/mikrotik/<any/path> → agent (:3000) → RouterOS /rest/<any/path>
//
// Required env vars (Production / Preview / Development):
//   MIKROTIK_AGENT_URL     e.g. http://<router-vpn-ip>:3000
//   MIKROTIK_AGENT_SECRET  same value as AGENT_SECRET set on the router container

import { config as loadDotenv } from 'dotenv';

// Local dev: pull from .env.local (what `vercel env pull` writes). Prod: no-op.
loadDotenv({ path: '.env.local' });
loadDotenv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Writes are limited to the WiFi users (User Manager): no reboot, reset or config changes
const WRITE_PATH_PREFIX = '/user-manager/';

// Only a logged-in superadmin, or an admin of a partner with MikroTik enabled, may reach the router.
// Supabase checks the token and RLS limits the reads to the caller's own profile/partner.
async function authorize(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const rest = (path) => fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  }).then(r => (r.ok ? r.json() : null));

  const user = await rest('/auth/v1/user');
  if (!user?.id) return false;
  const [profile] = (await rest(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,partner_uuid`)) || [];
  if (profile?.role === 'superadmin') return true;
  if (profile?.role !== 'admin' || !profile.partner_uuid) return false;
  const [partner] = (await rest(`/rest/v1/partners?partner_uuid=eq.${encodeURIComponent(profile.partner_uuid)}&select=mikrotik_enabled`)) || [];
  return partner?.mikrotik_enabled === true;
}

export default async function handler(req, res) {
  const agentUrl = process.env.MIKROTIK_AGENT_URL;
  const agentSecret = process.env.MIKROTIK_AGENT_SECRET;

  try {
    if (!(await authorize(req))) return res.status(401).json({ error: 'Unauthorized' });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!agentUrl || !agentSecret) {
    return res.status(500).json({
      error: 'MikroTik agent not configured',
      hint: 'Set MIKROTIK_AGENT_URL and MIKROTIK_AGENT_SECRET in the Vercel project.',
    });
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const path = '/' + segments.join('/');
  if (segments.some(seg => seg === '..' || seg.includes('/') || seg.includes('\\'))) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (req.method !== 'GET' && !path.startsWith(WRITE_PATH_PREFIX)) {
    return res.status(403).json({ error: 'Only User Manager changes are allowed' });
  }
  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);
  const body = hasBody ? JSON.stringify(req.body ?? {}) : undefined;

  try {
    const upstream = await fetch(`${agentUrl}${path}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-agent-secret': agentSecret,
      },
      body,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: 'Agent unreachable',
      message: err.message,
      agentUrl,
      path,
    });
  }
}
