# Deploy Runbook — Luizinha Confeitaria

Docker Compose (`app` + `db`) na VPS, atrás do nginx que já roda no host servindo
outros domínios (`futtvale.com.br`, `museuvvi.digital`). Sem Cloudflare, sem
Caddy, sem PM2 — DNS aponta direto pro IP da VPS (Hostinger), nginx é o único
hop entre a internet e o app.

```
Internet ── DNS (Hostinger) aponta direto pro IP do VPS
                │ 80/443 (UFW libera geral, sem CIDR pra restringir)
            nginx (host, Let's Encrypt via certbot, já serve outros domínios)
                │ reverse_proxy 127.0.0.1:3000
            app container (Next standalone, Docker, loopback only)
                │ compose network
            db container (Postgres 16, no host port)
```

`lib/net/client-ip.ts` prefere o header `CF-Connecting-IP` mas cai pro
`X-Forwarded-For` normal quando ele não existe (sempre o caso aqui, sem
Cloudflare) — o app pega o IP real do cliente correto, desde que nginx seja o
ÚNICO proxy na frente (é o caso).

## 0. Prerequisites

- VPS (Ubuntu 22.04+), Docker + Docker Compose plugin, nginx, certbot.
- Domínio `luizinha-confeitaria.com.br` com DNS gerenciado na Hostinger — dois
  registros **A** (raiz + `www`) apontando pro IP público do VPS.
- UFW liberando 80/443 pra qualquer origem (sem Cloudflare, não tem CIDR pra
  restringir) + 22 só pro seu IP de SSH.

```bash
sudo apt install certbot python3-certbot-nginx   # nginx já instalado no host
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 1. App + database (Docker)

```bash
cp .env.production.example .env.production   # depois preenche os secrets reais (NÃO commitado)
docker compose up -d --build
docker compose exec app npx prisma migrate deploy   # aplica migrations (NÃO db push)
docker compose exec app npm run seed:admin          # bootstrap do usuário admin
```

`.env.production` precisa ter `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`,
`RESEND_API_KEY`, etc. — gerar secrets com `openssl rand -base64 32`. O app
publica só `127.0.0.1:3000`; o Postgres não tem porta exposta ao host.

Re-deploy após mudança de código: `docker compose up -d --build` de novo
(reaplica só a imagem `app`; `db` mantém o volume `pgdata` intacto).

## 2. nginx

```bash
sudo cp nginx/luizinha-confeitaria.conf /etc/nginx/sites-available/luizinha-confeitaria.com.br
sudo ln -s /etc/nginx/sites-available/luizinha-confeitaria.com.br /etc/nginx/sites-enabled/
sudo nginx -t                          # valida a config
sudo certbot --nginx -d luizinha-confeitaria.com.br -d www.luizinha-confeitaria.com.br
sudo systemctl reload nginx
```

O `nginx/luizinha-confeitaria.conf` já commitado é HTTP-only (porta 80) DE
PROPÓSITO — sem linhas `ssl_certificate`, então `nginx -t` passa antes do
certificado existir. `certbot --nginx` edita esse mesmo server block in-place
pra adicionar `listen 443 ssl`/caminhos do cert, e (aceitando o prompt de
redirect) adiciona um segundo bloco porta-80 que faz 301 pra https — mesmo
fluxo interativo já usado pra `futtvale.com.br`/`museuvvi.digital`. Renovação
automática (`certbot renew` via systemd timer) já vem instalada com o pacote,
compartilhada entre todos os domínios desse host.

## 3. Verify

```bash
docker compose ps                                       # app: healthy/running
docker compose logs app --tail 50                       # sem crash loop
curl -I https://luizinha-confeitaria.com.br              # 200, header HSTS presente
```

Em um navegador:

- [ ] `https://luizinha-confeitaria.com.br` carrega com cadeado válido.
- [ ] Resposta traz `Strict-Transport-Security` (HSTS do nginx).
- [ ] CSP / X-Frame-Options presentes (vêm do `proxy.ts` do app, não do nginx).
- [ ] `sudo ufw status numbered` mostra só 22 (seu IP) + 80/443 (geral).

## Troubleshooting

- **502 from nginx:** `docker compose ps` — `app` está `healthy`? Ele espera o
  `db` ficar `service_healthy` antes de subir. `docker compose logs app` pra
  ver o motivo do crash.
- **App reinicia em loop:** quase sempre uma env var ausente/inválida —
  `lib/env.ts` valida no boot e lança erro. Checa `docker compose logs app`.
  Causa comum: `DATABASE_URL` ainda com host errado — dentro do compose
  network o `db` é sempre `db:5432`, nunca `127.0.0.1:5432` ou `localhost`.
- **certbot falha no HTTP-01 challenge:** confirma que o DNS já propagou
  (`dig +short luizinha-confeitaria.com.br` deve devolver o IP do VPS) e que a
  porta 80 está liberada no UFW.
