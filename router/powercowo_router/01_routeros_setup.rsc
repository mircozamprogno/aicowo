# ============================================================
# PowerCowo - MikroTik Container Setup
# Run via SSH: ssh admin@<router-vpn-ip>
# Then paste each block in sequence
# ============================================================

# --- BLOCK 1: Install container package (then reboot) -------
/system/package/update/check-for-updates
/system/package/install container
/system/reboot
# Wait for router to come back up, then SSH again

# --- BLOCK 2: Enable container mode -------------------------
# After this command, ask customer to unplug/replug router within 5 min
/system/device-mode/update container=yes
# >>> CUSTOMER MUST POWER CYCLE THE ROUTER NOW <<<
# SSH back in after reboot

# --- BLOCK 3: Configure storage (USB stick required) --------
# Check USB is detected
/disk/print
# Should show disk1 or usb1 - adjust variable below accordingly
:local disk "disk1"

# Create directories
/file/make-directory ($disk . "/containers")
/file/make-directory ($disk . "/containers/powercowo-agent")

# --- BLOCK 4: Create virtual network for container ----------
/interface/veth/add name=veth-agent address=172.18.0.2/24 gateway=172.18.0.1
/interface/bridge/add name=bridge-containers
/ip/address/add address=172.18.0.1/24 interface=bridge-containers
/interface/bridge/port/add bridge=bridge-containers interface=veth-agent

# Allow container to reach internet (for outbound calls)
/ip/firewall/nat/add chain=srcnat action=masquerade src-address=172.18.0.0/24 comment="Container NAT"

# --- BLOCK 5: Expose agent port via NAT (from VPN interface) -
# Replace ether1 with your WAN/VPN interface if different
/ip/firewall/nat/add \
  chain=dstnat \
  protocol=tcp \
  dst-port=3000 \
  in-interface=all \
  action=dst-nat \
  to-addresses=172.18.0.2 \
  to-ports=3000 \
  comment="PowerCowo Agent"

# --- BLOCK 6: Set registry and pull agent image -------------
/container/config/set registry-url=https://registry-1.docker.io tmpdir=disk1/tmp

# Environment variables for the agent
/container/envs/add list=powercowo key=AGENT_SECRET value="CHANGE_ME_STRONG_SECRET"
/container/envs/add list=powercowo key=ROUTER_IP value="172.18.0.1"
/container/envs/add list=powercowo key=ROUTER_USER value="powercowo-api"
/container/envs/add list=powercowo key=ROUTER_PASS value="CHANGE_ME_ROUTER_PASS"
/container/envs/add list=powercowo key=PORT value="3000"

# --- BLOCK 7: Create dedicated API user on router -----------
/user/add name=powercowo-api password="CHANGE_ME_ROUTER_PASS" group=full comment="PowerCowo API"
/ip/service/set www-ssl disabled=no
/ip/service/set www disabled=no

# --- BLOCK 8: Add container (after uploading image tar) -----
# See step 3 - build image on your machine and upload via SCP
/container/add \
  file=disk1/powercowo-agent.tar \
  interface=veth-agent \
  root-dir=disk1/containers/powercowo-agent \
  envlist=powercowo \
  start-on-boot=yes \
  logging=yes \
  name=powercowo-agent

# Start container
/container/start powercowo-agent

# Verify it's running
/container/print
