# PowerCowo — MikroTik Container Setup Guide

Complete step-by-step instructions to install the PowerCowo agent container on a MikroTik hAP ax3 router, enabling remote VPN management from the PowerCowo application.

---

## Prerequisites

Before starting, make sure you have:

- VPN tunnel access to the router (already configured by the customer)
- SSH client on your Mac (`ssh` in Terminal)
- Docker Desktop installed on your Mac with buildx support
- A USB stick plugged into the router (min 1GB, formatted as ext4)
- The router IP reachable via VPN (e.g. `10.8.0.1` — confirm with customer)
- The router admin credentials (username + password)

---

## Overview

```
PHASE 1  Install container package          (SSH — remote)
PHASE 2  Enable container mode              (SSH + customer power cycles router)
PHASE 3  Build the agent image              (your Mac)
PHASE 4  Upload image to router             (SCP — remote)
PHASE 5  Configure and start container      (SSH — remote)
PHASE 6  Configure Vercel environment       (Vercel dashboard)
PHASE 7  Test the integration              (curl / your app)
```

---

## PHASE 1 — Install the container package

Connect via SSH through your VPN tunnel:

```bash
ssh admin@<router-vpn-ip>
```

Once connected, run:

```
/system/package/update/check-for-updates
```

Wait for the check to complete, then install the container package:

```
/system/package/install container
```

You will see a message saying the package will be installed on next reboot. Reboot now:

```
/system/reboot
```

The router will disconnect. **Wait ~60 seconds**, then SSH back in:

```bash
ssh admin@<router-vpn-ip>
```

Verify the package is installed:

```
/system/package/print
```

You should see `container` listed with status enabled.

---

## PHASE 2 — Enable container mode

> ⚠️ This phase requires the customer to physically power cycle the router once.

Still in the SSH session, run:

```
/system/device-mode/update container=yes
```

RouterOS will print a message saying it is waiting for confirmation via a physical action within **5 minutes**.

**Immediately contact the customer and ask them to:**
1. Unplug the power cable from the router
2. Wait 5 seconds
3. Plug it back in

After the router boots back up (~60 seconds), SSH in again:

```bash
ssh admin@<router-vpn-ip>
```

Verify container mode is active:

```
/system/device-mode/print
```

You should see `container: yes`.

---

## PHASE 3 — Configure the router for the agent

Still in the SSH session, run all the following commands in order.

### 3a — Check the USB disk name

```
/disk/print
```

Look at the output. The disk name will be something like `disk1` or `usb1-part1`. Note it down. In the commands below, replace `disk1` with your actual disk name if different.

### 3b — Create a dedicated API user on the router

```
/user/add name=powercowo-api password="CHOOSE_A_STRONG_PASSWORD" group=full comment="PowerCowo API"
```

> Note down this password — you will need it in Phase 5.

### 3c — Enable the REST API service

```
/ip/service/set www disabled=no
```

### 3d — Create the container virtual network

```
/interface/veth/add name=veth-agent address=172.18.0.2/24 gateway=172.18.0.1
/interface/bridge/add name=bridge-containers
/ip/address/add address=172.18.0.1/24 interface=bridge-containers
/interface/bridge/port/add bridge=bridge-containers interface=veth-agent
```

### 3e — Allow the container to reach the router's REST API

> ⚠️ **Critical — often missed.** If the router's `input` firewall chain has a default-drop rule (very common on production setups), the container will not be able to reach `172.18.0.1:80` and every REST call from the agent will hang indefinitely. Add an explicit accept for the container bridge **before** any drop rule.

```
/ip/firewall/filter/add chain=input action=accept in-interface=bridge-containers comment="Container -> Router REST" place-before=[find where action=drop and chain=input]
```

If `/ip/firewall/filter/print where chain=input` shows no drop rule, this step is optional but harmless.

### 3f — Allow the container to reach the internet

```
/ip/firewall/nat/add chain=srcnat action=masquerade src-address=172.18.0.0/24 comment="Container NAT"
```

### 3g — Expose the agent port (so Vercel can reach it via VPN)

```
/ip/firewall/nat/add chain=dstnat protocol=tcp dst-port=3000 in-interface=all action=dst-nat to-addresses=172.18.0.2 to-ports=3000 comment="PowerCowo Agent"
```

Also add an input accept for the exposed port so external traffic can reach it:

```
/ip/firewall/filter/add chain=input action=accept protocol=tcp dst-port=3000 comment="PowerCowo Agent" place-before=[find where action=drop and chain=input]
```

### 3h — Set the container environment variables

Replace the values in quotes with your actual secrets:

```
/container/envs/add list=powercowo key=AGENT_SECRET value="CHOOSE_A_STRONG_SECRET"
/container/envs/add list=powercowo key=ROUTER_IP value="172.18.0.1"
/container/envs/add list=powercowo key=ROUTER_USER value="powercowo-api"
/container/envs/add list=powercowo key=ROUTER_PASS value="THE_PASSWORD_FROM_STEP_3b"
/container/envs/add list=powercowo key=PORT value="3000"
```

> Note down `AGENT_SECRET` — you will need it in Phase 6.

### 3i — Set the container registry

```
/container/config/set registry-url=https://registry-1.docker.io tmpdir=disk1/tmp
```

---

## PHASE 4 — Build the agent image on your Mac

Open a new Terminal window on your Mac (leave the SSH session open).

Navigate to the agent folder:

```bash
cd /path/to/powercowo/mikrotik-agent
```

Build the image for ARM64 (the hAP ax3 CPU architecture):

```bash
docker buildx build --platform linux/arm64 -t powercowo-agent .
```

Export the image to a tar file:

```bash
docker save powercowo-agent | gzip > powercowo-agent.tar
```

Upload the tar to the router's USB disk via SCP:

```bash
scp powercowo-agent.tar admin@<router-vpn-ip>:/disk1/
```

This may take a minute depending on your connection. Wait for it to complete.

---

## PHASE 5 — Install and start the container

Go back to your SSH session and run:

```
/container/add \
  file=disk1/powercowo-agent.tar \
  interface=veth-agent \
  root-dir=disk1/containers/powercowo-agent \
  envlist=powercowo \
  start-on-boot=yes \
  logging=yes \
  name=powercowo-agent
```

RouterOS will extract the image. Check the status:

```
/container/print
```

Wait until the status changes from `extracting` to `stopped`. Then start it:

```
/container/start powercowo-agent
```

Verify it is running:

```
/container/print
```

Status should show `running`.

Check the logs to confirm the agent started correctly:

```
/log/print where topics~"container"
```

You should see: `PowerCowo agent listening on :3000`

---

## PHASE 6 — Configure Vercel environment variables

In the Vercel dashboard, go to your project → **Settings** → **Environment Variables** and add:

| Variable | Value |
|---|---|
| `MIKROTIK_AGENT_URL` | `http://<router-vpn-ip>:3000` |
| `MIKROTIK_AGENT_SECRET` | The `AGENT_SECRET` value from Phase 3h |

Add these to **Production**, **Preview**, and **Development** environments.

Redeploy the application for the variables to take effect.

---

## PHASE 7 — Test the integration

From your Mac Terminal (connected to the VPN), test the agent directly:

```bash
curl -X GET http://<router-vpn-ip>:3000/interface \
  -H "x-agent-secret: YOUR_AGENT_SECRET"
```

You should receive a JSON list of router interfaces.

Test creating a VPN user:

```bash
curl -X POST http://<router-vpn-ip>:3000/ppp/secret \
  -H "x-agent-secret: YOUR_AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-user","password":"test123","service":"l2tp","profile":"default"}'
```

Test via your Vercel API endpoint:

```bash
curl -X GET https://your-app.vercel.app/api/mikrotik/interface
```

---

## Troubleshooting

**Container stuck in `extracting` status**

The USB disk may be slow. Wait up to 5 minutes. If it stays stuck, remove and retry:
```
/container/remove powercowo-agent
/container/add file=disk1/powercowo-agent.tar ...
```

**Agent not reachable on port 3000**

Check the firewall NAT rule was created:
```
/ip/firewall/nat/print
```

Check the container is actually running:
```
/container/print
/log/print where topics~"container"
```

**Curl to port 3000 hangs (TCP connects but no HTTP response)**

The agent accepted the connection but its call to the router's REST API is being silently dropped by the `input` firewall chain. Confirm by comparing the two behaviours:

- `curl http://<router-ip>:3000/` returns `401 {"error":"Unauthorized"}` instantly (proves the agent is up)
- `curl -H 'x-agent-secret: ...' http://<router-ip>:3000/interface` hangs until timeout

Fix — add the input accept rule from Step 3e:
```
/ip/firewall/filter/add chain=input action=accept in-interface=bridge-containers comment="Container -> Router REST" place-before=[find where action=drop and chain=input]
```
Then verify: `/ip/firewall/filter/print where chain=input` — the accept for `bridge-containers` must appear **before** any drop rule.

**`x-agent-secret` returning 401**

The `AGENT_SECRET` env var in the container does not match what you are sending. Re-check the value set in Step 3h:
```
/container/envs/print
```

**SSH disconnects during setup**

The router rebooted or the VPN dropped. Simply SSH back in. All configuration already applied is persistent — continue from where you left off.

---

## Architecture summary

```
PowerCowo React App
       │
       ▼
Vercel /api/mikrotik/[...path]
       │  (x-agent-secret header)
       ▼
MikroTik hAP ax3 — port 3000
  └─ Container: powercowo-agent (Node.js)
       │  (Basic Auth, localhost)
       ▼
  RouterOS REST API (/rest/...)
```

---

## Updating the agent in the future

To deploy a new version of the agent:

1. Build and export a new `powercowo-agent.tar` on your Mac (Phase 4)
2. Upload via SCP (Phase 4)
3. SSH into the router and run:

```
/container/stop powercowo-agent
/container/remove powercowo-agent
/container/add file=disk1/powercowo-agent.tar interface=veth-agent root-dir=disk1/containers/powercowo-agent envlist=powercowo start-on-boot=yes logging=yes name=powercowo-agent
/container/start powercowo-agent
```

No reboot required. No physical access required.
