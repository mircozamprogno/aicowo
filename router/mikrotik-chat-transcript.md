# PowerCowo — MikroTik Integration Chat Transcript

> Session exported for use with Claude Code

---

## Q: Are you able to understand which API to use to configure automatically from an application this router?

https://mikrotik.com/product/hap_ax3

### A:

The MikroTik hAP ax3 runs **RouterOS v7**, which has a **native built-in REST API** — no extra software needed.

There are two API options:

**1. RouterOS REST API (recommended)**

Standard HTTP/HTTPS API. Authenticate with username/password and call endpoints like `https://<router-ip>/rest/...`

```js
const res = await fetch(`https://${routerIp}/rest/ip/hotspot/user`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${user}:${password}`)
  },
  body: JSON.stringify({ name: 'customer1', password: 'pass', profile: 'default' })
});
```

Key endpoints relevant to PowerCowo:
- `GET /rest/interface` — list interfaces
- `POST /rest/ip/hotspot/user` — create hotspot user (WiFi access tied to contract)
- `DELETE /rest/ip/hotspot/user/*id` — revoke access on contract expiry
- `POST /rest/ip/hotspot/user/profile` — manage bandwidth profiles per plan

**2. RouterOS TCP API (port 8728/8729)**

Older binary TCP API. More powerful but requires a dedicated library and harder to call from serverless functions.

**Architecture recommendation:** Since the project is on Vercel + Supabase Edge Functions, the REST API is the right choice. The router is on a private LAN, so calls should be routed through a **Supabase Edge Function** (not directly from React), storing per-partner MikroTik credentials in a `partner_integrations` table.

---

## Q: Can I use the Vercel /api backend function?

### A:

**No.** Vercel serverless functions run on Vercel's cloud infrastructure (AWS Lambda). They have no network path to a MikroTik router sitting on a **private LAN** (e.g. `192.168.1.1`).

```
Vercel cloud  ──✗──→  192.168.1.1 (MikroTik)
```

**Options:**

| Option | How | Complexity |
|---|---|---|
| **Local bridge agent** | Small Node.js script on-site (on the router itself or a Raspberry Pi) that exposes a webhook Vercel can call | Low |
| **Supabase Edge Function** | Same problem — still cloud, not LAN | ✗ |
| **Reverse tunnel** | ngrok, Cloudflare Tunnel, or frp expose the router REST API to a public URL | Medium |
| **VPN** | Connect Vercel functions via WireGuard to LAN — complex for serverless | High |

**Simplest solution:** A lightweight on-site agent (Node.js) running on a small device at the coworking location:

```
React app → Vercel /api → HTTPS → [on-site agent] → MikroTik REST API
                              (ngrok / Cloudflare Tunnel)
```

---

## Q: Wait, does it mean that we can run Node.js directly inside the router?

### A:

Yes — even better than Node.js directly. RouterOS v7 has a native **Container** feature (MikroTik's implementation of Linux containers), compatible with images from Docker Hub. The hAP ax3 uses ARM64 architecture and supports this fully.

```
React app → Vercel /api → HTTPS → MikroTik hAP ax3 port 3000
                                    └─ Node.js container (on the router itself)
                                         └─ RouterOS REST API (localhost)
```

**Key facts:**
- The hAP ax3 is confirmed to run containers
- A lightweight Node.js agent uses minimal CPU
- Needs physical access **once** to enable container mode, then fully remote
- External USB storage recommended (hAP ax3 has a USB port)
- Container can be reached via a Cloudflare Tunnel — no port forwarding needed

---

## Q: My question is: how can I install and configure the container inside the router? The customer gave me a VPN tunnel to enter the router from external access — can I use that tunnel to configure the container?

### A:

**Yes** — since VPN tunnel access already exists, almost everything can be done remotely via SSH. There is only **one step that needs physical coordination**.

**Full process:**

**Step 1 — Install container package** *(remote, via SSH)*

Since RouterOS v7.18 you can install extra packages directly from the router:

```bash
ssh admin@<router-vpn-ip>
/system/package/update/check-for-updates
/system/package/install container
/system/reboot
```

**Step 2 — Enable container mode** ⚠️ *one physical action required*

```bash
/system/device-mode/update container=yes
```

After this command, RouterOS waits for a physical confirmation (power cycle) within 5 minutes. Ask the customer to unplug and replug the router once. This is a **one-time operation**.

**Step 3 — Everything else is fully remote**

After that single physical action, all container management is done remotely via SSH or REST API.

| Step | Remote via VPN? |
|---|---|
| Install container package | ✅ Yes |
| Enable container mode | ⚠️ Needs one physical power cycle |
| Pull & run containers | ✅ Yes |
| Manage containers forever after | ✅ Yes |

---

## Q: Yes (produce the full SSH setup script)

### A:

Three files were produced:

---

### File 1: `mikrotik-setup/01_routeros_setup.rsc`

RouterOS CLI script — run via SSH in blocks:

```
# BLOCK 1: Install container package (then reboot)
/system/package/update/check-for-updates
/system/package/install container
/system/reboot
# Wait for router to come back up, then SSH again

# BLOCK 2: Enable container mode
# After this command, ask customer to unplug/replug router within 5 min
/system/device-mode/update container=yes
# >>> CUSTOMER MUST POWER CYCLE THE ROUTER NOW <<<
# SSH back in after reboot

# BLOCK 3: Configure storage (USB stick required)
/disk/print
# Note disk name (disk1 or usb1 etc)
/file/make-directory disk1/containers
/file/make-directory disk1/containers/powercowo-agent

# BLOCK 4: Create virtual network for container
/interface/veth/add name=veth-agent address=172.18.0.2/24 gateway=172.18.0.1
/interface/bridge/add name=bridge-containers
/ip/address/add address=172.18.0.1/24 interface=bridge-containers
/interface/bridge/port/add bridge=bridge-containers interface=veth-agent

# Allow container to reach internet
/ip/firewall/nat/add chain=srcnat action=masquerade src-address=172.18.0.0/24 comment="Container NAT"

# BLOCK 5: Expose agent port via NAT
/ip/firewall/nat/add \
  chain=dstnat \
  protocol=tcp \
  dst-port=3000 \
  in-interface=all \
  action=dst-nat \
  to-addresses=172.18.0.2 \
  to-ports=3000 \
  comment="PowerCowo Agent"

# BLOCK 6: Set registry and environment variables
/container/config/set registry-url=https://registry-1.docker.io tmpdir=disk1/tmp

/container/envs/add list=powercowo key=AGENT_SECRET value="CHANGE_ME_STRONG_SECRET"
/container/envs/add list=powercowo key=ROUTER_IP value="172.18.0.1"
/container/envs/add list=powercowo key=ROUTER_USER value="powercowo-api"
/container/envs/add list=powercowo key=ROUTER_PASS value="CHANGE_ME_ROUTER_PASS"
/container/envs/add list=powercowo key=PORT value="3000"

# BLOCK 7: Create dedicated API user on router
/user/add name=powercowo-api password="CHANGE_ME_ROUTER_PASS" group=full comment="PowerCowo API"
/ip/service/set www-ssl disabled=no
/ip/service/set www disabled=no

# BLOCK 8: Add container (after uploading image tar via SCP)
/container/add \
  file=disk1/powercowo-agent.tar \
  interface=veth-agent \
  root-dir=disk1/containers/powercowo-agent \
  envlist=powercowo \
  start-on-boot=yes \
  logging=yes \
  name=powercowo-agent

/container/start powercowo-agent
/container/print
```

---

### File 2: `mikrotik-agent/index.js`

Node.js agent running inside the container:

```js
// Proxies authenticated requests from Vercel to the RouterOS REST API
import http from 'http';

const PORT = process.env.PORT || 3000;
const AGENT_SECRET = process.env.AGENT_SECRET;
const ROUTER_IP = process.env.ROUTER_IP || '172.18.0.1';
const ROUTER_USER = process.env.ROUTER_USER;
const ROUTER_PASS = process.env.ROUTER_PASS;

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
  if (req.headers['x-agent-secret'] !== AGENT_SECRET) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }
  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(r => req.on('end', r));
  const url = new URL(req.url, `http://localhost`);
  try {
    const parsed = body ? JSON.parse(body) : undefined;
    const result = await callRouter(req.method, url.pathname, parsed);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => console.log(`PowerCowo agent listening on :${PORT}`));
```

---

### File 3: `mikrotik-agent/Dockerfile`

```dockerfile
# Build for ARM64 (hAP ax3 architecture)
# docker buildx build --platform linux/arm64 -t powercowo-agent --output type=docker .
# docker save powercowo-agent | gzip > powercowo-agent.tar
# scp powercowo-agent.tar admin@<router-vpn-ip>:/disk1/

FROM --platform=linux/arm64 node:22-alpine
WORKDIR /app
COPY package.json index.js ./
EXPOSE 3000
CMD ["node", "index.js"]
```

---

### File 4: `api/mikrotik/[...path].js` (Vercel)

```js
// Vercel serverless function — proxies to on-router agent via VPN
export default async function handler(req, res) {
  const agentUrl = process.env.MIKROTIK_AGENT_URL;
  const agentSecret = process.env.MIKROTIK_AGENT_SECRET;

  if (!agentUrl || !agentSecret) {
    return res.status(500).json({ error: 'Agent not configured' });
  }

  const path = '/' + (req.query.path || []).join('/');
  const body = ['GET', 'DELETE'].includes(req.method) ? undefined : JSON.stringify(req.body);

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
```

**Vercel env vars to add:**

```
MIKROTIK_AGENT_URL=http://<router-vpn-ip>:3000
MIKROTIK_AGENT_SECRET=<same as AGENT_SECRET in container>
```

**Deployment flow (Mac):**

```bash
docker buildx build --platform linux/arm64 -t powercowo-agent ./mikrotik-agent
docker save powercowo-agent | gzip > powercowo-agent.tar
scp powercowo-agent.tar admin@<router-vpn-ip>:/disk1/
# Then SSH in and run Block 8 of the .rsc script
```

---

## Q: Can you also create an MD doc file to describe step by step what to do exactly? After the restart I do not see nothing as instruction!

### A:

A full `SETUP_GUIDE.md` was produced covering all 7 phases:

```
PHASE 1  Install container package          (SSH — remote)
PHASE 2  Enable container mode              (SSH + customer power cycles router)
PHASE 3  Configure router for the agent     (SSH — remote)
PHASE 4  Build the agent image              (your Mac)
PHASE 5  Install and start the container    (SSH — remote)
PHASE 6  Configure Vercel environment       (Vercel dashboard)
PHASE 7  Test the integration               (curl / your app)
```

Key points explicitly covered:
- After Phase 1 reboot — SSH back in, run `/system/package/print` to verify
- After Phase 2 power cycle — SSH back in, run `/system/device-mode/print` to confirm `container: yes`
- After Phase 5 extraction — wait for status `stopped` before starting, check logs for `PowerCowo agent listening on :3000`
- Full troubleshooting section
- Future update procedure (no physical access, no reboot required)

---

## Architecture summary

```
PowerCowo React App
       │
       ▼
Vercel /api/mikrotik/[...path]
       │  (x-agent-secret header)
       ▼
MikroTik hAP ax3 — port 3000  (reachable via customer VPN tunnel)
  └─ Container: powercowo-agent (Node.js ARM64)
       │  (Basic Auth, localhost)
       ▼
  RouterOS REST API (/rest/...)
```

**VPN endpoints used for VPN user management:**

```js
// Create VPN user on contract activation
POST /api/mikrotik/ppp/secret
{ name: "customer-uuid", password: "xxx", service: "l2tp", profile: "default" }

// Delete VPN user on contract expiry
DELETE /api/mikrotik/ppp/secret/*id

// List WireGuard peers
GET /api/mikrotik/interface/wireguard/peers
```

---

## Files produced in this session

| File | Purpose |
|---|---|
| `mikrotik-setup/01_routeros_setup.rsc` | RouterOS CLI setup script (run via SSH) |
| `mikrotik-agent/index.js` | Node.js agent (runs inside router container) |
| `mikrotik-agent/package.json` | Agent package descriptor |
| `mikrotik-agent/Dockerfile` | ARM64 Docker build file |
| `api/mikrotik/[...path].js` | Vercel API proxy function |
| `mikrotik-setup/SETUP_GUIDE.md` | Full step-by-step setup guide |
