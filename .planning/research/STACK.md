# Stack Research — Doces Valentina

**Domain:** Reserva online de doces caseiros + admin de pricing/lotes/fidelização
**Researched:** 2026-04-29
**Confidence:** HIGH (decisões de stack travado verificadas em docs oficiais Next.js 16 e npm; recomendações específicas verificadas via Context7/web search e versões reais publicadas)

> **Constraint herdado (NÃO REPESQUISADO):** Next.js 16 App Router + Postgres em VPS único + Resend + filesystem local pra fotos v1. Este documento foca apenas no que ainda está em aberto **dentro** desse constraint.

> **Aviso Next.js 16:** A versão 16 quebra com training data. Algumas mudanças decisivas que orientam as escolhas abaixo:
> - `middleware.ts` **foi renomeado para `proxy.ts`**. O runtime é **Node.js**, não mais Edge.
> - `cookies()`, `headers()`, `params`, `searchParams` são **assíncronos** (precisam `await`).
> - `revalidateTag(tag)` agora exige segundo argumento `cacheLife` (`'max'` é o equivalente antigo).
> - PPR foi substituído por `cacheComponents: true` em `next.config.ts`.
> - `next lint` foi removido — usar ESLint CLI direto.
> - Turbopack é default em `dev` e `build`.
> - `images.domains` está deprecated — usar `images.remotePatterns`.
> - `images.qualities` agora default `[75]` — precisa configurar explicitamente se quiser várias.

---

## Recommended Stack

### Core já travado (confirmado em `package.json`)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | **16.2.4** | Framework full-stack (frontend + backend via Server Actions + Route Handlers) | Instalado |
| React | **19.2.4** | UI runtime — Server Components default, `useActionState` pra forms | Instalado |
| TypeScript | **^5** | Type-safety (Next 16 exige TS 5.1+) | Instalado |
| Tailwind CSS | **^4** (via `@tailwindcss/postcss`) | Estilização utility-first | Instalado |
| `babel-plugin-react-compiler` | **1.0.0** | React Compiler 1.0 estável; precisa habilitar `reactCompiler: true` em `next.config.ts` | Instalado mas **não habilitado** |

**Ação imediata:** habilitar `reactCompiler: true` em `next.config.ts` — o plugin já está em `devDependencies`, só falta o flag. Confiança: **HIGH** (confirmado em `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`).

### Banco e ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | **16+** (container `postgres:16-alpine`) | Banco principal | Já decidido; `16-alpine` ~80MB, suficiente pra v1 |
| **Prisma 7** | **7.x (latest)** | ORM completo + Migrate + Studio GUI | Ver racional abaixo. Decisão revisada 2026-04-30. |
| **@prisma/client** | **7.x** | Cliente type-safe (Prisma 7 removeu Rust query engine — agora TS puro, mais leve) | Pareado com Prisma 7 |
| **prisma-cli** (`prisma`) | **7.x** | CLI de migrations (`prisma migrate dev`, `prisma migrate deploy`, `prisma db push`) + Studio | Pareado |

**Prisma 7 vs Drizzle vs Kysely — racional (revisado 2026-04-30):**

- **Prisma 7 vence aqui (decisão atualizada)** porque: (a) DX superior — schema declarativo (`prisma/schema.prisma`) é mais legível que TS schema do Drizzle pra revisão; (b) **Prisma Studio** é GUI grátis, polido, permite a mãe (não-técnica) inspecionar dados sem SQL; (c) Prisma 7 removeu o Rust query engine — agora 100% TypeScript, bundle reduzido drasticamente vs v6, cold start ok em VPS pequeno; (d) Better Auth tem adapter Prisma oficial estável; (e) `include`/`select` explícito força o dev a pensar em N+1 desde o começo (alinha com Pitfall 4.3); (f) `prisma.$queryRaw` cobre os casos Postgres-only (`numeric(19,4)`, triggers, CHECK XOR, custo congelado event-sourcing).
- **Drizzle (escolha original)** descartado: feedback do user em 2026-04-30 — preferência por DX Prisma e Prisma Studio. Drizzle é estável e bom em SQL puro, mas trade-off de DX/Studio pesou mais.
- **Kysely** é puro query builder, sem schema-first. Bom pra projetos enterprise que já têm DBA, ruim pra um sistema onde o owner técnico (você) também faz UI.

**Atenção Prisma 7 (mesmo padrão Next 16):** Prisma 7 tem mudanças vs v6 (Rust query engine removido, novos comportamentos de adapter). Researcher e planner DEVEM consultar docs oficiais Prisma 7 + `node_modules/@prisma/client/` antes de propor APIs. Não confiar em training data anterior a 2026.

**Migration strategy em VPS pequena (sem shadow DB extra):** `prisma migrate dev` cria shadow DB temporário automaticamente em DEV. Em PROD usar `prisma migrate deploy` (não cria shadow, só aplica migrations existentes — sem fricção em VPS pequena). Schema em `prisma/schema.prisma` versionado no Git; migrations em `prisma/migrations/` versionadas como SQL legível.

**Adapter de driver:** Prisma 7 usa adapters (Driver Adapters API estabilizada na v6). Para postgres.js direto: `@prisma/adapter-pg` (oficial). Em VPS single-instance, o pool default Prisma é suficiente — adapter postgres.js é opcional.

> **v1 obrigatório:** Prisma 7 + @prisma/client + prisma CLI. Confiança: **HIGH** (decisão revisada com user em 2026-04-30; Better Auth adapter Prisma oficial confirmado).

### Auth

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Better Auth** | **1.6.9** | Auth completo (sessions DB, email/senha, plugins) com adapter pra Prisma | Ver racional abaixo |
| `@better-auth/prisma-adapter` (incluso no core) | — | Persiste sessions e users no Postgres via Prisma | — |
| **argon2** | **0.44.0** | Hash de senha (já usado por Better Auth internamente; documentado caso queira customizar) | Recomendação OWASP atual; mais resistente a GPU que bcrypt |

**Better Auth vs NextAuth (Auth.js v5) vs Lucia vs roll-your-own — racional:**

- **Lucia está deprecated desde março/2025.** O próprio mantenedor recomenda Better Auth como sucessor. Não usar.
- **NextAuth/Auth.js v5** é maduro mas: (a) o fluxo padrão é OAuth-first; o caso da Doces Valentina é credentials-only (email + senha simples); (b) o "Credentials provider" do Auth.js explicitamente desencoraja sessões DB com credentials (forçando JWT-only ou workarounds); (c) Auth.js está listado nos docs do Next 16 mas Better Auth também (e Better Auth foi desenhado nascendo App Router-first).
- **Better Auth** é o que melhor casa com o fluxo peculiar do projeto:
  - Suporta o flow "email-first → existe? pede senha; não existe? cadastro completo" via duas chamadas separadas: `auth.api.getUser({ email })` (você implementa um endpoint custom que retorna apenas existência) seguido de `auth.api.signInEmail` ou redirect pra cadastro. Não há um helper único pra esse flow específico em nenhuma lib — vai ser sempre duas chamadas. Better Auth deixa isso explícito; NextAuth complica.
  - Sessions no banco (com cookie criptografado contendo session ID) — mais seguro que JWT puro e permite invalidar sessão server-side.
  - Plugin `admin` embutido (suficiente pro v1 onde só a mãe é admin).
  - Issue [#5263 do repo](https://github.com/better-auth/better-auth/issues/5263) confirma compatibilidade Next 16 (proxy.ts + cookies async).
- **Roll-your-own JWT** está documentado em `node_modules/next/dist/docs/01-app/02-guides/authentication.md` (com `jose`) — funciona, mas você reimplementa rate-limit, session refresh, "remember me", reset de senha, email verification… é trabalho que não acrescenta valor pro negócio. Só faz sentido se Better Auth não cobrir um caso muito específico.

**Importante pra Next 16:** Better Auth precisa rodar checks em `proxy.ts` (não `middleware.ts`) e usar `await cookies()`. Os exemplos da doc do Better Auth foram atualizados pra isso (verificado em [better-auth.com/docs/integrations/next](https://better-auth.com/docs/integrations/next)).

> **v1 obrigatório:** Better Auth. Confiança: **HIGH** (Lucia deprecation confirmada em múltiplas fontes; Better Auth listado nas docs oficiais do Next.js 16).

### Validação e Forms

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| **Zod** | **4.3.6** | Schema validation server e cliente | Toda Server Action precisa validar `formData` com Zod (padrão da doc oficial Next 16) |
| **react-hook-form** | **7.74.0** | Forms client-side com validação reativa | Forms complexos do admin (cadastro de receita, lote, ingrediente). Pareado com Zod via `@hookform/resolvers` |
| `@hookform/resolvers` | **5.2.2** | Bridge Zod ⇄ react-hook-form | Junto com RHF |

**Server Actions puras vs react-hook-form — racional:**
- **Forms simples do cliente final** (login, "qual seu email?", reservar produto): use `<form action={serverAction}>` com `useActionState` — é o padrão recomendado pela doc oficial do Next 16 (`forms.md`). Funciona sem JS (progressive enhancement) e tem 0 deps client-side.
- **Forms complexos do admin** (lote com ingredientes dinâmicos, receita com array de items, produto com múltiplas fotos): react-hook-form vence porque (a) array fields dinâmicos são dolorosos sem `useFieldArray`; (b) erros inline por campo enquanto digita; (c) pode submitir pra Server Action via `handleSubmit(async (data) => await serverAction(data))`.
- **Mesmo Zod schema serve client e server** — escreva uma vez em `lib/schemas/`, importe nos dois lados.

> **v1 obrigatório:** Zod. **react-hook-form** entra quando começar telas admin complexas (Phase 2-3). Confiança: **HIGH**.

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **resend** | **6.12.2** | SDK oficial pra disparar emails | Já decidido |
| **@react-email/components** | **1.0.12** | Componentes React pra email (`<Button>`, `<Container>`, etc) | Templates type-safe |
| **@react-email/render** | **2.0.8** | Renderiza componente React em HTML pra Resend | Pareado com components |

**React Email vs Maizzle — racional:**
- **React Email** vence pra esse projeto: você já está em React, os emails compartilham componentes/cores/lógica com o site (banner sazonal de Páscoa aparece igual em email e em web), preview local via `npm run email dev` e domínios como botão de "ver reserva" usam `process.env.NEXT_PUBLIC_URL` direto.
- **Maizzle** é Tailwind-only e exige build step separado — overhead sem ganho aqui.

**Webhooks Resend — boas práticas:**
- Crie `app/api/webhooks/resend/route.ts` (Route Handler — não Server Action; webhooks vêm de fora).
- Verifique a assinatura usando o secret do dashboard Resend (campo `Svix-Signature`) com a lib `svix` (Resend usa Svix internamente).
- Eventos importantes pra rastrear no Postgres (tabela `email_events`): `email.delivered`, `email.bounced`, `email.complained`, `email.opened` (opcional). Bounces persistentes precisam pausar envio pra aquele email (proteger reputação do domínio).
- **Não dispare email dentro do Server Action diretamente em loop** — use o padrão `after()` (estável no Next 16) ou enfileire em pg-boss (ver Background Jobs). Server Actions têm timeout e bloqueiam a UX.

> **v1 obrigatório:** resend + @react-email/components + @react-email/render + svix (verificação webhook). Confiança: **HIGH**.

### Imagens

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| **next/image** | (built-in Next 16) | Component otimizado com lazy load + srcset | Sempre que renderizar foto de produto |
| **sharp** | **0.34.5** | Resize/convert no upload (gerar thumbnail + WebP) | No Server Action / Route Handler de upload |
| `@aws-sdk/client-s3` | **3.1038.0** | Cliente S3-compatible (R2 usa S3 API) | Quando migrar pra Cloudflare R2 (Phase 4+) |

**Estratégia v1 (filesystem local):**
1. Upload chega via Server Action (`<form action={uploadProductImage}>`) usando `formData.get('photo') as File`.
2. Sharp processa em memória: gera 3 versões (1200w original-quality, 600w preview, 200w thumb) em WebP.
3. Salva em `./uploads/products/{productId}/{uuid}-{size}.webp` (fora de `public/` — servir via Route Handler `/api/img/[...path]/route.ts` que faz auth check + retorna Response com Content-Type).
4. **Configurar `next.config.ts`:**
   ```ts
   images: {
     remotePatterns: [{ protocol: 'https', hostname: 'doces-valentina.com.br' }],
     localPatterns: [{ pathname: '/api/img/**' }], // permite next/image otimizar imagens servidas via Route Handler
     qualities: [50, 75, 90], // Next 16 default só permite [75]; precisa explicit
     minimumCacheTTL: 86400, // 24h é razoável (Next 16 default agora é 4h)
   }
   ```
5. Backup: `./uploads/` entra no rsync diário pro Cloudflare R2 (mesmo job do `pg_dump`).

**Estratégia migração R2 (Phase 4+):**
- Setup S3 client com endpoint `https://<account>.r2.cloudflarestorage.com`.
- Upload via presigned URL: cliente gera URL no Server Action, browser faz `PUT` direto pro R2 (não passa pelo VPS).
- `images.remotePatterns` adiciona `{ hostname: 'cdn.doces-valentina.com.br' }` (custom domain do bucket).
- next/image continua otimizando (Next 16 fetcha do R2 e cacheia local).

> **v1 obrigatório:** next/image + sharp. **R2 + AWS SDK** vira obrigatório quando ultrapassar 5GB local. Confiança: **HIGH**.

### UI (componentes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **shadcn/ui** | CLI **4.6.0** (`npx shadcn@latest init`) | Componentes copy-paste (Button, Dialog, Form, Toast) sobre Tailwind v4 + Radix | Ver racional |
| **Radix UI primitives** | (instaladas sob demanda pelo shadcn) | Accessibility + comportamento (foco, aria, keyboard) | Auto-instalado por componente |
| **lucide-react** | **1.14.0** | Ícones (default no shadcn) | Pareado |
| **sonner** | **2.0.7** | Toast notifications (recomendado pelo shadcn) | Notificação "reserva criada" |
| **date-fns** | **4.1.0** | Formatação de data pt-BR (`format(date, 'dd/MM/yyyy', { locale: ptBR })`) | Mais leve que dayjs/moment, tree-shakeable |

**shadcn/ui vs MUI vs Mantine vs custom — racional:**
- **shadcn/ui vence** porque: (a) compatível com **Tailwind v4** e React 19 (ambos já no `package.json`); (b) você dona o código (cola na pasta `components/ui/`) — sem dep externa pra atualizar/quebrar; (c) tema customizável via CSS vars batendo com a paleta sazonal (Páscoa, Dia das Mães) que o PROJECT.md pede; (d) bundle incremental — só vem o que você usa.
- **MUI** carrega ~70KB só pra começar e a estética "Material" não casa com identidade artesanal de doces caseiros. Customização exige `sx` prop em todo lugar.
- **Mantine** é boa lib mas o ecossistema é menor que shadcn em 2026 e o styling é CSS-in-JS (Emotion) — vai brigar com Tailwind v4.
- **Custom puro** é a opção certa se você fosse fazer só 3-4 componentes; pra um admin completo (Dialog, Combobox, DatePicker, Sheet, Toast, Form, Table) é trabalho desproporcional.

**Mobile-first é constraint:**
- shadcn já é mobile-first (Tailwind utilities `sm:`, `md:` invertidos por padrão).
- Componentes-chave pra esse projeto: `Sheet` (drawer mobile pra carrinho de reserva), `Drawer` (filtros mobile), `Dialog` (cadastro de ingrediente em modal), `Form` (wrap em torno de react-hook-form), `DataTable` (lotes/reservas em tablet/desktop), `Calendar` (validade de lote).

> **v1 obrigatório:** rodar `npx shadcn@latest init` e adicionar componentes sob demanda. Confiança: **HIGH**.

### Background Jobs / Cron

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| **pg-boss** | **12.18.1** | Queue + cron em cima do Postgres | Sortear automaticamente, retry de email com falha, lembrete de reserva, expiração de lote |
| `node-cron` | (alternativa simples) | Cron in-process | Só se você não quiser ainda outra dep — pg-boss é claramente superior |

**pg-boss vs BullMQ vs Inngest vs cron simples — racional:**
- **pg-boss vence aqui claramente:**
  - **Zero infra extra:** usa o Postgres que você já tem. BullMQ exige Redis (mais um container, mais memória, ~50MB).
  - **Cron embutido:** `boss.schedule('draw-raffle-2026-05', '0 22 * * *', { raffleId: '...' })` — sortear todo dia 22h.
  - **Atomic:** jobs são linhas em tabela `pgboss.job` com `FOR UPDATE SKIP LOCKED` — não perde job no crash, não duplica execução.
  - **Single-instance friendly:** sem necessidade de coordenação entre workers (você tem 1 VPS).
- **BullMQ** é melhor pra alta vazão (10k jobs/min) com Redis cluster — overkill pra ~100 reservas/mês de doces de bairro.
- **Inngest** é serverless-first; estaria pagando uma plataforma externa pra job que roda numa VPS de R$ 30. Antieconômico.
- **Cron + endpoint HTTP** (estilo `app/api/cron/draw-raffle/route.ts` chamado por crontab da VPS) **funciona** mas: (a) não tem retry automático em falha; (b) não tem visibilidade ("este job rodou? quanto tempo?"); (c) precisa autenticar via secret token; (d) crash do server perde execução. Aceitável pra MVP simplíssimo, mas pg-boss é tão simples quanto e dá o resto de graça.

**Onde rodar pg-boss:**
- Worker no mesmo container Next.js, iniciado via [`instrumentation.ts`](https://nextjs.org/docs/app/guides/instrumentation) (suportado em Next 16):
  ```ts
  // instrumentation.ts
  export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const { boss } = await import('./lib/queue')
      await boss.start()
      // registrar handlers...
    }
  }
  ```
- Em cluster Docker pequeno é OK; se um dia escalar pra múltiplos containers, pg-boss `singleton` jobs evitam duplicação automaticamente.

**Casos do projeto que precisam de pg-boss v1:**
- **Sortear ao fim do prazo:** `boss.send('draw-raffle', { raffleId }, { startAfter: prazoFim })`.
- **Email transacional async:** `boss.send('send-email', { template: 'reservation-created', to, data })` — Server Action retorna rápido, worker dispara via Resend.
- **Expirar lote vencido:** cron job 1x/dia: `boss.schedule('expire-lots', '0 3 * * *')` que marca lotes com `validade < now()` como `expired`.
- **Lembrete de retirada:** `boss.send('pickup-reminder', { reservationId }, { startAfter: '2 hours' })` quando mãe confirma.

> **v1 obrigatório:** pg-boss. Confiança: **HIGH**.

### Deploy / Hospedagem da VPS

| Approach | Recommendation | Why |
|----------|---------------|-----|
| **Docker Compose direto** | ✅ **Escolha pra v1** | Simples, sem PaaS extra, você controla tudo, sem CVEs de orquestrador |
| Dokploy | ⚠️ Considerar pra Phase 5+ | Boa UI mas adiciona ~350MB RAM e é mais coisa pra atacar |
| **Coolify** | ❌ **Não usar agora** | 11 CVEs críticas (CVSS 10.0) divulgadas em janeiro/2026 — fix em beta.451+, mas histórico de hardening fraco |
| systemd direto (sem Docker) | ❌ Não recomendado | Perde isolamento, dependência de Node version global, dor pra rollback |

**Compose stack v1 (`docker-compose.yml` na raiz):**
```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports: ["127.0.0.1:3000:3000"]   # só local; nginx faz reverse proxy
    env_file: .env.production
    depends_on: [db]
    volumes:
      - ./uploads:/app/uploads        # persistência das fotos
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: doces
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

**Reverse proxy: nginx (instalado no host, não em container)** — a doc oficial do Next 16 (`self-hosting.md`) menciona explicitamente nginx. Configurar:
- TLS via **Caddy** ou **certbot** (Let's Encrypt). Caddy é mais simples (renovação automática sem cron extra). **Recomendação: Caddy** rodando direto no host.
- Disable buffering pra streaming funcionar: `proxy_buffering off;` (ou `X-Accel-Buffering: no` via Next.js — exemplo na doc).
- Limite upload pra fotos: `client_max_body_size 10M;`.

**Dockerfile — usar `output: 'standalone'` em `next.config.ts`:**
```ts
const nextConfig: NextConfig = {
  output: 'standalone',  // copia só o que precisa pra rodar
  reactCompiler: true,
}
```
Imagem final fica ~150MB ao invés de ~1GB (sem `node_modules`).

**Atenção Next 16 multi-instance:** se um dia rodar mais de 1 container, **definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** (ver `self-hosting.md`) pra Server Actions funcionarem com load balancer. Pra v1 single-container, não precisa.

> **v1 obrigatório:** Docker Compose + Caddy + nginx-NA-host (ou Caddy fazendo tudo). Confiança: **HIGH**.

### Backup automático

| Tool | Purpose | Notes |
|------|---------|-------|
| `pg_dump` (do Postgres) | Dump diário do banco | Roda dentro do container db: `docker exec doces-db pg_dump -U postgres doces \| gzip > backup-$(date +%F).sql.gz` |
| `rclone` | Upload pro Cloudflare R2 (free 10GB) | Lê config `~/.config/rclone/rclone.conf` |
| **cron do host** | Agendamento | `0 3 * * * /usr/local/bin/backup-doces.sh` — não pg-boss aqui (backup precisa rodar mesmo se app cair) |

**Script `/usr/local/bin/backup-doces.sh`:**
```bash
#!/bin/bash
set -e
DATE=$(date +%F)
BACKUP_DIR=/var/backups/doces
mkdir -p $BACKUP_DIR
docker exec doces-db pg_dump -U postgres doces | gzip > $BACKUP_DIR/db-$DATE.sql.gz
tar czf $BACKUP_DIR/uploads-$DATE.tar.gz -C /opt/doces uploads/
rclone copy $BACKUP_DIR r2:doces-backups --include "*-$DATE.*"
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete   # mantém 30 dias local
rclone delete --min-age 90d r2:doces-backups       # 90 dias no R2
```

**Por que rclone e não AWS CLI:** rclone tem driver R2 nativo, configuração interativa simples (`rclone config`), suporta retry e bandwidth limit, e é uma dep só (binário Go).

> **v1 obrigatório:** sim, dia 1. Não dá pra ter sistema da mãe rodando sem backup. Confiança: **HIGH**.

### Monitoring / Alertas

| Tool | Tier | Purpose |
|------|------|---------|
| **Better Stack** (free tier) | Free: 10 monitores, 30s checks, 1 status page, alertas email | **Recomendação v1** — gerenciado, não precisa hospedar mais nada |
| Uptime Kuma | Self-hosted free | Alternativa se quiser zero dep externa; +1 container pra manter |
| **Pino** (logger) | Free | Logs estruturados JSON dentro da app |

**Better Stack vs Uptime Kuma — racional:**
- **Better Stack** vence pra esse caso porque: (a) "se a VPS cair, quem te avisa?" — Uptime Kuma rodando na MESMA VPS não te avisa quando a VPS está down (single point of failure); (b) você é único responsável técnico, fica fora do horário comercial — alerta SMS/email pago de fora é tranquilidade real; (c) free tier com 10 monitores é mais que suficiente (site, API, status do banco via endpoint `/api/health`).
- **Uptime Kuma** entra se você for orquestrar isso a partir de outro VPS / casa / etc.

**Endpoint de health pra Better Stack monitorar:**
```ts
// app/api/health/route.ts
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return Response.json({ ok: true, db: 'up' })
  } catch (e) {
    return Response.json({ ok: false, db: 'down' }, { status: 503 })
  }
}
```

**Logs:** Pino com transport `pino-pretty` em dev e JSON puro em prod. Em VPS, redirecionar `docker logs` pra `journald` (config padrão do Docker no Ubuntu/Debian) — `journalctl -u docker -f` em SSH dá o mesmo que CloudWatch em casinha.

> **v1 obrigatório:** Better Stack free + endpoint `/api/health` + Pino. Confiança: **HIGH**.

### Qualidade de código

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| ESLint | **^9** (já instalado, flat config) | Lint | Next 16 removeu `next lint`; usar `eslint .` direto |
| `eslint-config-next` | **16.2.4** | Regras Next + React | Já instalado |
| **TypeScript strict** | (ativar em `tsconfig.json`) | Type-safety máxima | `"strict": true, "noUncheckedIndexedAccess": true` |
| **`@t3-oss/env-nextjs`** | **0.13.11** | Validação de env vars com Zod | Pega `DATABASE_URL` faltando em build, não em runtime na sua mãe |

> **v1 obrigatório:** ESLint flat config + TS strict + t3-env. Confiança: **HIGH**.

### Testes (deferido)

Pra um sistema que será usado por 1 admin (a mãe) + ~50 clientes do bairro, **TDD obrigatório é overhead**. Mas algumas coisas têm que ser testadas:

| Tool | When | Why |
|------|------|-----|
| **Vitest** + **@testing-library/react** | Pra lógica de cálculo de custo unitário, margem, sorteio aleatório, conversão de pontos | Erros aqui = lucro errado. Não-negociável testar |
| **Playwright** | Phase 4+, smoke test do fluxo "cliente reserva" | Defere |

> **Pode esperar Phase 3:** quando começar lógica de pricing/lotes (custos imutáveis precisam de teste). Confiança: **MEDIUM** (julgamento sobre prioridade, não sobre as ferramentas).

---

## Installation

### v1 dia 1 (instalar antes de codar feature)

```bash
# Banco/ORM
npm install @prisma/client
npm install -D prisma
npx prisma init  # cria prisma/schema.prisma + .env

# Auth
npm install better-auth

# Validação + forms
npm install zod react-hook-form @hookform/resolvers

# Email
npm install resend @react-email/components @react-email/render svix

# Upload de imagens
npm install sharp

# UI (Tailwind v4 já instalado)
npx shadcn@latest init
# depois, sob demanda:
npx shadcn@latest add button form input label dialog sheet toast sonner table

# Background jobs
npm install pg-boss

# Logging + env
npm install pino
npm install -D pino-pretty
npm install @t3-oss/env-nextjs

# Datas pt-BR
npm install date-fns
```

### Quando migrar pra R2 (Phase 4+)

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Sistema (host VPS, fora do package.json)

```bash
# Docker + compose
sudo apt install docker.io docker-compose-plugin

# Caddy (TLS automático)
sudo apt install caddy

# rclone (backup)
sudo apt install rclone

# nginx OU usa Caddy como reverse proxy também (recomendado)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Prisma 7 | Drizzle | Se equipe quiser SQL puro versionável e bundle mínimo absoluto; foi a escolha original da research, revisada em 2026-04-30 |
| Prisma 7 | Kysely | Se já existir DBA/SQL-first culture; aqui Prisma 7 ganha por DX/Studio |
| Better Auth | Auth.js v5 | Se for adicionar 5+ provedores OAuth (Google + GitHub + Apple…) — Auth.js tem mais providers prontos |
| postgres.js | node-postgres (pg) | Se quiser ecossistema mais maduro; ~10% mais lento mas mais bibliotecas (Connect Pool, etc) |
| Docker Compose | Dokploy | Quando começar a ter mais de 1 app na VPS (ex: Doces Valentina + segundo projeto) e quiser UI |
| pg-boss | BullMQ | Se ultrapassar ~10k jobs/dia (improvável aqui) ou precisar real-time pub/sub |
| Better Stack | Uptime Kuma + outro VPS | Se já tiver outra infra própria fora deste VPS pra hospedar o monitor |
| shadcn/ui | Mantine | Se quisesse uma lib "tudo já vem" e não tivesse Tailwind v4 |
| sharp | jimp | Se ambiente não puder instalar binário nativo (raríssimo em VPS Linux) |
| React Email | Maizzle | Se quiser puro Tailwind sem React e tiver designer que escreve HTML/CSS de email |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Lucia Auth** | Deprecated em março/2025; o próprio mantenedor recomenda Better Auth | Better Auth |
| **Coolify (versões pre-beta.451)** | 11 CVEs críticas CVSS 10.0 divulgadas em janeiro/2026 | Docker Compose direto ou Dokploy |
| **`middleware.ts`** | **Renomeado pra `proxy.ts` em Next 16**. Nome velho ainda funciona mas marca como deprecated | `proxy.ts` (runtime Node.js, não Edge) |
| **Edge Runtime pra auth** | Em Next 16 o `proxy.ts` é Node.js-only; Edge não suportado | Node runtime (default) |
| **`unstable_cache`** | Removido em Next 16 — `cache` API estável agora | `'use cache'` directive ou `cacheTag()`/`cacheLife()` |
| **`next/legacy/image`** | Deprecated em Next 16 | `next/image` puro |
| **`images.domains`** | Deprecated em Next 16 (problema de segurança — sem path matching) | `images.remotePatterns` |
| **JWT-only sessions com email/senha** | Não dá pra revogar (logout numa sessão não invalida outras devices). Crítico pra usuária não-técnica que pode logar em vários celulares e perder um | DB sessions via Better Auth |
| **Postfix self-hosted no VPS** | IPs de VPS quase sempre em blocklist (Spamhaus, etc); deliverability < 30%. Já decidido no PROJECT.md | Resend |
| **bcryptjs (puro JS)** | Slow loop em JS é vulnerável a timing; também 100x mais lento que bcrypt nativo | argon2 (default Better Auth) ou bcrypt nativo |
| **`fetch` com `cache: 'no-store'` por todo lado** | Cache do Next 16 é por componente agora — usar `'use cache'` quando faz sentido, request-time APIs (cookies/headers) já forçam dynamic | Compor com `<Suspense>` + `'use cache'` |
| **next-auth v4** | Muito código antigo; v5 é breaking; e ainda assim Better Auth é melhor pra esse caso | (ver Auth) |
| **`prisma migrate dev` em PROD** | Tenta criar shadow DB; em PROD VPS pequena pode falhar | `prisma migrate deploy` em PROD (só aplica, não cria shadow); `prisma migrate dev` apenas em DEV |

---

## Stack Patterns by Variant

**Se a mãe começar a usar de tablet o dia inteiro durante produção:**
- Garantir PWA-like behavior: `app/manifest.ts` + `apple-touch-icon` + `theme-color` matching paleta sazonal.
- Service worker pra cache offline (Next 16 PPR + `cacheComponents` ajuda; ver doc `progressive-web-apps.md` em `node_modules/next/dist/docs/`).

**Se passar de 5GB de fotos (~200 produtos × 25 fotos × 1MB):**
- Migrar pra Cloudflare R2. Adicionar `@aws-sdk/client-s3`. Manter código de upload atrás de uma interface (`StorageProvider`) pra trocar sem refazer features.

**Se chegar perto de bater limite Resend (3k emails/mês):**
- Avaliar templates por evento: emails de extrato pode virar PDF baixável no painel ao invés de email diário. Reduz volume sem perder UX.

**Se a mãe pedir "modo escuro" ou "modo Páscoa":**
- shadcn já vem com `data-theme` switching via CSS vars — basta criar `.theme-easter`, `.theme-christmas` em `globals.css` e ler `season` do banco no Server Component.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.2.4` | `react@19.2.4`, `react-dom@19.2.4` | React 19.2 é canary; pinned pelo Next 16 |
| `next@16.2.4` | Node.js **>=20.9.0** (LTS) | Node 18 não suportado mais |
| `next@16.2.4` | TypeScript **>=5.1** | Required |
| `prisma@7.x` | `@prisma/client@7.x` | Sempre atualizar juntos (mesma minor) |
| `prisma@7.x` | Postgres 16+ | Suporta `numeric(19,4)` via `@db.Decimal(19,4)` |
| `better-auth@1.6.x` | `next@16.x`, `prisma@7.x` | Adapter Prisma oficial; verificar issue de compat antes de instalar |
| `tailwindcss@4` | shadcn/ui CLI **4.6.x+** | shadcn antes da 4.0 não suporta Tailwind v4 |
| `react@19.2` | `babel-plugin-react-compiler@1.0.0` | Já no devDeps; precisa habilitar `reactCompiler: true` |
| `pg-boss@12.x` | Postgres **12+** | Usa `FOR UPDATE SKIP LOCKED` |
| `@react-email/components@1.x` | `@react-email/render@2.x` | render virou major sep da components |
| `resend@6.x` | Node 18+ | Compatível com fetch global |

---

## Sources

### Authoritative (HIGH confidence)

- **Next.js 16 docs (local em `node_modules/next/dist/docs/`):**
  - `01-app/02-guides/upgrading/version-16.md` — breaking changes, middleware → proxy, async APIs, cacheComponents, image config defaults
  - `01-app/02-guides/self-hosting.md` — reverse proxy nginx, multi-instance, env vars, encryption key
  - `01-app/02-guides/authentication.md` — recommended libs (Better Auth listado, Lucia NÃO listado), DAL pattern, Server Actions security
  - `01-app/02-guides/forms.md` — Server Actions + Zod pattern oficial
  - `01-app/02-guides/production-checklist.md` — security, taint API, env vars
- **`npm view <pkg> version` (verificado em 2026-04-29; ORM revisado 2026-04-30):** Prisma 7.x (latest — verificar `npm view prisma version` antes de instalar), @prisma/client 7.x, Better Auth 1.6.9, Resend 6.12.2, sharp 0.34.5, pg-boss 12.18.1, Zod 4.3.6, react-hook-form 7.74.0, shadcn 4.6.0, lucide-react 1.14.0, sonner 2.0.7, date-fns 4.1.0, pino 10.3.1, @t3-oss/env-nextjs 0.13.11

### Verified secondary (MEDIUM confidence)

- [Better Auth Next.js integration docs](https://better-auth.com/docs/integrations/next) — proxy.ts compatibility, signInEmail flow
- [Better Auth issue #5263 — Next 16 support](https://github.com/better-auth/better-auth/issues/5263)
- [Lucia deprecation announcement & Better Auth recommendation (Wisp blog, libhunt, daily.dev)](https://www.wisp.blog/blog/lucia-auth-is-dead-whats-next-for-auth)
- [Coolify CVE disclosure January 2026 (TheHackerNews, securityonline.info)](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html) — patches em beta.451+
- [Prisma 7 docs](https://www.prisma.io/docs) — schema, migrations, Studio, driver adapters
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma) — config, session/user models
- [Resend + Next.js docs](https://resend.com/docs/send-with-nextjs) — webhook handling, React Email pattern
- [pg-boss GitHub README](https://github.com/timgit/pg-boss) — singleton jobs, cron syntax
- [shadcn/ui Tailwind v4 support](https://ui.shadcn.com/docs/tailwind-v4)
- [Dokploy comparison (LogRocket, MassiveGRID)](https://blog.logrocket.com/dokploy-vs-coolify-production/) — RAM footprint, Compose-friendly
- [Better Stack vs Uptime Kuma comparison (Better Stack Community)](https://betterstack.com/community/comparisons/uptime-kuma-alternative/) — free tier specifics

### Single-source / lower confidence (LOW)

- Versão exata Prisma 7 latest — verificar `npm view prisma version` antes de instalar em cada phase; Prisma 7 ainda relativamente novo, pode ter patches frequentes

---

*Stack research for: reserva online de doces caseiros + admin de pricing/fidelização*
*Researched: 2026-04-29 — para Doces Valentina*
