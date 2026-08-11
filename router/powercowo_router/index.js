// mikrotik-agent/index.js
// Runs inside the MikroTik container
// Proxies authenticated requests from Vercel to the RouterOS REST API

import http from 'http';
import https from 'https';

const PORT = process.env.PORT || 3000;
const AGENT_SECRET = process.env.AGENT_SECRET;
const ROUTER_IP = process.env.ROUTER_IP || '172.18.0.1';
const ROUTER_USER = process.env.ROUTER_USER;
const ROUTER_PASS = process.env.ROUTER_PASS;

if (!AGENT_SECRET || !ROUTER_USER || !ROUTER_PASS) {
  console.error('Missing required env vars: AGENT_SECRET, ROUTER_USER, ROUTER_PASS');
  process.exit(1);
}

const routerAuth = 'Basic ' + Buffer.from(`${ROUTER_USER}:${ROUTER_PASS}`).toString('base64');

async function callRouter(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: ROUTER_IP,
      port: 80,
      path: `/rest${path}`,
      method,
      headers: {
        'Authorization': routerAuth,
        'Content-Type': 'application/json',
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
      },
      // Self-signed cert — skip verification for local call
      rejectUnauthorized: false,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // Auth check
  if (req.headers['x-agent-secret'] !== AGENT_SECRET) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  // Parse body
  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(r => req.on('end', r));

  const url = new URL(req.url, `http://localhost`);
  const routerPath = url.pathname; // e.g. /ppp/secret or /interface/wireguard/peers

  try {
    const parsed = body ? JSON.parse(body) : undefined;
    const result = await callRouter(req.method, routerPath, parsed);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => console.log(`PowerCowo agent listening on :${PORT}`));
