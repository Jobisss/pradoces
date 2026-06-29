#!/bin/bash
# Doces Valentina — prove the origin IP is hidden (INFRA-02 / T-01-05-01).
#
# Run from the DEV laptop (or anywhere OTHER than $DEV_IP). It hits the RAW VPS IP
# directly, bypassing Cloudflare. With UFW correctly allowlisting only Cloudflare
# CIDRs for 80/443, this connection MUST fail (connection refused / timeout).
#
#   A NON-ZERO exit  => PASS: origin is hidden (UFW blocked the direct hit).
#   A ZERO exit (200) => FAIL: the origin is reachable directly — fix UFW now.
#
# Usage:  VPS_IP=<raw_vps_ip> bash scripts/test-origin-hidden.sh
set -uo pipefail

VPS_IP="${VPS_IP:?VPS_IP env var required (raw VPS public IP)}"

echo "Probing raw origin https://${VPS_IP}/ (Host: docesvalentina.com.br) — expecting it to be REFUSED..."

# -k: skip cert check (cert is for the domain, not the IP); --max-time 5: short fuse.
if curl -k --max-time 5 -sS "https://${VPS_IP}/" -H 'Host: docesvalentina.com.br' >/dev/null 2>&1; then
	echo "FAIL: origin answered directly on ${VPS_IP} — Cloudflare is being bypassed. Re-check UFW (scripts/setup-ufw.sh) and Cloudflare Proxied A records."
	exit 1
else
	echo "PASS: direct hit to ${VPS_IP} was refused/timed out — origin is hidden (INFRA-02 OK)."
	exit 0
fi
