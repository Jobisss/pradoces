#!/bin/bash
# Luizinha Confeitaria — host firewall (INFRA-03 / threats T-01-05-01, T-01-05-02).
#
# Runs on the VPS host (NOT in Docker). Locks inbound traffic to:
#   - SSH (22)      only from $DEV_IP
#   - HTTP/HTTPS    only from current Cloudflare edge CIDRs (v4 + v6)
# Everything else inbound is denied by default, which hides the origin: a direct
# curl to the raw VPS IP is refused (prove it with scripts/test-origin-hidden.sh).
#
# Usage:  export DEV_IP=<your_public_ip>  &&  sudo -E bash scripts/setup-ufw.sh
# Re-run weekly (cron.weekly) to pick up Cloudflare CIDR changes.
set -euo pipefail

# Reset to a known state.
ufw --force reset

# Default posture: deny all incoming, allow all outgoing.
ufw default deny incoming
ufw default allow outgoing

# SSH only from the developer IP (fail loudly if DEV_IP is unset).
ufw allow from "${DEV_IP:?DEV_IP env var required}" to any port 22 proto tcp comment 'SSH dev only'

# 80/443 only from Cloudflare edges.
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4); do
	ufw allow from "$ip" to any port 80  proto tcp comment 'CF v4'
	ufw allow from "$ip" to any port 443 proto tcp comment 'CF v4'
done
for ip in $(curl -fsS https://www.cloudflare.com/ips-v6); do
	ufw allow from "$ip" to any port 80  proto tcp comment 'CF v6'
	ufw allow from "$ip" to any port 443 proto tcp comment 'CF v6'
done

ufw --force enable
ufw status numbered
