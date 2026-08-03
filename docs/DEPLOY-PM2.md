# Deploy Runbook — PM2 + nginx, sem Cloudflare (Hostinger direto)

Sem CDN/proxy na frente — DNS aponta direto pro IP do VPS (Hostinger), nginx é
o único hop entre a internet e o app. PM2 substitui o Docker `app`; Postgres
continua em Docker (reusa o `db` service do `docker-compose.yml` sem mudança).

```
Internet ── DNS (Hostinger) aponta direto pro IP do VPS
                │ 80/443 (aberto pra internet, UFW libera geral)
            nginx (host, Let's Encrypt via certbot)
                │ reverse_proxy 127.0.0.1:3000
            PM2 -> node .next/standalone/server.js (loopback only)
                │ localhost:5432
            db container (Postgres 16, port exposed to loopback only)
```

`lib/net/client-ip.ts` prefere o header `CF-Connecting-IP` mas cai pro
`X-Forwarded-For` normal quando ele não existe — sem Cloudflare, o app
continua pegando o IP real do cliente correto, sem precisar mudar código,
desde que nginx seja o ÚNICO proxy na frente (é o caso aqui).

## 0. Prerequisites

- VPS (Ubuntu 22.04+), Docker + Docker Compose plugin (para o Postgres), Node.js 20+, nginx, certbot.
- Domínio `luizinha-confeitaria.com.br` com DNS gerenciado na Hostinger — dois
  registros **A** (raiz + `www`) apontando pro IP público do VPS. Sem proxy,
  sem "nuvem" — é resolução direta.
- UFW liberando 80/443 pra qualquer origem (sem Cloudflare, não tem CIDR pra
  restringir) + 22 só pro seu IP de SSH.

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo npm install -g pm2
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
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
sudo cp nginx/luizinha-confeitaria.conf /etc/nginx/sites-available/luizinha-confeitaria.com.br
sudo ln -s /etc/nginx/sites-available/luizinha-confeitaria.com.br /etc/nginx/sites-enabled/
sudo nginx -t                          # validate config
sudo certbot --nginx -d luizinha-confeitaria.com.br -d www.luizinha-confeitaria.com.br
sudo systemctl reload nginx
```

The checked-in `nginx/luizinha-confeitaria.conf` is HTTP-only (port 80) ON
PURPOSE — no `ssl_certificate` lines, so `nginx -t` passes before a cert
exists. `certbot --nginx` edits this exact server block in place to add
`listen 443 ssl`/cert paths, and (say yes to the redirect prompt) adds a
second port-80 block that 301s to https — same interactive flow already used
for `futtvale.com.br`/`museuvvi.digital`. Auto-renewal (`certbot renew` via
systemd timer) is already installed with the package, shared across all
domains on this host.

## 5. Verify

```bash
pm2 status                                             # luizinha: online
pm2 logs luizinha --lines 50                           # no crash loop
curl -I https://luizinha-confeitaria.com.br             # 200, HSTS header presente
```

Sem Cloudflare na frente, `scripts/test-origin-hidden.sh` (docs/DEPLOY.md) não
se aplica — o IP do VPS é diretamente alcançável por design aqui, não é bug.

Em um navegador:
- [ ] `https://luizinha-confeitaria.com.br` carrega com cadeado válido.
- [ ] Resposta traz `Strict-Transport-Security` (HSTS do nginx).
- [ ] CSP / X-Frame-Options presentes (vêm do `proxy.ts` do app, não do nginx).
- [ ] `sudo ufw status numbered` mostra só 22 (seu IP) + 80/443 (geral).

## Troubleshooting

- **502 from nginx:** `pm2 status` — is `luizinha` `online` or stuck
  restarting? `pm2 logs luizinha` for the crash reason. Common cause:
  `DATABASE_URL` still pointing at `db:5432` instead of `127.0.0.1:5432`.
- **PM2 process restarts in a loop:** almost always a missing/invalid env var
  — `lib/env.ts` validates at boot and throws. Check `pm2 logs luizinha`.
- **certbot falha no HTTP-01 challenge:** confirma que o DNS já propagou
  (`dig +short luizinha-confeitaria.com.br` deve devolver o IP do VPS) e que a
  porta 80 está liberada no UFW.
- **Reboot survival:** `pm2 startup` must have been run AND the printed
  command executed — `pm2 save` alone does not survive a reboot without it.
