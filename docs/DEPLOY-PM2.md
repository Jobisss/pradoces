# Deploy Runbook — PM2 + nginx (alternative to docs/DEPLOY.md)

Same trust boundary as the Docker+Caddy path (`docs/DEPLOY.md`), different process
manager for the app: nginx replaces Caddy, PM2 replaces the Docker `app`
container. Postgres stays in Docker (reuses `docker-compose.yml`'s `db`
service unchanged) so nothing about the database setup changes.

```
Internet ── Cloudflare (orange cloud, Full Strict)
                │ 80/443 (only CF CIDRs pass UFW)
            nginx (host, Let's Encrypt via certbot)
                │ reverse_proxy 127.0.0.1:3000
            PM2 -> node .next/standalone/server.js (loopback only)
                │ localhost:5432
            db container (Postgres 16, port exposed to loopback only)
```

## 0. Prerequisites

- VPS (Ubuntu 22.04+), Docker + Docker Compose plugin (for Postgres only), Node.js 20+, nginx, certbot.
- Domain `luizinhaconfeitaria.com.br` on Cloudflare — DNS + SSL/TLS steps are
  IDENTICAL to `docs/DEPLOY.md` §1 (Cloudflare) and §2 (UFW). Do those first.

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

## 1. Database (Docker, Postgres only)

```bash
cp .env.production.example .env.production   # fill in real secrets
docker compose -f docker-compose.yml -f docker-compose.pm2-db.yml up -d db
```

**Edit `.env.production` after copying**: the template's `DATABASE_URL` points
at `db:5432` (the Docker compose network hostname) — that only resolves
*inside* Docker. For the native PM2 process, change it to the loopback port
`docker-compose.pm2-db.yml` exposes:

```
DATABASE_URL=postgresql://postgres:__POSTGRES_PASSWORD__@127.0.0.1:5432/doces
```

## 2. Build + run migrations

```bash
npm ci
npx prisma generate
npm run build                          # output: standalone (next.config.ts)

# The standalone tracer does NOT copy public/ or .next/static — same manual
# step the Dockerfile does for the container image.
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

npx prisma migrate deploy              # NOT db push
npm run seed:admin                     # bootstrap the admin user
```

## 3. PM2

```bash
pm2 start ecosystem.config.js
pm2 save                # persist the process list
pm2 startup             # prints a systemd command — run the one it prints,
                         # so PM2 (and the app) survive a VPS reboot
```

Re-deploys after a code change: `npm run build` + repeat the two `cp -r`
lines above, then `pm2 restart luizinha` (or `pm2 reload luizinha` for a
zero-downtime restart — safe here since this app is single-instance/fork mode,
no shared state to worry about across workers).

## 4. nginx

```bash
sudo cp nginx/luizinhaconfeitaria.conf /etc/nginx/sites-available/luizinhaconfeitaria.com.br
sudo ln -s /etc/nginx/sites-available/luizinhaconfeitaria.com.br /etc/nginx/sites-enabled/
sudo nginx -t                          # validate config
sudo certbot --nginx -d luizinhaconfeitaria.com.br -d www.luizinhaconfeitaria.com.br
sudo systemctl reload nginx
```

The checked-in `nginx/luizinhaconfeitaria.conf` is HTTP-only (port 80) ON
PURPOSE — no `ssl_certificate` lines, so `nginx -t` passes before a cert
exists. `certbot --nginx` edits this exact server block in place to add
`listen 443 ssl`/cert paths, and (say yes to the redirect prompt) adds a
second port-80 block that 301s to https — same interactive flow already used
for `futtvale.com.br`/`museuvvi.digital`. Auto-renewal (`certbot renew` via
systemd timer) is already installed with the package, shared across all
domains on this host.

## 5. Verify (same acceptance criteria as docs/DEPLOY.md §5)

```bash
VPS_IP=<VPS_IP> bash scripts/test-origin-hidden.sh     # expect PASS
pm2 status                                             # luizinha: online
pm2 logs luizinha --lines 50                           # no crash loop
```

Then in a browser: same checklist as `docs/DEPLOY.md` §5 (HSTS, CSP from
`proxy.ts`, UFW only 22+80/443, origin-hidden PASS).

## Troubleshooting

- **502 from nginx:** `pm2 status` — is `luizinha` `online` or stuck
  restarting? `pm2 logs luizinha` for the crash reason. Common cause:
  `DATABASE_URL` still pointing at `db:5432` instead of `127.0.0.1:5432`.
- **PM2 process restarts in a loop:** almost always a missing/invalid env var
  — `lib/env.ts` validates at boot and throws. Check `pm2 logs luizinha`.
- **Cloudflare 526 (invalid cert):** certbot hasn't issued yet, or port 80 is
  blocked for the HTTP-01 challenge — confirm UFW allows CF on 80 and
  `/var/www/certbot` exists and matches the `nginx.conf` ACME location.
- **Reboot survival:** `pm2 startup` must have been run AND the printed
  command executed — `pm2 save` alone does not survive a reboot without it.
