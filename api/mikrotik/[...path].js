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

export default async function handler(req, res) {
  const agentUrl = process.env.MIKROTIK_AGENT_URL;
  const agentSecret = process.env.MIKROTIK_AGENT_SECRET;

  if (!agentUrl || !agentSecret) {
    return res.status(500).json({
      error: 'MikroTik agent not configured',
      hint: 'Set MIKROTIK_AGENT_URL and MIKROTIK_AGENT_SECRET in the Vercel project.',
    });
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const path = '/' + segments.join('/');
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
