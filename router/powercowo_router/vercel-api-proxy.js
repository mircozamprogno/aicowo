// api/mikrotik/[...path].js
// Vercel serverless function - proxies to the on-router agent via VPN tunnel

export default async function handler(req, res) {
  const agentUrl = process.env.MIKROTIK_AGENT_URL; // e.g. http://10.8.0.1:3000
  const agentSecret = process.env.MIKROTIK_AGENT_SECRET;

  if (!agentUrl || !agentSecret) {
    return res.status(500).json({ error: 'Agent not configured' });
  }

  const path = '/' + (req.query.path || []).join('/');

  const body = ['GET', 'DELETE'].includes(req.method)
    ? undefined
    : JSON.stringify(req.body);

  const upstream = await fetch(`${agentUrl}${path}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-agent-secret': agentSecret,
    },
    body,
  });

  const data = await upstream.json();
  return res.status(upstream.status).json(data);
}
