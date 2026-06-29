# Deploy Runbook — Doces Valentina (Phase 1: INFRA-01/02/03)

Defensável-by-default deploy: Cloudflare proxy (origin hidden) -> host Caddy (TLS +
trusted CF) -> Docker `app` on loopback -> Postgres on the internal network. UFW lets
in only Cloudflare (80/443) and the dev IP (SSH).

```
Internet ── Cloudflare (orange cloud, Full Strict)
                │ 80/443 (only CF CIDRs pass UFW)
            Caddy (host, Let's Encrypt, trusted_proxies cloudflare, HSTS)
                │ reverse_proxy 127.0.0.1:3000
            app container (Next standalone, loopback only)
                │ compose network
            db container (Postgres 16, no host port)
```

## 0. Prerequisites

- VPS (Ubuntu 22.04+), Docker + Docker Compose plugin installed.
- Domain `docesvalentina.com.br` on Cloudflare.
- Raw VPS public IP (`<VPS_IP>`) and your own public IP (`<DEV_IP>`).

## 1. Cloudflare (dashboard — INFRA-02)

1. **DNS** -> add two **A** records, both **Proxied (orange cloud)**:
   - `docesvalentina.com.br` -> `<VPS_IP>`
   - `www` -> `<VPS_IP>`
2. **SSL/TLS -> Overview** -> mode **Full (Strict)** (Caddy serves a valid origin cert).

## 2. Firewall (VPS host — INFRA-03)

```bash
export DEV_IP=<your_public_ip>
sudo -E bash scripts/setup-ufw.sh
sudo ufw status numbered   # expect: 22 (DEV_IP) + 80/443 (CF v4 & v6) only
```

Add a weekly refresh so Cloudflare CIDR changes are picked up:

```bash
sudo ln -s /opt/doces/scripts/setup-ufw.sh /etc/cron.weekly/refresh-cf-ips
```

## 3. Caddy (VPS host)

```bash
sudo apt install caddy           # Ubuntu 22.04+ ships the caddy-trusted-cloudflare plugin
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy auto-obtains the Let's Encrypt cert (needed for Cloudflare Full Strict).
CSP / X-Frame-Options come from the app (`proxy.ts`) — Caddy only adds HSTS.

## 4. App + database (Docker)

```bash
cp .env.production.example .env.production   # then fill in real secrets (NOT committed)
docker compose up -d --build
docker compose exec app npx prisma migrate deploy   # apply migrations (NOT db push)
docker compose exec app npm run seed:admin          # bootstrap the admin user
```

`.env.production` must set `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`,
`RESEND_API_KEY`, etc. The app publishes only `127.0.0.1:3000`; Postgres has no host port.

## 5. Verify (INFRA-02 / INFRA-03 acceptance)

```bash
# Origin must be hidden: a direct hit to the raw IP must be refused.
VPS_IP=<VPS_IP> bash scripts/test-origin-hidden.sh     # expect PASS (non-zero curl)
```

Then in a browser:

- [ ] `https://docesvalentina.com.br` loads through Cloudflare.
- [ ] Response carries `Strict-Transport-Security` (HSTS from Caddy).
- [ ] CSP / X-Frame-Options present (from the app `proxy.ts`, not duplicated by Caddy).
- [ ] `ufw status numbered` shows only 22 (DEV_IP) + 80/443 (CF) — INFRA-03 OK.
- [ ] `scripts/test-origin-hidden.sh` returns PASS — INFRA-02 OK.

## Troubleshooting

- **502 from Caddy:** `docker compose ps` — is `app` healthy? It waits on db `service_healthy`.
- **Direct IP still answers (test FAIL):** UFW not enabled or A records set to "DNS only" (grey cloud) instead of Proxied.
- **Cloudflare 526 (invalid cert):** Caddy has not finished issuing the LE cert, or port 80 is blocked for the ACME challenge — confirm UFW allows CF on 80.
