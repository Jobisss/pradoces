# Phase 1: Foundation — Research

**Researched:** 2026-04-30
**Domain:** Infraestrutura defensável + auth completa (cliente + admin) + LGPD baseline + audit log + email infra + schema-base com `numeric(19,4)` e `timestamptz`
**Confidence:** HIGH (decisões locked em CONTEXT.md; APIs verificadas em Next 16 docs locais + Better Auth docs oficiais + Prisma 7 docs oficiais + npm registry; pitfalls cruzados com OWASP/ANPD/CF)

---

## Executive Summary

Phase 1 não tem domínio. É só fundação. Apesar disso, é a fase com mais REQ-IDs (29) e mais bloqueadores legais/segurança do projeto inteiro. A pesquisa abaixo destila o que a planner precisa saber pra que cada um dos 5 success criteria saia inteiro do executor:

- **Stack travado por D-09 e CONTEXT.md** — Prisma 7.8.0 (não Drizzle) + Better Auth 1.6.9 (adapter Prisma + `admin` plugin + `nextCookies` + custom hash argon2id) + pg-boss 12.18.1 (boot via `instrumentation.ts`) + Resend 6.12.2 + svix 1.92.2 + @t3-oss/env-nextjs 0.13.11 + pino 10.3.1 + @node-rs/argon2 2.0.2 + decimal.js 10.6.0. Versões verificadas em npm 2026-04-30. [VERIFIED: npm view]
- **Next 16 quebra com training data em 4 lugares relevantes pra Phase 1**: `middleware.ts` virou `proxy.ts` runtime Node-only; `cookies()`/`headers()`/`params`/`searchParams` são todos `await` obrigatórios; `experimental.serverActions.allowedOrigins` continua em `experimental` no Next 16.2 (não mudou de lugar); `next lint` removido — usar `eslint .` direto. [VERIFIED: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`]
- **Better Auth dá Phase 1 quase pronta de graça** — `requireEmailVerification: true`, `revokeSessionsOnPasswordReset: true`, `sendVerificationEmail`/`sendResetPassword` callbacks que casam direto com Resend+React Email, plugin `admin` que adiciona campo `role` no User com valor `'admin'|'user'` (vamos remapear pra `'admin'|'customer'` per D-06), `nextCookies()` plugin que automatiza `await cookies()` em Server Actions, handler em `app/api/auth/[...all]/route.ts`. [CITED: better-auth.com/docs/integrations/next, /authentication/email-password, /plugins/admin]
- **Argon2id parameters OWASP 2025**: 5 tradeoffs publicados; pra VPS pequena (2GB RAM) recomendar `m=19456 KiB (19 MiB), t=2, p=1` (segundo perfil OWASP — CPU/RAM equilibrado). Override via `password.hash`/`verify` callbacks de Better Auth usando `@node-rs/argon2`. [CITED: cheatsheetseries.owasp.org/Password_Storage_Cheat_Sheet]
- **Pitfall #1 não-óbvio do Phase 1: `@upstash/ratelimit` NÃO tem modo memory** — exige Redis. CONTEXT.md "Claude's Discretion" sugeriu como candidato; pesquisa contradiz. Recomendação: usar `rate-limiter-flexible` 11.0.1 com `RateLimiterMemory` (zero deps externas) ou implementar token-bucket sliding window manual em ~30 linhas. Decisão fica no planner mas a discretion mention de `@upstash/ratelimit` precisa virar override. [VERIFIED: upstash.com/docs/redis/sdks/ratelimit-ts]
- **Pitfall #2 não-óbvio: rota Better Auth é `[...all]` não `[...path]`** — CONTEXT.md "Integration Points" mencionou `/api/auth/[...path]/route.ts` mas a doc oficial do Better Auth usa `[...all]`. Convenção, ambos funcionam, mas seguir `[...all]` evita confusão na hora de copiar exemplos. [CITED: better-auth.com/docs/integrations/next]
- **Pitfall #3 não-óbvio: Caddy + Cloudflare exige módulo `caddy-trusted-cloudflare`** — diretiva `trusted_proxies cloudflare` requer plugin oficial Cloudflare; com Caddy stock só dá pra hardcode CIDRs. O plugin embedded no Caddy main do `apt install caddy` em Ubuntu/Debian recente já vem com isso, mas em distros antigas precisa `xcaddy build` com `caddyserver/caddy-trusted-cloudflare`. Documentar comando de verificação. [CITED: caddyserver.com/docs/caddyfile/directives/reverse_proxy + Cloudflare warning sobre `X-Forwarded-For` spoofing]
- **Schema Phase 1 = 5 modelos Prisma, 1 enum, 5 índices unique**: `User` (com role/+18/terms/privacy/email_verified_at/anonimização fields), `Session` (Better Auth nativo), `Account` (Better Auth — guarda `password` hash de credenciais), `Verification` (Better Auth — token de email-verify e reset), `AuditLog` (custom, schema genérico desde Phase 1 per CONTEXT.md). Money fields: zero em Phase 1, mas convenção `Decimal @db.Decimal(19, 4)` documentada pra Phase 2 herdar. Datetime sempre `DateTime @db.Timestamptz(6)`.
- **Bootstrap admin via CLI seed** (D-05) — `pnpm seed:admin` chama Better Auth `auth.api.signUpEmail({ body: { email, password, name }, asResponse: false })` em loop "find or create", marca `emailVerified: true` direto, atualiza `role='admin'`, escreve `audit_log`. Reset (D-07) usa `auth.api.setUserPassword` (admin plugin) + revoga sessões via `auth.api.revokeUserSessions` + audit_log. Sem rota web.
- **CSP Phase 1 minimalista**: `default-src 'self'; script-src 'self' 'nonce-{NONCE}' 'strict-dynamic'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests`. Fraunces vem de Google Fonts → permitir gstatic. Resend/Cloudflare beacon NÃO em Phase 1 (Phase 4 adiciona). [CITED: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`]
- **pg-boss boot harness ready, sem worker domain** — `instrumentation.ts` chama `register()` que faz `if (process.env.NEXT_RUNTIME === 'nodejs')` e dá `boss.start()`. Phase 1 não registra `boss.work()` de domínio (não tem domínio) mas DEVE registrar 1 worker noop (`boss.work('healthcheck', async () => null)`) pra provar que o harness liga; Phase 4 substitui por workers reais. Idempotência: `boss.start()` é idempotente.

**Primary recommendation:** Build order **Wave 0 → Wave 1 → Wave 2 → Wave 3 → Wave 4** (ver §Build Order abaixo). Não inverter. CSP/UFW/CF DNS são as 3 últimas tarefas — sem elas o sistema funciona local e em DEV; antes delas, PROD não sobe.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Página inicial `/` em Phase 1 (visitante)** — Visitante não-logado em `/` vê landing simples + 2 CTAs. Hero curto: "Em breve: reserva os doces caseiros da Valentina" + brand wordmark Fraunces (UI-SPEC §Typography) + 2 parágrafos institucionais (1-2 frases cada, voz "vizinha" per UI-SPEC §Brand & Voice Guardrails) + 2 botões: **"Criar minha conta"** (primary, accent `#9D2D7A`, leva a `/cadastro`) + **"Entrar"** (secondary, surface+border, leva a `/entrar`). Quando Phase 3 chegar, esse `/` vira a vitrine.

**D-02: Página inicial `/` (cliente logado)** — Cliente já logado em `/` vê a mesma landing visualmente, com CTAs trocados: "Minha conta" (primary, leva a `/minha-conta/meus-dados`) + "Sair" (secondary, `POST /api/auth/sair`). O hero/copy continua igual — não vira app-shell. Estado resolvido por Server Component lendo a sessão; sem flicker.

**D-03: Footer fino global** em todas as surfaces públicas + cliente. Conteúdo: `Doces Valentina · [Termos] · [Privacidade] · Dúvidas sobre seus dados? dpo@docesvalentina.com.br`. 1 linha em mobile (wrap natural), 2 linhas em ≥md. Footer **NÃO aparece** no `/admin/*` (admin shell tem layout próprio com sidebar — UI-SPEC §Mobile-First Layout Contract).

**D-04: Página inicial `/` (admin logado)** — Mãe logada (sessão admin) abrindo `/` vê a landing pública igual ao visitante, mas o header troca o CTA do canto direito para **"Painel admin"** (primary, leva a `/admin`) + **"Sair"** (secondary). Permite a ela testar como cliente vê o site sem precisar deslogar.

**D-05: Bootstrap admin via CLI seed** — Script `pnpm seed:admin` lê `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` do `.env` da VPS, valida (email format, senha ≥8 chars), hasheia argon2id (parâmetros OWASP), insere em `User` com `role='admin'` e `emailVerified=true`, grava em `AuditLog` com `action='admin_seed_via_cli'`. Sem rota web, sem dependency em Resend pra bootstrap.

**D-06: Conta única com role enum** em `users`. Coluna `role` (enum `admin | customer`, default `customer`, NOT NULL). 1 usuário = 1 role. Admin (mãe) não tem `/minha-conta/*` — middleware (proxy.ts) redireciona pra `/admin` se `role='admin'` acessar `/minha-conta/*`. Cliente não tem `/admin/*` — proxy.ts retorna 403 com copy UI-SPEC.

**D-07: Reset de senha admin via CLI break-glass**, NÃO via web. `pnpm seed:admin --reset` aceita flag que: encontra user com `role='admin'` (deve haver exatamente 1 — falha se 0 ou >1), hasheia nova senha do `.env` (`ADMIN_RESET_PASSWORD`), atualiza, revoga todas as sessões ativas, grava em `AuditLog` com `action='admin_password_reset_via_cli'`. `/admin` **não tem rota web de reset**.

**D-08: Sem email proativo em login admin**. Cada login admin grava em `AuditLog` com `action='admin_login'` + IP + user-agent (per AUTH-11), mas **não dispara email**. Mãe vê o histórico em `/admin/auditoria`.

**D-09: Prisma 7** (não Drizzle) como ORM. Schema em `prisma/schema.prisma`, migrations em `prisma/migrations/`. Better Auth adapter Prisma. `prisma.$queryRaw` para Postgres-only features. **Atenção crítica:** Prisma 7 tem mudanças importantes vs v6 (Rust engine removido) — researcher e planner DEVEM ler docs Prisma 7 oficiais antes de propor APIs.

### Claude's Discretion

- **Conteúdo de Termos & Privacidade v1**: Phase 1 entrega o **shell estrutural** das rotas `/termos` e `/privacidade` com **conteúdo placeholder pt-BR baseado em template padrão** (LGPD-03 lista os operadores reais — Resend EUA, Cloudflare, hospedagem). `terms_version` e `privacy_version` no schema `users` ficam como `'v1.0-shell'`. Revisão jurídica leve fica como item v1.x antes do launch público real. O fluxo de cadastro **não bloqueia** por causa do placeholder.

- **Audit log granularidade e schema**: Schema **genérico desde Phase 1** pra evitar migration em Phase 2. Tabela `AuditLog` com colunas `(id BigInt @id @default(autoincrement()), actorType String, actorId String?, action String, entityType String?, entityId String?, metadata Json?, ipHash String?, uaHash String?, ts DateTime @default(now()) @db.Timestamptz(6))`. Phase 1 popula apenas `action IN ('admin_login', 'admin_seed_via_cli', 'admin_password_reset_via_cli', 'customer_account_deleted')`. UI `/admin/auditoria` em Phase 1 lista todos os eventos ordenados desc por `ts`, com formato copy `{quando} — {quem} — {ação}` per UI-SPEC §Admin copy.

- **Rate limit backend**: in-memory single-instance (single VPS, single Next.js container — sobrevive a deploy mas não a restart, é aceitável pra v1). Per-IP em `/api/auth/*` (10 req/min sliding window) e per-email em `/api/auth/esqueci-senha` (3 req/15min). Implementação via `rate-limiter-flexible` v11 com `RateLimiterMemory` (substitui sugestão original de `@upstash/ratelimit` que NÃO tem modo memory — ver §Rate Limit abaixo).

- **Página `/` raiz para sessão admin com cookie cliente**: edge-case improvável. Comportamento: prevalece cookie/sessão mais recente; sem dialog. Se ambos cookies presentes (race), proxy.ts lê admin primeiro.

### Deferred Ideas (OUT OF SCOPE)

- **Email-on-novo-IP em login admin** (D-08 alternativa rejeitada): heurística de hash truncado de IP+UA detectando dispositivo novo e disparando email "Novo dispositivo entrou no painel". Adicionar em v1.x se virar problema de segurança real.
- **Dual-role na mesma conta** (D-06 alternativa rejeitada): admin + cliente coexistindo no mesmo user. Re-avaliar se v2 ganhar admin secundário.
- **UI 'primeiro setup' guarded por flag** (D-05 alternativa rejeitada): self-service bootstrap. Útil se projeto virar template/produto distribuível.
- **Email-reset admin compartilhado com cliente** (D-07 alternativa rejeitada): reset web pro admin via mesmo fluxo OWASP. Pode ser adicionado em v1.x se CLI ficar atrito.

### Out of scope (de outras fontes — ROADMAP/STATE)

- **OPS-01..06**: backup com drill mensal automático, monitoring externo Better Stack, OPERATIONS.md, Bitwarden, CF granular WAF + Turnstile, status de backup visível — v1.x.
- **SEC-01..03**: MFA admin, linter ANVISA, anonimização programada após 5 anos — v1.x.
- **Domain features completas**: ingredientes, lotes, reservas, pontos, sorteios, sazonalidade, relatórios — Phases 2-7.
- **Backup em pg-boss/Better Stack** — Phase 1 NÃO entrega backup automatizado (v1.x); a tabela `_pgboss_*` será criada pelo `boss.start()` mas zero workers de domínio.

---

## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------------------------|------------------|
| INFRA-01 | Deploy via Docker Compose (Next.js standalone + Postgres 16 + Caddy) numa VPS única | §Cloudflare/Caddy/UFW + Docker Compose stack |
| INFRA-02 | Cloudflare Proxy laranja ativo; IP da VPS NUNCA exposto | §Cloudflare/Caddy/UFW (DNS records, proxy mode) |
| INFRA-03 | UFW bloqueia tudo exceto 80/443 (apenas IPs CF) e SSH (apenas IP do dev) | §Cloudflare/Caddy/UFW (UFW ruleset + cron CF IP refresh) |
| INFRA-04 | Rate limit em `/api/auth/*` (in-memory, sem Redis) | §Rate Limit (`rate-limiter-flexible` RateLimiterMemory) |
| INFRA-05 | Server Actions com `allowedOrigins` configurado e CSP no `next.config.ts` | §CSP & Security Headers + §Middleware/proxy.ts |
| INFRA-06 | Validação de variáveis de ambiente com `@t3-oss/env-nextjs` no build | §Env Validation (env.ts schema completo) |
| INFRA-07 | Logging com pino + redact de PII | §Logging (pino redact paths) |
| INFRA-08 | Migrations versionadas via Prisma Migrate (`prisma migrate dev`/`deploy`); expand-then-contract | §Schema Design + §Build Order (passo "Initial migration") |
| INFRA-09 | Money em `numeric(19,4)` em TODA coluna financeira; decimal.js no app | §Schema Design (convenção documentada — Phase 1 sem money columns ainda) |
| INFRA-10 | Datas em `timestamptz`; `TZ=America/Sao_Paulo` no app + postgres.conf | §Schema Design + §Env Validation (TZ no env.ts) |
| INFRA-11 | `instrumentation.ts` inicializa workers pg-boss no boot | §pg-boss Boot Harness |
| INFRA-12 | Habilita `reactCompiler: true` no `next.config.ts` | §next.config.ts (já preparado em scaffold; só ativar) |
| AUTH-01 | Cliente cria conta com email + senha + nome + telefone (todos obrigatórios) | §Auth Flows (cadastro step 2 schema) |
| AUTH-02 | Cadastro inteligente — email-first, verifica existência, abre cadastro completo se não existe | §Auth Flows (fluxo cadastro F1 — duas chamadas) |
| AUTH-03 | "Talvez você tenha digitado o email errado, tente fazer login" antes de bloquear duplicata | §Auth Flows (UX leak controlado em cadastro) |
| AUTH-04 | Verificação de email obrigatória no cadastro (link 24h) | §Auth Flows + Better Auth `requireEmailVerification: true` |
| AUTH-05 | Recuperação OWASP — token único 32 bytes, hash no DB, expiração 30-60min, single-use, revoga sessões | §Auth Flows (Better Auth `sendResetPassword` + `revokeSessionsOnPasswordReset` + `resetPasswordTokenExpiresIn`) |
| AUTH-06 | Senhas hasheadas com argon2id (parâmetros OWASP) | §Argon2id Setup (`@node-rs/argon2` custom hash) |
| AUTH-07 | Mensagens genéricas em fluxos sensíveis (anti-enumeration) | §Auth Flows (UI-SPEC copy literal) |
| AUTH-08 | Cliente loga e mantém sessão (Better Auth com sessions DB) | §Auth Flows (Better Auth default = sessions DB) |
| AUTH-09 | Cliente acessa painel próprio (saldo, histórico, pontos) | §Surface Inventory (Phase 1 só renderiza `/minha-conta/meus-dados` shell — saldo/histórico vem em Phase 4) |
| AUTH-10 | Admin tem login único da mãe; rotas `/admin/*` protegidas por middleware (proxy.ts) | §Middleware/proxy.ts (admin guard) |
| AUTH-11 | Audit log mínimo registra: quem confirmou qual reserva, quem mudou qual preço, quem criou qual lote, quem fez login admin | §Audit Log (Phase 1 popula `admin_login` + `admin_seed_via_cli` + `admin_password_reset_via_cli` + `customer_account_deleted`; Phase 2+ adiciona o resto) |
| LGPD-01 | Checkbox "Tenho 18+" obrigatório no cadastro | §LGPD Baseline (`isAdult` field + UI-SPEC copy literal) |
| LGPD-02 | Aceite versionado: `terms_version`, `terms_accepted_at`, `privacy_version`, `privacy_accepted_at` | §LGPD Baseline (User schema fields) |
| LGPD-03 | Política descreve operadores reais (Resend EUA, Cloudflare, hospedagem) e retenção (5 anos) | §LGPD Baseline (`/privacidade` content brief) |
| LGPD-04 | Página "Meus dados" com botão de exportação JSON | §LGPD Baseline (`/api/me/export` payload shape) |
| LGPD-05 | Página "Excluir minha conta" — anonimiza (preserva histórico fiscal, troca dados pessoais por placeholders, revoga sessões) | §LGPD Baseline (anonimização SQL + flow) |
| LGPD-06 | Email de DPO visível em rodapé/política | §LGPD Baseline + UI-SPEC §Footer (`dpo@docesvalentina.com.br`) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cadastro/login UI (forms, copy, validation client-side) | Frontend Server (RSC) | Browser (cliente RHF se necessário em Phase 2+) | Phase 1 forms são simples — `<form action={serverAction}>` com `useActionState`, progressive enhancement. Doc oficial Next 16. |
| Cadastro/login lógica (hash, sessão, token gen) | API / Backend (Server Actions) | — | Better Auth `auth.api.signUpEmail` chamado de Server Action. Server-only, nunca bundle pro client. |
| Sessions store | Database (Postgres `Session` table) | — | Sessions DB (não JWT) per stack decision; Better Auth session token opaque + cookie httpOnly + sameSite=lax + secure |
| Rate limit | API / Backend (proxy.ts ou Server Action wrapper) | — | In-memory `rate-limiter-flexible` no processo Next; sliding window per-IP/per-email. NUNCA na CDN (Cloudflare granular é v1.x). |
| Email send (verify + reset) | API / Backend (Better Auth callbacks) → background | External (Resend) | Better Auth chama `sendVerificationEmail`/`sendResetPassword` SÍNCRONO no Server Action; em Phase 1 OK, em Phase 4 mover pra pg-boss. Por ora, assíncrono via `void` na callback (não bloqueia). |
| Audit log writes | API / Backend (Server Actions / scripts seed) | Database (`AuditLog` table) | Service `lib/audit/log.ts` chama `prisma.auditLog.create` explícito (não interceptor — research Architecture B6). |
| Audit log read (admin UI) | Frontend Server (RSC `/admin/auditoria/page.tsx`) | Database | Página é async server component; `prisma.auditLog.findMany` direto. |
| LGPD export | API / Backend (Server Action ou Route Handler) → JSON download | Database | `/api/me/export` Route Handler retorna `Response` com `Content-Disposition: attachment`; payload coletado por service `lib/lgpd/export.ts`. |
| LGPD anonimize | API / Backend (Server Action) | Database | `lib/lgpd/anonymize.ts` faz UPDATE em transação + `auth.api.revokeUserSessions` + AuditLog write. |
| CSP / security headers | API / Backend (proxy.ts) | — | CSP em proxy.ts (não em next.config.ts headers — proxy permite nonce dinâmico). |
| TLS termination | CDN/Edge (Cloudflare Full-Strict) + Frontend Server (Caddy) | — | Cloudflare termina TLS pro browser; Caddy auto-LE termina TLS entre CF e VPS (Full-Strict mode). |
| DDoS / origin hiding | CDN/Edge (Cloudflare proxy) + Network (UFW) | — | Cloudflare proxy laranja + UFW só permite IPs CF nas portas 80/443. |
| pg-boss boot | API / Backend (`instrumentation.ts`) | Database (`pgboss.*` tables auto-criadas) | `register()` chama `boss.start()` 1× no boot Node; idempotent. |
| Static assets (Fraunces font, favicon) | CDN/Edge (Cloudflare cache) + Frontend Server (Next `/public` ou Google Fonts CDN) | — | Fraunces serve do `fonts.gstatic.com` via `<link>` em `app/layout.tsx`; CSP `font-src` permite. |

---

## Standard Stack

### Core (Phase 1 obrigatório)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 (já instalado) | Framework | Locked por PROJECT.md |
| `react` / `react-dom` | 19.2.4 (já instalado) | Runtime | Pinned pelo Next 16 |
| `prisma` | 7.8.0 | CLI migrations + Studio + generate | D-09 LOCKED 2026-04-30. [VERIFIED: `npm view prisma version` 2026-04-30] |
| `@prisma/client` | 7.8.0 | Cliente type-safe (Prisma 7 = TS puro, Rust engine removido) | Pareado com prisma CLI. [VERIFIED: `npm view @prisma/client version`] |
| `better-auth` | 1.6.9 | Auth completo (sessions DB, email/senha, plugins admin + nextCookies) | Lucia deprecated; Next 16 ready (issue #5263) |
| `@node-rs/argon2` | 2.0.2 | Argon2id nativo (Rust binding via napi-rs) — usado por Better Auth `password.hash`/`verify` override | Recomendado pela própria doc do Better Auth. Mais rápido que `argon2` puro JS, sem GYP build. [CITED: better-auth.com/docs/authentication/email-password] |
| `resend` | 6.12.2 | SDK email transacional | Locked |
| `@react-email/components` | 1.0.12 | Componentes React pra emails | Pareado |
| `@react-email/render` | 2.0.8 | Renderiza React Email → HTML | Pareado |
| `svix` | 1.92.2 | Verificação webhook Resend (Resend usa Svix internamente) | Locked |
| `pg-boss` | 12.18.1 | Queue + cron sobre Postgres | Locked |
| `pino` | 10.3.1 | Logger estruturado | Locked |
| `pino-pretty` | latest devDep | Pretty-print em DEV | Pareado |
| `@t3-oss/env-nextjs` | 0.13.11 | Validação env Zod-based no build | Locked |
| `zod` | 4.4.1 | Schema validation (Server Actions + env + LGPD payload) | Locked |
| `decimal.js` | 10.6.0 | Cálculos monetários no app (Phase 2+) | Convenção Phase 1; primeira coluna money chega em Phase 2 |
| `date-fns` | 4.1.0 | Formatação pt-BR (`format(..., { locale: ptBR })`) | Locked |
| `rate-limiter-flexible` | 11.0.1 | RateLimiterMemory (in-memory sliding window) | **OVERRIDE** da CONTEXT.md "Claude's Discretion" — `@upstash/ratelimit` NÃO tem modo memory; verificado em upstash.com/docs |

### UI (já em UI-SPEC.md)

| Library | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^4 (já instalado) | Utility-first CSS |
| `@tailwindcss/postcss` | ^4 (já instalado) | PostCSS plugin |
| `shadcn` (CLI) | 4.6.x (não dep — invoked via `npx shadcn init`) | Componentes copy-paste |
| `lucide-react` | 1.14.0 | Ícones |
| `sonner` | 2.0.7 | Toast notifications |
| `@radix-ui/*` | (auto-instalado pelo shadcn add) | Accessibility primitives |
| Fraunces (Google Font) | Variable | Brand wordmark — UI-SPEC §Typography |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `babel-plugin-react-compiler` | 1.0.0 (já instalado) | React Compiler 1.0 | Ativar `reactCompiler: true` em `next.config.ts` (INFRA-12) |
| `eslint` | ^9 (já instalado, flat config) | Lint | Next 16 removeu `next lint`; usar `eslint .` direto |
| `eslint-config-next` | 16.2.4 (já instalado) | Regras Next + React | Pareado |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `rate-limiter-flexible` | Custom token-bucket em ~30 LOC | Custom é zero-deps mas requer testar edge cases; lib é battle-tested. Lib vence. |
| `@node-rs/argon2` | `argon2` (puro JS, ranisalt/node-argon2) | Puro JS é 2-3× mais lento; native binding via napi-rs (não GYP) é a recomendação Better Auth oficial. [CITED: better-auth.com] |
| Better Auth `[...all]` route | `[...path]` (mencionado em CONTEXT.md "Integration Points") | Funcionalmente igual; `[...all]` é convenção da doc oficial Better Auth e dos exemplos copiáveis. Recomendar `[...all]`. |
| Caddy auto-managed cert | Cloudflare Origin CA cert + Caddy `tls /path/to/cert.pem` | Origin CA dá cert de 15 anos; auto-LE renova sozinho. Caddy auto-LE vence pra simplicidade (zero cron). Ambos funcionam — escolher Caddy auto-LE per STACK.md. |
| Resend `sendVerificationEmail` callback síncrono | Enfileirar em pg-boss desde Phase 1 | Em Phase 1 com volume zero, síncrono OK. Phase 4 com 100+ reservas/dia, mover. Documentar em backlog. |

**Installation:**

```bash
# Banco/ORM (D-09)
npm install @prisma/client@7.8.0
npm install -D prisma@7.8.0
npx prisma init

# Auth
npm install better-auth@1.6.9 @node-rs/argon2@2.0.2

# Email
npm install resend@6.12.2 @react-email/components@1.0.12 @react-email/render@2.0.8 svix@1.92.2

# Background jobs
npm install pg-boss@12.18.1

# Logging + env + validation
npm install pino@10.3.1 zod@4.4.1 @t3-oss/env-nextjs@0.13.11
npm install -D pino-pretty

# Money + datas
npm install decimal.js@10.6.0 date-fns@4.1.0

# Rate limit (OVERRIDE — não usar @upstash/ratelimit)
npm install rate-limiter-flexible@11.0.1

# UI
npx shadcn@latest init
npx shadcn@latest add button input label form checkbox card alert sonner separator skeleton table
npm install lucide-react@1.14.0 sonner@2.0.7
```

**Version verification:** Antes de instalar em PR, planner deve rodar `npm view prisma version` + `npm view better-auth version` + `npm view @node-rs/argon2 version` pra confirmar versões publicadas; Prisma 7 ainda relativamente novo (publicado 2026-Q1) e pode ter patches frequentes.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Source | Impact on Phase 1 |
|-----------|--------|-------------------|
| **Read `node_modules/next/dist/docs/` before writing Next.js code** | AGENTS.md raiz | Researcher cumpriu (version-16.md, instrumentation.md, content-security-policy.md, forms.md, authentication.md, serverActions.md). Planner DEVE re-checar antes de gerar código. |
| **Read Prisma 7 official docs + `node_modules/@prisma/client/` before coding** (Prisma 7 has breaking changes vs v6) | CLAUDE.md / AGENTS.md (D-09 alert) | Researcher cumpriu (prisma.io/docs §schema-reference, §setup-and-configuration). Planner DEVE re-checar APIs como `$queryRaw` typing e Driver Adapters API antes de proposar uso. |
| **commit_docs: true** | `.planning/config.json` | `.planning/` artifacts SEMPRE commitados; planner inclui commit step para CONTEXT/RESEARCH/PLAN/UI-SPEC ao final de cada wave. |
| **pt-BR primary** | PROJECT.md, UI-SPEC §Brand & Voice | Todo string visível ao usuário (UI, email subjects, CSP error pages, audit log row format) em pt-BR. Identificadores de código em inglês permitidos. |
| **Mobile-first, AA contrast, 44px touch, 16px floor type, no hover-only** | UI-SPEC §Interaction & A11y Contract | Forms cadastro/login com sticky CTA mobile, autocomplete attrs locked, sonner toast top-center mobile / top-right desktop. |
| **security_enforcement: true, ASVS Level 1, block_on: high** | `.planning/config.json` | Pesquisa inclui §Security Domain abaixo. Planner DEVE gerar tasks de validação de cada controle. |
| **nyquist_validation: true** | `.planning/config.json` | Pesquisa inclui §Validation Architecture abaixo (mandatório). |
| **No `commit_docs` skip; `mode: yolo`** | `.planning/config.json` | Plans podem fazer commits direto sem extra approval; mantém `.planning/` versionado. |
| **paleta pink-bordô `#9D2D7A` accent / `#FFF6FB` bg / `#ED91DB` accent-soft (decorative-only)** | UI-SPEC §Color | shadcn `init` com `new-york` + `neutral` baseColor + override CSS vars manual em `globals.css`. |

---

## Architecture Patterns

### System Architecture Diagram (Phase 1 boundary)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                                │
│            (mobile primário; desktop ≥md em /admin/*)                 │
│              │                                                        │
│              │  HTTPS                                                 │
│              ▼                                                        │
├──────────────────────────────────────────────────────────────────────┤
│                  CLOUDFLARE EDGE (proxy laranja)                     │
│   • Termina TLS pro browser                                          │
│   • Esconde IP origin                                                │
│   • Sets X-Forwarded-For, CF-Connecting-IP                           │
│              │                                                        │
│              │  HTTPS Full-Strict (CF cert no edge → Caddy LE no VPS)│
│              ▼                                                        │
├──────────────────────────────────────────────────────────────────────┤
│                  VPS (Hostinger ou similar, ~R$ 30/mês)              │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ UFW: 22 só do dev IP, 80/443 só de IPs CF, resto DROP        │  │
│   └──────────────────────────────────────────────────────────────┘  │
│              │                                                        │
│              ▼                                                        │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ Caddy (host, NÃO container) — auto-LE, trusted_proxies CF    │  │
│   │ → reverse_proxy 127.0.0.1:3000                                │  │
│   └────────────────────────┬─────────────────────────────────────┘  │
│                            │ HTTP local                              │
│                            ▼                                         │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ Docker Compose                                                │  │
│   │  ┌──────────────────┐    ┌──────────────────────┐             │  │
│   │  │ Next.js 16       │    │ Postgres 16-alpine   │             │  │
│   │  │ standalone build │◄──►│ TZ='America/SP'       │             │  │
│   │  │                  │    │ pgboss.* schema       │             │  │
│   │  │ instrumentation  │    │ public.User/Session   │             │  │
│   │  │  → pg-boss start │    │ public.Account/Verif. │             │  │
│   │  │  → 0 workers v1  │    │ public.AuditLog       │             │  │
│   │  │                  │    └──────────────────────┘             │  │
│   │  │ proxy.ts         │                                          │  │
│   │  │  (admin guard +  │                                          │  │
│   │  │   CSP + nonce +  │                                          │  │
│   │  │   role redirect) │                                          │  │
│   │  │                  │                                          │  │
│   │  │ app/api/auth/    │                                          │  │
│   │  │  [...all]/       │                                          │  │
│   │  │   route.ts       │                                          │  │
│   │  │   (Better Auth)  │                                          │  │
│   │  │                  │                                          │  │
│   │  │ app/api/me/      │                                          │  │
│   │  │  export/route.ts │                                          │  │
│   │  │                  │                                          │  │
│   │  │ app/api/         │                                          │  │
│   │  │  webhooks/       │                                          │  │
│   │  │  resend/         │                                          │  │
│   │  │  route.ts (svix) │                                          │  │
│   │  └──────────────────┘                                          │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                            │                                         │
│                            │ HTTPS outbound                          │
│                            ▼                                         │
├──────────────────────────────────────────────────────────────────────┤
│                          EXTERNAL SERVICES                           │
│   • Resend API (email-verify + password-reset)                       │
│   • Resend webhooks (svix-signed) → /api/webhooks/resend             │
│   • Cloudflare DNS (records configurados pelo dev — não app)         │
└──────────────────────────────────────────────────────────────────────┘

CLI scripts (rodam dentro do container Next.js via docker exec):
   ┌──────────────────────────────────────────────────────────────┐
   │ pnpm seed:admin       (D-05: cria/garante admin)             │
   │ pnpm seed:admin --reset (D-07: troca senha admin + revoga)   │
   │ pnpm prisma migrate deploy (PROD migrations)                 │
   │ pnpm prisma migrate dev    (DEV — cria shadow DB)            │
   └──────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 1)

```
app/
├── layout.tsx                       # Root: header global + footer global (D-03) + sonner provider
├── page.tsx                         # Landing D-01/D-02/D-04 (3 variants por sessão)
├── (public)/
│   ├── cadastro/page.tsx            # AUTH-01..04 + LGPD-01..02
│   ├── entrar/page.tsx              # AUTH-08, AUTH-10 (cliente; admin tem rota separada)
│   ├── esqueci-minha-senha/
│   │   ├── page.tsx                 # AUTH-05/AUTH-07
│   │   └── enviado/page.tsx         # confirmação genérica
│   ├── redefinir-senha/[token]/
│   │   └── page.tsx                 # AUTH-05
│   ├── auth/confirmar-email/[token]/
│   │   └── page.tsx                 # AUTH-04
│   ├── termos/page.tsx              # LGPD-02/LGPD-03 — placeholder shell
│   └── privacidade/page.tsx         # LGPD-03/LGPD-06 — placeholder shell
├── (cliente)/
│   └── minha-conta/
│       ├── meus-dados/page.tsx      # LGPD-04..06
│       └── excluir/page.tsx         # LGPD-05 (typed-email confirm gate)
├── (admin)/
│   └── admin/
│       ├── layout.tsx               # admin shell sem footer global (D-03)
│       ├── entrar/page.tsx          # AUTH-10 (admin login)
│       ├── page.tsx                 # admin home — só placeholder pra Phase 7
│       └── auditoria/page.tsx       # AUTH-11 (lista AuditLog)
├── api/
│   ├── auth/[...all]/route.ts       # Better Auth handler
│   ├── me/
│   │   ├── export/route.ts          # LGPD-04 — JSON download
│   │   └── delete/route.ts          # LGPD-05 — anonimize + revoke + redirect
│   └── webhooks/
│       └── resend/route.ts          # NOTIF-04 (Phase 4 popula handler; Phase 1 só skeleton + svix verify)
└── globals.css                      # Tailwind v4 + CSS vars per UI-SPEC §Color

prisma/
├── schema.prisma                    # 5 models + 1 enum (ver §Schema Design)
└── migrations/
    └── 20260501_init/migration.sql  # Initial migration

lib/
├── env.ts                           # @t3-oss/env-nextjs validation (INFRA-06)
├── log.ts                           # pino singleton + redact paths (INFRA-07)
├── db/
│   └── client.ts                    # PrismaClient singleton (globalThis pattern)
├── auth/
│   ├── server.ts                    # betterAuth() init + adapter Prisma + plugins
│   ├── client.ts                    # createAuthClient() pra Client Components (ainda raro em Phase 1)
│   └── argon2.ts                    # @node-rs/argon2 wrapper com OWASP params
├── email/
│   ├── resend.ts                    # Resend client singleton
│   ├── send-verification.tsx        # React Email template + send
│   └── send-password-reset.tsx      # React Email template + send
├── lgpd/
│   ├── export.ts                    # Service: monta JSON payload de export
│   └── anonymize.ts                 # Service: UPDATE anonimização + revoke + audit
├── audit/
│   └── log.ts                       # Service: prisma.auditLog.create wrapper com redact
├── ratelimit/
│   └── memory.ts                    # rate-limiter-flexible RateLimiterMemory configs
├── queue/
│   └── boss.ts                      # PgBoss singleton + start()
└── validation/
    ├── auth.ts                      # Zod schemas (signup, signin, reset)
    └── lgpd.ts                      # Zod schema (delete confirmation)

scripts/
└── seed-admin.ts                    # D-05/D-07 CLI

instrumentation.ts                   # INFRA-11 — pg-boss boot

proxy.ts                             # AUTH-10 + INFRA-05 — admin guard + CSP + role redirect

next.config.ts                       # reactCompiler: true (INFRA-12), output: 'standalone',
                                     # experimental.serverActions.allowedOrigins (INFRA-05)

Caddyfile                            # Caddy config (host, não container)
docker-compose.yml                   # app + db
.env.example                         # template pra dev
```

### Pattern 1: Server Action with auth + Zod + Prisma

**What:** Padrão idiomático Next 16 para mutações em forms — `<form action={actionName}>` + `'use server'` + Zod parse + Prisma call + revalidate.

**When to use:** Toda Server Action de Phase 1 (signup, signin, reset, esqueci-senha, lgpd-delete). NÃO usar `useEffect` + `fetch` (anti-pattern AP6 da Architecture research).

**Example:**

```typescript
// Source: node_modules/next/dist/docs/01-app/02-guides/forms.md + authentication.md
// lib/actions/auth.ts
'use server'

import { auth } from '@/lib/auth/server'
import { SignupSchema } from '@/lib/validation/auth'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

export async function signupCustomer(_prev: unknown, formData: FormData) {
  // 1. Rate limit by IP (per-IP 10/min)
  const h = await nextHeaders() // ASYNC em Next 16
  const ip = h.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) {
    return { error: 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.' }
  }

  // 2. Validate
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Esse email não parece certo. Confere o `@` e o `.com`.', fieldErrors: parsed.error.flatten() }
  }

  // 3. Call Better Auth
  try {
    await auth.api.signUpEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.nome,
      },
    })
  } catch (e) {
    // Generic error — anti-enumeration (AUTH-07)
    return { error: 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.' }
  }

  // 4. Better Auth dispara sendVerificationEmail callback automaticamente quando requireEmailVerification:true
  //    Nada a fazer aqui

  // 5. Redirect para tela "verifique seu email"
  redirect('/cadastro/verifique-seu-email')
}
```

### Pattern 2: PrismaClient singleton

**What:** Evitar hot-reload spawning múltiplos `PrismaClient` em DEV.

**When to use:** Toda importação do client em qualquer arquivo do projeto.

**Example:**

```typescript
// Source: prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
// lib/db/client.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Pattern 3: pg-boss boot via instrumentation.ts

**What:** Iniciar pg-boss 1× quando Next sobe (Node runtime); idempotent.

**When to use:** INFRA-11 — Phase 1 entrega o harness com 0 workers de domínio (provar que liga). Phase 4 adiciona `boss.work('send-email', ...)`.

**Example:**

```typescript
// Source: node_modules/next/dist/docs/01-app/02-guides/instrumentation.md + github.com/timgit/pg-boss
// instrumentation.ts (na raiz, NÃO em app/)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { boss } = await import('./lib/queue/boss')
    await boss.start() // idempotent; safe se já rodando
    // Phase 1: ZERO workers de domínio. Apenas prova que harness está ligado.
    // Phase 4 vai adicionar: boss.work('send-email', sendEmailHandler)
  }
}
```

```typescript
// lib/queue/boss.ts
import PgBoss from 'pg-boss'
import { env } from '@/lib/env'

const globalForBoss = globalThis as unknown as { boss: PgBoss | undefined }

export const boss = globalForBoss.boss ?? new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: 'pgboss', // namespace dedicado, não polui public
})

if (process.env.NODE_ENV !== 'production') globalForBoss.boss = boss
```

### Pattern 4: proxy.ts (Next 16 — NÃO middleware.ts)

**What:** Combinação de admin guard + role redirect (D-06) + CSP nonce + Server Actions origin check.

**When to use:** Único proxy.ts do projeto.

**Example:** (ver §Middleware/proxy.ts abaixo para versão completa).

### Anti-Patterns to Avoid (Phase 1 específicos)

- **`middleware.ts`** — Next 16 renomeou para `proxy.ts`. Função antiga ainda funciona com warning, mas não usar. [VERIFIED: docs/upgrading/version-16.md §625]
- **`cookies()` síncrono** — em Next 16 é `await cookies()`. Better Auth `nextCookies()` plugin lida com isso, mas qualquer uso direto precisa `await`. [VERIFIED: version-16.md §294]
- **`@upstash/ratelimit` em modo memory** — não existe; exige Redis. Usar `rate-limiter-flexible` `RateLimiterMemory`. [VERIFIED: upstash.com/docs]
- **`useEffect` + `fetch` em RSC** — RSC busca dados direto via Prisma; só Client Components com interação real precisam de `useState`/`useEffect`. [CITED: research/ARCHITECTURE.md AP6]
- **Email send dentro de transação SQL** — Phase 1 não tem TX explícita ainda, mas qualquer `prisma.$transaction` que chame `resend.emails.send` é AP. Better Auth `sendVerificationEmail`/`sendResetPassword` callbacks rodam FORA de TX por design. [CITED: research/ARCHITECTURE.md AP7]
- **Hardcoding paleta no CSS** — UI-SPEC define CSS vars (`--color-accent: #9D2D7A`). Phase 6 sobrescreve sazonal; hardcode quebra Phase 6.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email/password auth | Custom JWT + bcrypt loop | Better Auth + Prisma adapter | Lucia deprecated; rolling-your-own missa: rate limit, refresh, "remember me", reset OWASP, email verify, secure cookie defaults |
| Argon2id hash | `argon2` puro JS | `@node-rs/argon2` (Rust napi binding) | 2-3× mais rápido; recomendação oficial Better Auth; sem GYP build em VPS |
| Password reset token gen + hash + expire + single-use + revoke sessions | Custom rota /esqueci-senha + tabela tokens | Better Auth `sendResetPassword` + `revokeSessionsOnPasswordReset: true` + `resetPasswordTokenExpiresIn: 3600` | Better Auth implementa OWASP-compliant out-of-the-box (token criptograficamente seguro, hashed em DB via tabela `Verification`, single-use, expira) |
| Email verification token gen + 24h expire + click-to-confirm landing | Custom rota /verify + tabela | Better Auth `sendVerificationEmail` + `requireEmailVerification: true` | Mesmo motivo |
| CSRF protection em Server Actions | Custom token middleware | `experimental.serverActions.allowedOrigins` em next.config.ts + cookies SameSite=Lax automático Better Auth | Next 16 valida `Origin` em Server Actions por padrão; `allowedOrigins` lista hosts adicionais [CITED: data-security.md] |
| CSP nonce | String concat manual em `<script>` | proxy.ts gera nonce com `crypto.randomUUID()` + dispara via `Content-Security-Policy` header + `request.headers.set('x-nonce', ...)` | [CITED: content-security-policy.md] |
| Background jobs/cron | `setInterval` em route handler ou node-cron in-process | pg-boss + `instrumentation.ts` boot | `setInterval` em route handler é AP (handler chamado múltiplas vezes); pg-boss `FOR UPDATE SKIP LOCKED` previne duplicação |
| Webhook signature verification | HMAC manual | `svix.Webhook(secret).verify(rawBody, headers)` | svix é o que Resend usa internamente |
| Env validation | `if (!process.env.X) throw` | `@t3-oss/env-nextjs createEnv()` | Falha em build, não runtime; types automáticos |
| PII redaction em logs | `JSON.stringify` com replacer custom | pino com `redact: { paths: [...] }` | Built-in, perf-otimizado |
| Rate limit | `Map<ip, count>` manual com setTimeout | `rate-limiter-flexible` RateLimiterMemory | Sliding window correto, lib battle-tested, ainda zero-deps externas (memory-only) |
| Route protection middleware | Custom session check em cada page | proxy.ts central com `getSessionCookie(request)` | Better Auth helper; 1 lugar, todas rotas |
| Anonimização LGPD | DELETE em cascata | UPDATE com placeholders + `auth.api.revokeUserSessions` | DELETE quebra histórico fiscal (5 anos retention); UPDATE preserva ID e relações |

**Key insight:** Auth flow tem ~12 sub-features que são inteiramente "tabela já posta" pelo Better Auth — researcher e planner devem resistir à tentação de implementar manualmente "porque entendemos melhor". Reset de senha caseiro foi a #1 causa de CVE em apps PHP da década passada (OWASP Top 10 A07).

---

## Schema Design (Prisma 7)

### `prisma/schema.prisma` (Phase 1 final)

```prisma
// Source: prisma.io/docs/orm/prisma-schema-reference + better-auth.com/docs/concepts/database
// + better-auth.com/docs/plugins/admin
// + CONTEXT.md "Claude's Discretion" (audit_log schema)

generator client {
  provider        = "prisma-client-js"
  // Prisma 7: output path is REQUIRED (per better-auth/docs/adapters/prisma note)
  output          = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  admin
  customer
}

// === Better Auth core models (estendidos) ===

model User {
  id              String    @id @default(uuid()) @db.Uuid
  email           String    @unique @db.Text
  emailVerified   Boolean   @default(false)
  name            String    @db.Text
  image           String?   @db.Text

  // === Doces Valentina extensions ===
  telefone        String?   @db.Text                       // AUTH-01 (obrigatório no cadastro cliente; opcional no schema pq admin via CLI pode pular)
  role            Role      @default(customer)             // D-06; admin plugin Better Auth lê esse campo (mapear via plugin config)

  // === Better Auth admin plugin extensions ===
  banned          Boolean?  @default(false)
  banReason       String?   @db.Text
  banExpires      DateTime? @db.Timestamptz(6)

  // === LGPD-01 (+18 checkbox) ===
  isAdult            Boolean   @default(false)             // checkbox obrigatório no cadastro

  // === LGPD-02 (consent versioning) ===
  termsVersion       String    @db.Text                    // 'v1.0-shell' em Phase 1
  termsAcceptedAt    DateTime  @db.Timestamptz(6)
  privacyVersion     String    @db.Text                    // 'v1.0-shell' em Phase 1
  privacyAcceptedAt  DateTime  @db.Timestamptz(6)

  // === LGPD-05 (anonymization) ===
  deletedAt         DateTime? @db.Timestamptz(6)           // marca de soft-delete (UPDATE, não DELETE)
  anonymizedAt      DateTime? @db.Timestamptz(6)           // quando UPDATE de anonimização rodou

  createdAt       DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt      @db.Timestamptz(6)

  sessions        Session[]
  accounts        Account[]

  @@index([email])
  @@index([role])
  @@map("users") // Postgres convenção snake_case (research B1 mantém)
}

model Session {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @db.Uuid
  token           String    @unique @db.Text                // Better Auth opaque session token
  expiresAt       DateTime  @db.Timestamptz(6)
  ipAddress       String?   @db.Text
  userAgent       String?   @db.Text
  // === Better Auth admin plugin ===
  impersonatedBy  String?   @db.Uuid

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt       DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt      @db.Timestamptz(6)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

model Account {
  // Better Auth: guarda credenciais (incl. password hash) e/ou OAuth tokens
  // Em Phase 1, providerId='credential' para email/senha; sem OAuth.
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @db.Uuid
  accountId       String    @db.Text
  providerId      String    @db.Text                       // 'credential' em Phase 1
  password        String?   @db.Text                       // argon2id hash (somente quando providerId='credential')

  // OAuth fields (não usados em Phase 1, mas Better Auth schema requer presença)
  accessToken           String?   @db.Text
  refreshToken          String?   @db.Text
  accessTokenExpiresAt  DateTime? @db.Timestamptz(6)
  refreshTokenExpiresAt DateTime? @db.Timestamptz(6)
  scope                 String?   @db.Text
  idToken               String?   @db.Text

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt       DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt      @db.Timestamptz(6)

  @@unique([providerId, accountId])
  @@index([userId])
  @@map("accounts")
}

model Verification {
  // Better Auth: tokens de email-verify (24h) e password-reset (30-60min)
  id              String    @id @default(uuid()) @db.Uuid
  identifier      String    @db.Text                       // tipicamente email
  value           String    @db.Text                       // token HASHED (Better Auth hasheia antes de salvar)
  expiresAt       DateTime  @db.Timestamptz(6)

  createdAt       DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt      @db.Timestamptz(6)

  @@unique([identifier, value])
  @@index([expiresAt])
  @@map("verifications")
}

// === Doces Valentina audit log (genérico desde Phase 1 — CONTEXT.md "Claude's Discretion") ===

model AuditLog {
  id          BigInt   @id @default(autoincrement())       // bigserial
  actorType   String   @db.Text                            // 'admin' | 'customer' | 'system' | 'cli'
  actorId     String?  @db.Uuid                            // null pra 'system' / 'cli' anônimos
  action      String   @db.Text                            // 'admin_login', 'admin_seed_via_cli', etc.
  entityType  String?  @db.Text                            // null em Phase 1 (Phase 2+ popula 'lote', 'reserva', 'preco')
  entityId    String?  @db.Text                            // null em Phase 1
  metadata    Json?                                        // payload livre (e.g., { reservation_id, old_price, new_price })
  ipHash      String?  @db.Text                            // SHA-256 do IP (não plaintext — LGPD)
  uaHash      String?  @db.Text                            // SHA-256 do User-Agent
  ts          DateTime @default(now()) @db.Timestamptz(6)

  @@index([ts(sort: Desc)])
  @@index([action])
  @@index([actorId])
  @@map("audit_log")
}
```

### ER Diagram (text)

```
┌──────────────────────┐         ┌──────────────────────┐
│       User           │ 1     N │       Session        │
│  id (uuid PK)        │────────►│  id (uuid PK)        │
│  email (unique)      │         │  userId (FK)         │
│  role (admin|customer)         │  token (unique)      │
│  isAdult, termsV...  │         │  expiresAt           │
│  deletedAt, anon...  │         │  impersonatedBy      │
└──────────┬───────────┘         └──────────────────────┘
           │ 1
           │
           │ N
┌──────────▼───────────┐
│      Account         │  Better Auth: providerId='credential' + password hash
│  id (uuid PK)        │  (1 user pode ter N accounts no futuro com OAuth; Phase 1 sempre 1)
│  userId (FK)         │
│  providerId          │
│  accountId           │
│  password (argon2)   │
│  @@unique [provider, account]
└──────────────────────┘

┌──────────────────────┐
│    Verification      │  Standalone — não FK pra User (Better Auth identifica por email)
│  id (uuid PK)        │
│  identifier (email)  │
│  value (hashed token)│
│  expiresAt           │
└──────────────────────┘

┌──────────────────────┐
│      AuditLog        │  Standalone — actorId é Uuid mas não FK (preserva log mesmo após anonimização)
│  id (bigserial PK)   │
│  actorType, actorId  │
│  action              │
│  entityType, entityId│
│  metadata (jsonb)    │
│  ipHash, uaHash      │
│  ts                  │
└──────────────────────┘
```

### Money convention (Phase 1 não tem money column, mas convenção locked)

```prisma
// Exemplo Phase 2 (referência apenas — NÃO incluir em schema Phase 1):
model IngredienteCompra {
  precoTotal   Decimal @db.Decimal(19, 4)   // INFRA-09: numeric(19,4)
  qtdeComprada Decimal @db.Decimal(19, 4)
  // ...
}
```

[VERIFIED: prisma.io/docs §schema-reference — `@db.Decimal(p, s)` syntax exato]

### Index summary

| Table | Index | Purpose |
|-------|-------|---------|
| users | `@@index([email])` (auto via unique) | Login lookup |
| users | `@@index([role])` | Admin filter rápido em /admin/auditoria filtros futuros |
| sessions | `@@index([userId])` | Revoke all sessions for user (reset) |
| sessions | `@@index([expiresAt])` | Cron de expiração (Phase 4+) |
| accounts | `@@unique([providerId, accountId])` | Better Auth lookup |
| accounts | `@@index([userId])` | Carregar credenciais do user |
| verifications | `@@unique([identifier, value])` | Lookup de token (Better Auth) |
| verifications | `@@index([expiresAt])` | Cron de expiração |
| audit_log | `@@index([ts(sort: Desc)])` | Listagem em /admin/auditoria |
| audit_log | `@@index([action])` | Filtro futuro |
| audit_log | `@@index([actorId])` | "todas ações desse user" |

---

## Auth Flows (Better Auth)

### F1: Cadastro cliente email-first (AUTH-02 + AUTH-03 + AUTH-04)

```
[Cliente em /cadastro]
   ↓ digita email + clica "Continuar"
[Server Action: checkEmailExists(email)]
   ↓ chama auth.api.getUser({ email }) ou prisma.user.findUnique
   ↓
   ├── existe E NOT deletedAt → retorna { exists: true }
   │      → Cliente vê "Esse email já tem conta. Talvez você tenha digitado errado..." (UI-SPEC AUTH-03)
   │      → Botões: "Tentar fazer login" (→ /entrar) | "Não, é outro email" (volta ao step 1)
   │
   ├── existe E deletedAt (foi anonimizado) → trata como "não existe" (cliente pode recadastrar)
   │
   └── NÃO existe → mostra step 2 (senha + nome + telefone + +18 + termos)
        ↓ submit
        [Server Action: signupCustomer(formData)]
           ↓ Zod valida (email, senha ≥8, nome, telefone, isAdult, termsAccepted)
           ↓ rate limit IP (10/min)
           ↓ chama auth.api.signUpEmail({ body: { email, password, name } })
              ├── Better Auth INSERT user (role default → customer via Better Auth schema; nosso schema force role=customer)
              ├── INSERT account (providerId='credential', password = argon2id hash)
              ├── INSERT verification (token random 32-byte hex hashed)
              ├── trigger sendVerificationEmail callback
              │     ↓ React Email <VerifyEmail url={url} /> → resend.emails.send
              ↓
           ↓ Server Action update user: SET telefone, isAdult, termsVersion='v1.0-shell',
              termsAcceptedAt=now(), privacyVersion='v1.0-shell', privacyAcceptedAt=now()
           ↓ AuditLog INSERT (action='customer_signup', actorId=newUserId, ipHash, uaHash)
           ↓ redirect → /cadastro/verifique-seu-email
```

### F2: Confirmação de email (AUTH-04)

```
[Cliente clica link no email]
   ↓ vai pra /auth/confirmar-email/[token]
[Server Component: page.tsx]
   ↓ chama auth.api.verifyEmail({ token })
      ├── Better Auth: lookup verification por hash, checa expiresAt
      ├── se válido: UPDATE user.emailVerified=true; DELETE verification
      └── se expirado: retorna erro
   ↓
   ├── sucesso → "Email confirmado. Bem-vinda(o)!" + CTA "Entrar agora" → /entrar
   └── erro → "Esse link expirou. Sem problema — pede um novo." + CTA "Reenviar email"
                ↓ Server Action: requestResendVerification(email)
                   → auth.api.sendVerificationEmail({ email })
```

### F3: Login cliente (AUTH-08)

```
[Cliente em /entrar]
   ↓ submete email + senha
[Server Action: signinCustomer(formData)]
   ↓ rate limit IP (10/min)
   ↓ chama auth.api.signInEmail({ body: { email, password } })
      ├── Better Auth: lookup account.password, verifica argon2id (custom hash callback)
      ├── checa user.emailVerified (rejeita se false E requireEmailVerification=true)
      ├── INSERT session (token opaque; cookie httpOnly + sameSite=lax + secure)
      ↓
   ├── sucesso → cookie set automaticamente via nextCookies plugin → redirect /
   └── erro genérico → "Email ou senha não conferem" (anti-enumeration AUTH-07)
```

### F4: Login admin (AUTH-10)

Idêntico a F3, mas:
- Rota dedicada `/admin/entrar` (UI-SPEC) por experiência separada (sem footer global, copy "Entrar como administradora")
- Após sucesso, audit log INSERT (action='admin_login', actorId=user.id, ipHash, uaHash) — D-08 dispensa email
- proxy.ts redireciona se sessão admin tenta acessar `/minha-conta/*` → `/admin`

### F5: Reset de senha cliente OWASP (AUTH-05 + AUTH-07)

```
[Cliente em /esqueci-minha-senha]
   ↓ submete email
[Server Action: requestPasswordReset(email)]
   ↓ rate limit per-email (3/15min) — anti-flood
   ↓ chama auth.api.forgetPassword({ email, redirectTo: '/redefinir-senha' })
      ├── Better Auth: SE user existir, INSERT verification (token 32-byte hashed, expires 60min)
      ├── trigger sendResetPassword callback
      │     ↓ React Email <ResetPassword url={url} token={token} /> → resend
      └── SE user NÃO existir: faz NADA (anti-enumeration; mesmo timing via server-side delay)
   ↓ retorna SEMPRE: "Se esse email estiver cadastrado, você vai receber um link..." (UI-SPEC literal)

[Cliente clica link → /redefinir-senha/[token]]
   ↓ digita nova senha
[Server Action: resetPassword(token, newPassword)]
   ↓ chama auth.api.resetPassword({ token, newPassword })
      ├── Better Auth: lookup verification por hash, checa expiresAt + used flag
      ├── se válido:
      │   • UPDATE account.password com argon2id(newPassword)
      │   • DELETE verification (single-use)
      │   • SE revokeSessionsOnPasswordReset=true: DELETE sessions WHERE userId=...
      │   • trigger onPasswordReset callback
      │     ↓ AuditLog INSERT (action='customer_password_reset', actorId=userId)
      └── se inválido/expirado: erro "Esse link expirou..."
   ↓ sucesso → "Pronto! Sua senha foi atualizada. Pode entrar com a nova." + CTA "Entrar"
```

### F6: Bootstrap admin via CLI (D-05)

```
[Dev em SSH na VPS]
   ↓ docker exec -it doces-app pnpm seed:admin
[scripts/seed-admin.ts]
   ↓ load env: ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD
   ↓ Zod validate (email format, password ≥8)
   ↓ checa se já existe admin no DB:
      └── prisma.user.findFirst({ where: { role: 'admin', deletedAt: null } })
   ├── se existe: log "admin já bootstrapped — use --reset pra trocar senha" + exit 1
   └── se não:
       ↓ chama auth.api.signUpEmail({ body: { email: ADMIN_EMAIL, password: ADMIN_INITIAL_PASSWORD, name: 'Administradora' } })
       ↓ UPDATE user SET role='admin', emailVerified=true, isAdult=true,
          termsVersion='v1.0-shell', termsAcceptedAt=now(), privacyVersion='v1.0-shell', privacyAcceptedAt=now()
       ↓ AuditLog INSERT (actorType='cli', actorId=null, action='admin_seed_via_cli',
          metadata={ email_hash: sha256(email) })
       ↓ console.log "Admin criada. Senha entregue pessoalmente. Mãe pode entrar em /admin/entrar"
```

### F7: Reset admin CLI break-glass (D-07)

```
[Dev em SSH]
   ↓ docker exec -it doces-app pnpm seed:admin --reset
[scripts/seed-admin.ts com flag --reset]
   ↓ load env: ADMIN_RESET_PASSWORD
   ↓ checa que existe EXATAMENTE 1 admin:
      └── prisma.user.count({ where: { role: 'admin', deletedAt: null } }) === 1
       ├── 0: erro "nenhum admin — use seed:admin (sem --reset)" + exit 1
       ├── >1: erro "múltiplos admins — não esperado em v1, fix manual" + exit 1
       └── 1: prossegue
   ↓ chama auth.api.setUserPassword({ userId, newPassword: ADMIN_RESET_PASSWORD }) [admin plugin API]
   ↓ chama auth.api.revokeUserSessions({ userId }) [admin plugin API]
   ↓ AuditLog INSERT (actorType='cli', action='admin_password_reset_via_cli', metadata={ admin_id: userId })
   ↓ console.log "Senha trocada. Sessões antigas revogadas. Entregar pessoalmente."
```

### Better Auth init (consolidação dos flows)

```typescript
// Source: better-auth.com/docs/integrations/next + /authentication/email-password + /plugins/admin
// + /adapters/prisma
// lib/auth/server.ts

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { hash, verify } from '@node-rs/argon2'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'
import { sendVerificationEmail } from '@/lib/email/send-verification'
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset'
import { logAudit } from '@/lib/audit/log'

// OWASP 2025 Argon2id — perfil 2 (CPU/RAM equilibrado pra VPS pequena)
// [CITED: cheatsheetseries.owasp.org/Password_Storage_Cheat_Sheet]
const argon2Opts = {
  memoryCost: 19456,    // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
  algorithm: 2 as const, // Argon2id
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,                // AUTH-04
    revokeSessionsOnPasswordReset: true,           // AUTH-05
    resetPasswordTokenExpiresIn: 3600,             // 60min — OWASP recomenda 30-60min — AUTH-05
    sendResetPassword: async ({ user, url, token }) => {
      void sendPasswordResetEmail({ to: user.email, url, token }) // void = não-blocking
    },
    onPasswordReset: async ({ user }) => {
      await logAudit({
        actorType: user.role === 'admin' ? 'admin' : 'customer',
        actorId: user.id,
        action: user.role === 'admin' ? 'admin_password_reset_via_web' /* não usado em D-07 */ : 'customer_password_reset',
      })
    },
    password: {
      // OWASP argon2id custom (override do scrypt default do Better Auth)
      hash: (pwd) => hash(pwd, argon2Opts),
      verify: ({ password, hash: h }) => verify(h, password, argon2Opts),
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      void sendVerificationEmail({ to: user.email, url, token })  // AUTH-04
    },
  },

  user: {
    // mapeia o `role` field do admin plugin pra nossa enum {admin, customer}
    additionalFields: {
      role:               { type: 'string', defaultValue: 'customer' }, // D-06
      telefone:           { type: 'string', required: false },
      isAdult:            { type: 'boolean', defaultValue: false },     // LGPD-01
      termsVersion:       { type: 'string', required: false },          // LGPD-02
      termsAcceptedAt:    { type: 'date',   required: false },
      privacyVersion:     { type: 'string', required: false },
      privacyAcceptedAt:  { type: 'date',   required: false },
      deletedAt:          { type: 'date',   required: false },          // LGPD-05
      anonymizedAt:       { type: 'date',   required: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,     // 30 dias
    updateAge: 60 * 60 * 24,          // refresh diário
  },

  plugins: [
    admin({
      // Better Auth admin plugin reconhece role='admin'
      adminRoles: ['admin'],
      defaultRole: 'customer',
    }),
    nextCookies(), // Sempre o ÚLTIMO da lista (per Better Auth docs)
  ],

  baseURL: env.BETTER_AUTH_URL,
  secret:  env.BETTER_AUTH_SECRET,
})

export type Auth = typeof auth
```

### Better Auth route handler (CONTEXT.md correção)

```typescript
// CONTEXT.md mencionou `app/api/auth/[...path]/route.ts`
// Doc oficial Better Auth usa `[...all]` — recomendar `[...all]` pra alinhar com exemplos copiáveis
// Source: better-auth.com/docs/integrations/next

// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth/server'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

---

## Middleware/proxy.ts

Next 16: `proxy.ts` na raiz, runtime Node-only, função exportada como `proxy()`.

```typescript
// Source: node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md §625
// + content-security-policy.md §44
// + better-auth.com/docs/integrations/next (getSessionCookie)
// + node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md

// proxy.ts (na raiz, NÃO em app/)
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const PUBLIC_ROUTES = new Set([
  '/', '/cadastro', '/entrar',
  '/esqueci-minha-senha', '/esqueci-minha-senha/enviado',
  '/termos', '/privacidade',
])

const ADMIN_PREFIX = '/admin'
const CUSTOMER_PREFIX = '/minha-conta'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Generate CSP nonce (per-request)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data:;
    connect-src 'self';
    form-action 'self';
    frame-ancestors 'none';
    base-uri 'self';
    object-src 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  // 2. Read session cookie (Better Auth)
  const sessionCookie = getSessionCookie(request) // synchronous helper, lê cookie do Better Auth

  // 3. Route guards
  // 3a. /admin/* requires admin session
  if (pathname.startsWith(ADMIN_PREFIX) && pathname !== '/admin/entrar') {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/admin/entrar', request.url))
    }
    // Note: getSessionCookie só confirma presença; role check precisa de auth.api.getSession (DB hit)
    // Em proxy.ts evitamos DB hit pesado — fazemos role check no layout.tsx do (admin) group via `await auth.api.getSession({ headers })`.
    // Aqui só rejeitamos missing cookie. Layout faz 403 detalhado.
  }

  // 3b. /minha-conta/* — qualquer sessão autêntica passa; layout filtra customer vs admin
  if (pathname.startsWith(CUSTOMER_PREFIX)) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/entrar', request.url))
    }
  }

  // 4. Build response with security headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}

export const config = {
  matcher: [
    // Aplica em tudo EXCETO _next/static, _next/image, favicon, prefetches
    {
      source: '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

**Important caveat:** `getSessionCookie` from `better-auth/cookies` only confirms cookie presence (no DB hit) — full role-based gating happens in `app/(admin)/admin/layout.tsx` via `await auth.api.getSession({ headers: await nextHeaders() })` and a 403 render with UI-SPEC copy if `session.user.role !== 'admin'`. This 2-layer pattern (cookie presence in proxy.ts, DB session in layout) is the Better Auth idiomatic.

### Layout-level role gate (D-06 enforcement)

```typescript
// app/(admin)/admin/layout.tsx
import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) redirect('/admin/entrar')
  if (session.user.role !== 'admin') {
    // UI-SPEC error 403 copy: "Essa parte é só pra administradora..."
    return <div role="alert">Essa parte é só pra administradora. <a href="/minha-conta/meus-dados">vai pra sua conta</a>.</div>
  }
  return <>{children}</>
}

// app/(cliente)/minha-conta/layout.tsx
export default async function MinhaContaLayout({ children }) {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) redirect('/entrar')
  if (session.user.role === 'admin') redirect('/admin') // D-06
  return <>{children}</>
}
```

---

## CSP & Security Headers

| Header | Value | Justification |
|--------|-------|---------------|
| `Content-Security-Policy` | (ver bloco em proxy.ts acima) | Phase 1: nonce-based script, Google Fonts permitido (Fraunces), nada externo |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | **Caddy** seta automático com auto-LE; aplicar via Caddyfile, NÃO duplicar em proxy.ts |
| `X-Content-Type-Options` | `nosniff` | Standard hardening |
| `X-Frame-Options` | `DENY` | Click-jacking — Phase 1 não precisa de iframe |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Vaza o mínimo de origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Defesa em depth — Phase 1 não usa nenhum |

CSP `connect-src 'self'` em Phase 1 é suficiente porque:
- Sem analytics (Cloudflare beacon vai entrar em Phase 7 hardening v1.x)
- Sem Sentry/Datadog (deferido)
- Resend webhook é INBOUND (não outbound do browser)

---

## Rate Limit (override Claude's Discretion)

**OVERRIDE da CONTEXT.md:** `@upstash/ratelimit` foi sugerido como opção em modo memory; pesquisa confirma que **NÃO existe modo memory** — exige Redis. Usar `rate-limiter-flexible` v11.

```typescript
// lib/ratelimit/memory.ts
import { RateLimiterMemory } from 'rate-limiter-flexible'

// Per-IP em /api/auth/* (10 req/min sliding window)
export const rateLimitAuth = new RateLimiterMemory({
  keyPrefix: 'auth-ip',
  points: 10,        // 10 requests
  duration: 60,      // por 60s
  blockDuration: 60, // bloqueia 60s ao estourar
})

// Per-email em /api/auth/esqueci-senha (3/15min)
export const rateLimitForgotEmail = new RateLimiterMemory({
  keyPrefix: 'forgot-email',
  points: 3,
  duration: 60 * 15,
  blockDuration: 60 * 15,
})
```

**Interface stable**: `await limiter.consume(key)` retorna `RateLimiterRes` ou throws `RateLimiterRes` — wrap em try/catch ou `.catch(() => null)` per Server Action pattern (§Architecture Pattern 1 example).

**Trade-off:** in-memory perde state em deploy. Aceito v1 (CONTEXT.md). Quando virar problema (improvável em volume bairro), migra pra `RateLimiterPostgres` da mesma lib (sem Redis).

**Sliding window correctness:** `rate-limiter-flexible` implementa "fixed window with reset" por default, não sliding. Pra sliding real, usar `RateLimiterMemoryEngine` ou `BurstyRateLimiter`. Em Phase 1 com volume zero, fixed window OK; documentar pra v1.x.

---

## LGPD Baseline

### LGPD-01: +18 checkbox

- Schema field: `User.isAdult: Boolean @default(false)`
- UI: checkbox no /cadastro step 2, copy literal UI-SPEC: "Tenho 18 anos ou mais, ou estou com autorização de quem cuida de mim."
- Validação Server Action: rejeita signup se `isAdult !== true` (hard block)

### LGPD-02: aceite versionado

- Schema fields: `User.termsVersion`, `termsAcceptedAt`, `privacyVersion`, `privacyAcceptedAt`
- Phase 1 hardcode: `'v1.0-shell'`
- Quando termos mudarem (v1.x), criar tabela `TermsVersion` e Server Action que pede re-aceite no próximo login (Phase v1.x; FORA do escopo)

### LGPD-03: política descritiva

`/privacidade/page.tsx` placeholder shell com seções obrigatórias (template baseado em LGPD art. 9 + 18):

```markdown
# Política de Privacidade — Doces Valentina (v1.0-shell, 30/04/2026)

## O que coletamos
- Nome, email, telefone (no cadastro)
- Histórico de reservas e pontos (quando você usar o site)
- IP e user-agent (em logs de acesso, hasheados — não plaintext)

## Por que coletamos (base legal — LGPD art. 7)
- Consentimento (cadastro voluntário)
- Execução de contrato (atender sua reserva)

## Quem mais tem acesso (operadores reais — LGPD art. 5 inc. VII)
- **Resend Inc. (Estados Unidos)** — envia nossos emails. Transferência internacional baseada em cláusulas contratuais padrão (LGPD art. 33 inc. II).
- **Cloudflare, Inc. (Estados Unidos)** — protege o site contra ataques. Mesmas garantias.
- **Hostinger International Ltd. (Lituânia)** — hospeda o servidor. Mesmas garantias.

## Por quanto tempo guardamos
- 5 anos para fins fiscais (Decreto 9.580/2018 art. 195).
- Depois desse prazo, anonimizamos (seus dados pessoais viram placeholders; o histórico de venda permanece anônimo).
- Você pode pedir exclusão antes — ver "Seus direitos".

## Seus direitos (LGPD art. 18)
- Saber o que temos sobre você → botão "Baixar meus dados em JSON" em [/minha-conta/meus-dados](/minha-conta/meus-dados)
- Apagar seus dados → botão "Excluir minha conta" em [/minha-conta/excluir](/minha-conta/excluir)
- Corrigir → escreva pra dpo@docesvalentina.com.br
- Reclamar à ANPD → www.gov.br/anpd

## DPO (Encarregada de Tratamento)
**dpo@docesvalentina.com.br** — responde em até 15 dias.
```

### LGPD-04: export JSON

```typescript
// app/api/me/export/route.ts
import { auth } from '@/lib/auth/server'
import { exportUserData } from '@/lib/lgpd/export'
import { headers as nextHeaders } from 'next/headers'

export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const data = await exportUserData(session.user.id)

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="doces-valentina-meus-dados-${new Date().toISOString().split('T')[0]}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

```typescript
// lib/lgpd/export.ts (Phase 1 — só dados de auth; Phase 4+ adiciona reservas e pontos)
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, telefone: true,
      isAdult: true, termsVersion: true, termsAcceptedAt: true,
      privacyVersion: true, privacyAcceptedAt: true,
      emailVerified: true, createdAt: true, updatedAt: true,
    },
  })
  // Phase 1: só auth. Phase 4: + reservas, + pontos. Phase 5: + sorteios, + resgates.
  return {
    versao_export: '1.0',
    gerado_em: new Date().toISOString(),
    cadastro: user,
    reservas: [],   // populado em Phase 4
    pontos: [],     // populado em Phase 4
  }
}
```

### LGPD-05: anonimização (não DELETE)

```typescript
// lib/lgpd/anonymize.ts
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { logAudit } from '@/lib/audit/log'

export async function anonymizeUser(userId: string, ipHash?: string, uaHash?: string) {
  await prisma.$transaction(async (tx) => {
    const placeholderEmail = `deleted-${crypto.randomUUID()}@anon.invalid`

    await tx.user.update({
      where: { id: userId },
      data: {
        email: placeholderEmail,
        name: '[anonimizado]',
        telefone: null,
        deletedAt: new Date(),
        anonymizedAt: new Date(),
      },
    })

    // Apaga credenciais (não dá pra logar)
    await tx.account.deleteMany({ where: { userId } })

    // Apaga sessões
    await tx.session.deleteMany({ where: { userId } })
  })

  // Audit log FORA da TX (segue Architecture B6)
  await logAudit({
    actorType: 'customer',
    actorId: userId,
    action: 'customer_account_deleted',
    metadata: { reason: 'self-service-lgpd' },
    ipHash,
    uaHash,
  })
}
```

```typescript
// app/api/me/delete/route.ts
import { auth } from '@/lib/auth/server'
import { anonymizeUser } from '@/lib/lgpd/anonymize'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import crypto from 'node:crypto'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  // Typed-email confirmation (UI-SPEC: confirmação é digitação física, não dialog)
  const formData = await request.formData()
  const typedEmail = formData.get('confirmacao') as string
  if (typedEmail !== session.user.email) {
    return new Response('email não confere', { status: 400 })
  }

  const h = await nextHeaders()
  const ipHash = crypto.createHash('sha256').update(h.get('x-forwarded-for') ?? '').digest('hex')
  const uaHash = crypto.createHash('sha256').update(h.get('user-agent') ?? '').digest('hex')

  await anonymizeUser(session.user.id, ipHash, uaHash)
  redirect('/?msg=conta-excluida')
}
```

### LGPD-06: DPO no rodapé

UI-SPEC §Footer já tem: `Doces Valentina · Termos · Privacidade · Dúvidas sobre seus dados? dpo@docesvalentina.com.br`. Email tem que existir como mailbox real (pode redirecionar pro email da mãe/dev — Phase 1 não cobre infra de email recebido, só de envio via Resend).

---

## Audit Log

Schema: ver §Schema Design `AuditLog`.

### Phase 1 actions populadas

| Action | When | Actor | Metadata |
|--------|------|-------|----------|
| `admin_login` | A cada `auth.api.signInEmail` bem-sucedido com user.role='admin' | actorType='admin', actorId=user.id | `{ session_id }` |
| `admin_seed_via_cli` | `pnpm seed:admin` cria admin novo | actorType='cli', actorId=null | `{ email_hash: sha256(email) }` |
| `admin_password_reset_via_cli` | `pnpm seed:admin --reset` | actorType='cli', actorId=null | `{ admin_id: user.id }` |
| `customer_signup` | Cadastro novo cliente | actorType='customer', actorId=newUserId | `{ email_hash }` |
| `customer_email_verified` | Click no link de confirmação válido | actorType='customer', actorId=user.id | `{}` |
| `customer_password_reset` | Reset bem-sucedido cliente (callback `onPasswordReset`) | actorType='customer', actorId=user.id | `{}` |
| `customer_account_deleted` | LGPD-05 anonimização | actorType='customer', actorId=user.id | `{ reason: 'self-service-lgpd' }` |

### Phase 1 NÃO popula (Phase 2+ adiciona)

- `preco_alterado` (Phase 2)
- `lote_criado` (Phase 2)
- `reserva_confirmada` (Phase 4)
- `lgpd_export_requested` (opcional Phase 1.x — pode adicionar se desejado, sem migration)

### UI `/admin/auditoria` (UI-SPEC literal)

```typescript
// app/(admin)/admin/auditoria/page.tsx (RSC)
import { prisma } from '@/lib/db/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ACTION_COPY: Record<string, string> = {
  admin_login:                  'entrou no painel',
  admin_seed_via_cli:           'foi criada via comando do dev',
  admin_password_reset_via_cli: 'teve a senha redefinida pelo dev',
  customer_signup:              'criou conta',
  customer_email_verified:      'confirmou email',
  customer_password_reset:      'redefiniu a senha',
  customer_account_deleted:     'excluiu a conta',
}

export default async function AuditPage() {
  const events = await prisma.auditLog.findMany({
    orderBy: { ts: 'desc' },
    take: 200,
  })
  if (events.length === 0) {
    return (
      <div>
        <h1>Quem fez o quê</h1>
        <p>Nenhum evento ainda</p>
        <p>Quando alguém entrar no painel ou mexer em alguma coisa importante, vai aparecer aqui.</p>
      </div>
    )
  }
  return (
    <div>
      <h1>Quem fez o quê</h1>
      <ul>
        {events.map(e => (
          <li key={String(e.id)}>
            {format(e.ts, "'Hoje, 'HH:mm", { locale: ptBR })} — {actorLabel(e)} — {ACTION_COPY[e.action] ?? e.action}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Email Infra

### Resend client

```typescript
// lib/email/resend.ts
import { Resend } from 'resend'
import { env } from '@/lib/env'
export const resend = new Resend(env.RESEND_API_KEY)
```

### React Email templates (Phase 1: 2 templates)

```typescript
// lib/email/send-verification.tsx
import { resend } from './resend'
import { render } from '@react-email/render'
import { Html, Body, Container, Heading, Text, Button } from '@react-email/components'

function VerifyEmail({ url }: { url: string }) {
  return (
    <Html><Body><Container>
      <Heading>Confirma seu email pra terminar o cadastro</Heading>
      <Text>A gente só quer ter certeza que esse email é seu mesmo.</Text>
      <Button href={url}>Confirmar email</Button>
      <Text>O link vale por 24 horas. Se já passou, é só fazer cadastro de novo.</Text>
    </Container></Body></Html>
  )
}

export async function sendVerificationEmail({ to, url }: { to: string; url: string; token: string }) {
  const html = await render(<VerifyEmail url={url} />)
  return resend.emails.send({
    from: 'Doces Valentina <nao-responda@docesvalentina.com.br>',
    to,
    subject: 'Confirma seu email — Doces Valentina',
    html,
  })
}
```

### Webhook handler (Phase 1: skeleton com svix verify; popula handler em Phase 4)

```typescript
// app/api/webhooks/resend/route.ts
import { Webhook } from 'svix'
import { env } from '@/lib/env'
import { logger } from '@/lib/log'

export async function POST(request: Request) {
  const payload = await request.text() // RAW body — svix exige
  const headers = {
    'svix-id':        request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  }
  try {
    const wh = new Webhook(env.RESEND_WEBHOOK_SECRET)
    const event = wh.verify(payload, headers) as { type: string; data: any }
    // Phase 1: só log. Phase 4 vai persistir em tabela `email_events` e marcar `account.email_invalid` em bounces persistentes.
    logger.info({ event_type: event.type, email_id: event.data.email_id }, 'resend webhook')
    return Response.json({ ok: true })
  } catch (e) {
    return new Response('invalid signature', { status: 400 })
  }
}
```

**Phase 1 NÃO entrega `email_events` table** — defer pra Phase 4 quando bounces precisarem afetar fluxo. Phase 1 só prova que webhook chega e signature verify.

---

## pg-boss Boot Harness (INFRA-11)

```typescript
// lib/queue/boss.ts
import PgBoss from 'pg-boss'
import { env } from '@/lib/env'

const globalForBoss = globalThis as unknown as { boss: PgBoss | undefined }

export const boss = globalForBoss.boss ?? new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: 'pgboss',
})

if (process.env.NODE_ENV !== 'production') globalForBoss.boss = boss
```

```typescript
// instrumentation.ts (raiz)
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { boss } = await import('./lib/queue/boss')
  await boss.start()
  // Phase 1: 0 workers de domínio. Apenas valida que liga.
  // Phase 4 adicionará boss.work('send-email', handler)
}
```

**Tables criadas automaticamente** ao chamar `boss.start()`: `pgboss.job`, `pgboss.archive`, `pgboss.schedule`, `pgboss.subscription` no schema `pgboss`. Sem migration manual; Prisma `migrate dev` ignora schema `pgboss` (não está no `schema.prisma`).

**Important:** Migration order — `prisma migrate deploy` PRIMEIRO (cria public.user etc.), DEPOIS `boss.start()` (cria pgboss.*). `instrumentation.ts` roda após Next.js já estar com Prisma client conectado, então a ordem está correta naturalmente.

---

## Env Validation (`@t3-oss/env-nextjs`)

```typescript
// lib/env.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL:                 z.string().url(),
    NODE_ENV:                     z.enum(['development', 'production', 'test']),
    TZ:                           z.literal('America/Sao_Paulo'),                           // INFRA-10
    BETTER_AUTH_SECRET:           z.string().min(32),                                       // 256-bit
    BETTER_AUTH_URL:              z.string().url(),
    RESEND_API_KEY:               z.string().startsWith('re_'),
    RESEND_WEBHOOK_SECRET:        z.string().min(16),
    ADMIN_EMAIL:                  z.string().email(),                                       // D-05
    ADMIN_INITIAL_PASSWORD:       z.string().min(8).optional(),                             // D-05 — usado só no seed
    ADMIN_RESET_PASSWORD:         z.string().min(8).optional(),                             // D-07 — usado só no --reset
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(32).optional(),                      // só multi-instance; v1 single, optional
  },
  client: {
    NEXT_PUBLIC_URL:              z.string().url(),                                          // pra construir links em emails (server-side)
  },
  runtimeEnv: {
    DATABASE_URL:                 process.env.DATABASE_URL,
    NODE_ENV:                     process.env.NODE_ENV,
    TZ:                           process.env.TZ,
    BETTER_AUTH_SECRET:           process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL:              process.env.BETTER_AUTH_URL,
    RESEND_API_KEY:               process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET:        process.env.RESEND_WEBHOOK_SECRET,
    ADMIN_EMAIL:                  process.env.ADMIN_EMAIL,
    ADMIN_INITIAL_PASSWORD:       process.env.ADMIN_INITIAL_PASSWORD,
    ADMIN_RESET_PASSWORD:         process.env.ADMIN_RESET_PASSWORD,
    NEXT_PUBLIC_URL:              process.env.NEXT_PUBLIC_URL,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
  },
  emptyStringAsUndefined: true,
})
```

**`.env.example`** que vai pro Git:

```bash
DATABASE_URL=postgresql://postgres:LOCAL_DEV_PASSWORD@localhost:5432/doces
NODE_ENV=development
TZ=America/Sao_Paulo

BETTER_AUTH_SECRET=__GENERATE_VIA_OPENSSL_RAND_HEX_32__
BETTER_AUTH_URL=http://localhost:3000

RESEND_API_KEY=re_PLACEHOLDER
RESEND_WEBHOOK_SECRET=PLACEHOLDER
NEXT_PUBLIC_URL=http://localhost:3000

ADMIN_EMAIL=admin@docesvalentina.com.br
ADMIN_INITIAL_PASSWORD=__SET_BEFORE_RUNNING_SEED__
# ADMIN_RESET_PASSWORD only used when running `pnpm seed:admin --reset`
# ADMIN_RESET_PASSWORD=
```

**Build-time fail-fast test (validation acceptance):**

```bash
# Em CI ou pre-PR:
DATABASE_URL= pnpm build
# Esperado: Falha com "DATABASE_URL: Required" antes de qualquer compilação
```

---

## Logging (pino)

```typescript
// lib/log.ts
import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact: {
    // Paths que NUNCA podem aparecer em log (LGPD + segurança)
    paths: [
      // PII direto
      'email', '*.email', 'req.body.email', 'user.email',
      'password', '*.password', 'req.body.password', 'pwd', '*.pwd',
      'telefone', '*.telefone', 'phone', '*.phone',
      'cpf', '*.cpf',
      'name', 'user.name',                       // pode revelar identidade
      // Tokens
      'token', '*.token', 'session.token',
      'authorization', 'cookie', 'set-cookie',
      'svix-signature',
      // IPs/UAs em plaintext (logs aceitam só hash)
      'ip', '*.ip', 'req.ip', 'req.headers.x-forwarded-for', 'req.headers["x-forwarded-for"]',
      'user-agent', '*.user-agent', 'req.headers.user-agent',
    ],
    censor: '[redacted]',
    remove: false, // mantém a key, troca o valor — preserva schema do log
  },
  transport: isDev ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
  } : undefined,
})
```

**Test** (validation):

```typescript
// tests/log.test.ts
import { logger } from '@/lib/log'
import { describe, it, expect, vi } from 'vitest'

it('redacts email', () => {
  const writes: string[] = []
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c) => { writes.push(String(c)); return true })
  logger.info({ email: 'leak@test.com' }, 'login attempt')
  spy.mockRestore()
  expect(writes.join('')).not.toContain('leak@test.com')
  expect(writes.join('')).toContain('[redacted]')
})
```

---

## Cloudflare Proxy + UFW + Caddy

### 1. DNS records (a configurar no painel Cloudflare ANTES de subir VPS)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `docesvalentina.com.br` | `<VPS_IP>` | **Proxied (orange cloud)** ← INFRA-02 |
| A | `www` | `<VPS_IP>` | Proxied |
| CNAME | `_dmarc` (Phase 4 setup) | `_dmarc.docesvalentina.com.br` | DNS only |
| TXT | `@` | SPF/DKIM Resend (Phase 4) | DNS only |

**SSL/TLS mode:** **Full (Strict)** — Cloudflare valida cert do origin (Caddy auto-LE entrega cert válido).

### 2. UFW rules (rodar 1× ao provisionar VPS — INFRA-03)

```bash
#!/bin/bash
# scripts/setup-ufw.sh — roda no host (não Docker)
set -e

# Reset
ufw --force reset

# Default: deny all incoming, allow outgoing
ufw default deny incoming
ufw default allow outgoing

# SSH só do dev IP (set DEV_IP no env do scripts)
ufw allow from "${DEV_IP:?DEV_IP env var required}" to any port 22 proto tcp comment 'SSH dev only'

# 80/443 só de Cloudflare
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
```

### 3. CF IP refresh cron (semanal — Cloudflare atualiza raramente, mas seguro)

```bash
# /etc/cron.weekly/refresh-cf-ips
#!/bin/bash
# Re-run scripts/setup-ufw.sh, prepended por --force reset, com IPs atualizados.
/opt/doces/scripts/setup-ufw.sh
```

### 4. Caddyfile (host, NÃO container)

```caddyfile
# /etc/caddy/Caddyfile
{
    # Modo automático Let's Encrypt
    email dpo@docesvalentina.com.br
}

docesvalentina.com.br, www.docesvalentina.com.br {
    encode gzip zstd

    # Cloudflare é proxy — confiar no X-Forwarded-For dele
    # Requer plugin caddy-trusted-cloudflare; em distros Ubuntu 22.04+ vem por default no apt install caddy
    # Caso contrário, hardcode CIDRs (script gera de https://www.cloudflare.com/ips-v4)
    servers {
        trusted_proxies cloudflare
    }

    # HSTS (Caddy seta automático com auto-LE — preload com cuidado, certificar antes)
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        # CSP, X-Frame-Options, etc. são setados pelo proxy.ts do Next — não duplicar aqui
    }

    reverse_proxy 127.0.0.1:3000
}
```

### 5. Test que origin não vaza

```bash
# Do laptop do dev — ESPERADO falhar ou retornar block:
curl -k https://<VPS_IP_RAW>/ -H 'Host: docesvalentina.com.br'
# Esperado: connection refused (UFW bloqueou) ou cert mismatch
```

### 6. Stack Docker Compose

```yaml
# docker-compose.yml
services:
  app:
    build: .
    restart: unless-stopped
    ports: ["127.0.0.1:3000:3000"]
    env_file: .env.production
    depends_on: [db]
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: doces
      TZ: America/Sao_Paulo
      PGTZ: America/Sao_Paulo
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

`postgres.conf` adicional (montar via volume ou ENV):
```
timezone = 'America/Sao_Paulo'        # INFRA-10
log_timezone = 'America/Sao_Paulo'
```

### 7. next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',                                 // imagem Docker reduzida
  reactCompiler: true,                                  // INFRA-12
  experimental: {
    serverActions: {
      allowedOrigins: [
        'docesvalentina.com.br',
        'www.docesvalentina.com.br',
      ],                                                // INFRA-05
      bodySizeLimit: '1mb',                             // default; explicit pra clareza
    },
  },
}
export default nextConfig
```

---

## Bootstrap CLI Scripts

```typescript
// scripts/seed-admin.ts
import 'dotenv/config'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'
import { logAudit } from '@/lib/audit/log'
import crypto from 'node:crypto'

const isReset = process.argv.includes('--reset')

async function main() {
  if (isReset) {
    if (!env.ADMIN_RESET_PASSWORD) throw new Error('ADMIN_RESET_PASSWORD required for --reset')
    const admins = await prisma.user.findMany({ where: { role: 'admin', deletedAt: null } })
    if (admins.length === 0) throw new Error('No admin found — use seed:admin without --reset')
    if (admins.length > 1)  throw new Error('Multiple admins — manual fix required')
    const [admin] = admins

    await auth.api.setUserPassword({ body: { userId: admin.id, newPassword: env.ADMIN_RESET_PASSWORD } })
    await auth.api.revokeUserSessions({ body: { userId: admin.id } })
    await logAudit({
      actorType: 'cli', actorId: null,
      action: 'admin_password_reset_via_cli',
      metadata: { admin_id: admin.id },
    })
    console.log('Admin password reset; sessions revoked.')
    return
  }

  // Seed (cria se não existir)
  if (!env.ADMIN_INITIAL_PASSWORD) throw new Error('ADMIN_INITIAL_PASSWORD required')
  const existing = await prisma.user.findFirst({ where: { role: 'admin', deletedAt: null } })
  if (existing) {
    console.log(`Admin already exists (${existing.email}). Use --reset to change password.`)
    return
  }

  await auth.api.signUpEmail({
    body: {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_INITIAL_PASSWORD,
      name: 'Administradora',
    },
  })
  // Update role + email_verified + LGPD shells (admin pula fluxo de cadastro normal)
  const user = await prisma.user.update({
    where: { email: env.ADMIN_EMAIL },
    data: {
      role: 'admin',
      emailVerified: true,
      isAdult: true,
      termsVersion: 'v1.0-shell', termsAcceptedAt: new Date(),
      privacyVersion: 'v1.0-shell', privacyAcceptedAt: new Date(),
    },
  })
  await logAudit({
    actorType: 'cli', actorId: null,
    action: 'admin_seed_via_cli',
    metadata: { email_hash: crypto.createHash('sha256').update(env.ADMIN_EMAIL).digest('hex') },
  })
  console.log(`Admin created: ${user.email}. Deliver password in person.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

`package.json` script:
```json
"scripts": {
  "seed:admin": "tsx scripts/seed-admin.ts"
}
```

(adicionar `tsx` em devDeps: `npm install -D tsx`)

---

## Build Order

Fase 1 deve sair em waves dependentes; cada wave conclui um sub-objetivo testável e o próximo herda. Ordem **NÃO inverter**:

### Wave 0 — Pre-flight (sem risk)
| Step | REQ-IDs | Notes |
|------|---------|-------|
| Install deps (Prisma, Better Auth, etc.) | INFRA-08 | `npm install` lista do §Standard Stack |
| `next.config.ts` ajustes (`reactCompiler: true`, `output: 'standalone'`, `experimental.serverActions.allowedOrigins`) | INFRA-05, INFRA-12 | UI ainda renderiza scaffold; só prep |
| `lib/env.ts` schema | INFRA-06 | Sem build até esta passar |
| `lib/log.ts` pino | INFRA-07 | Smoke test redact |
| `npx prisma init` + `prisma/schema.prisma` 5 modelos + 1 enum | INFRA-08, INFRA-09, INFRA-10 | Money convention documentada |
| `pnpm prisma migrate dev --name init` | INFRA-08 | Cria public.user/session/account/verification/audit_log |
| `lib/db/client.ts` PrismaClient singleton | — | Wave 1 prerequisite |

### Wave 1 — Auth core
| Step | REQ-IDs | Notes |
|------|---------|-------|
| `lib/auth/argon2.ts` wrapper @node-rs/argon2 OWASP params | AUTH-06 | Test: hash + verify roundtrip |
| `lib/auth/server.ts` betterAuth() init com prismaAdapter, emailAndPassword, admin plugin, nextCookies | AUTH-04, AUTH-05, AUTH-06, AUTH-08, AUTH-10 | Email callbacks ainda noop (loga só); preencher após Wave 2 |
| `app/api/auth/[...all]/route.ts` handler | AUTH-08, AUTH-10 | Smoke: POST /api/auth/sign-up retorna 200 |
| `proxy.ts` admin guard + role redirect + CSP | AUTH-10, INFRA-05, D-06 | Test: GET /admin sem cookie redireciona /admin/entrar |
| Layouts (`(admin)/admin/layout.tsx`, `(cliente)/minha-conta/layout.tsx`) com `auth.api.getSession` role check | AUTH-09, AUTH-10, D-06 | Test: cliente em /admin retorna 403; admin em /minha-conta redireciona /admin |

### Wave 2 — Email + Resend + svix harness
| Step | REQ-IDs | Notes |
|------|---------|-------|
| `lib/email/resend.ts` Resend client | NOTIF base | — |
| `lib/email/send-verification.tsx` React Email template | AUTH-04 | Smoke test render |
| `lib/email/send-password-reset.tsx` React Email template | AUTH-05 | Smoke test render |
| Wire callbacks em `lib/auth/server.ts` | AUTH-04, AUTH-05 | Trigger via signup → recebe email DEV inbox (Resend test mode) |
| `app/api/webhooks/resend/route.ts` skeleton com svix verify | NOTIF-04 (preparation) | Phase 4 popula handler; Phase 1 só prova svix verify |

### Wave 3 — UI surfaces (UI-SPEC literal)
| Step | REQ-IDs | Notes |
|------|---------|-------|
| `npx shadcn init` + add 11 componentes (button, input, label, form, checkbox, card, alert, sonner, separator, skeleton, table) | UI-SPEC | After init, override CSS vars per UI-SPEC §Color |
| `app/layout.tsx` header global + footer global (D-03) + sonner provider + Fraunces font load (Google Fonts via Next/font) | UI-SPEC | Footer NÃO no /admin/* |
| `app/page.tsx` landing D-01/D-02/D-04 (3 variants por sessão) | D-01, D-02, D-04 | RSC reads session, no flicker |
| `app/(public)/cadastro/page.tsx` step 1 + step 2 (UI-SPEC literal copy) | AUTH-01, AUTH-02, AUTH-03, AUTH-04, LGPD-01, LGPD-02 | Sticky CTA mobile, autocomplete attrs |
| `app/(public)/entrar/page.tsx` | AUTH-08 | "Talvez tenha digitado errado" via AUTH-03 link |
| `app/(public)/esqueci-minha-senha/page.tsx` + `/enviado/page.tsx` (genérica) | AUTH-05, AUTH-07 | Anti-enumeration |
| `app/(public)/redefinir-senha/[token]/page.tsx` | AUTH-05 | Better Auth resetPassword + revoga sessões |
| `app/(public)/auth/confirmar-email/[token]/page.tsx` | AUTH-04 | Better Auth verifyEmail |
| `app/(public)/termos/page.tsx` + `/privacidade/page.tsx` placeholder shells | LGPD-02, LGPD-03, LGPD-06 | Conteúdo literal §LGPD-03 acima |
| `app/(admin)/admin/entrar/page.tsx` | AUTH-10 | Reuse cliente login form mas com copy "Entrar como administradora" |
| `app/(admin)/admin/page.tsx` placeholder | AUTH-10 | Mensagem "Phase 7 traz dashboard" |
| `app/(admin)/admin/auditoria/page.tsx` | AUTH-11 | Lista AuditLog desc; copy literal UI-SPEC |

### Wave 4 — LGPD + audit + rate limit
| Step | REQ-IDs | Notes |
|------|---------|-------|
| `lib/audit/log.ts` service | AUTH-11 | Wave 1 admin_login + Wave 3 customer_signup já podem chamar |
| `lib/lgpd/export.ts` service (Phase 1: só auth data) | LGPD-04 | — |
| `lib/lgpd/anonymize.ts` service (TX UPDATE + revoke + audit) | LGPD-05 | Test: full flow create → anonymize → re-create same email OK |
| `app/api/me/export/route.ts` | LGPD-04 | Content-Disposition attachment |
| `app/api/me/delete/route.ts` (POST com typed-email confirm) | LGPD-05 | UI-SPEC: typed confirmation |
| `app/(cliente)/minha-conta/meus-dados/page.tsx` | LGPD-04, LGPD-06 | Botões export + excluir + DPO mailto |
| `app/(cliente)/minha-conta/excluir/page.tsx` | LGPD-05 | UI-SPEC literal copy |
| `lib/ratelimit/memory.ts` | INFRA-04 | Per-IP + per-email limiters |
| Wire rate limit em Server Actions auth/* | INFRA-04 | UI-SPEC error: "Muitas tentativas seguidas..." |

### Wave 5 — pg-boss harness
| Step | REQ-IDs | Notes |
|------|---------|-------|
| `lib/queue/boss.ts` PgBoss singleton | INFRA-11 | — |
| `instrumentation.ts` register() boots boss | INFRA-11 | Smoke: log "pg-boss up" no boot; pgboss.* tables criadas |

### Wave 6 — Bootstrap admin + ops
| Step | REQ-IDs | Notes |
|------|---------|-------|
| `scripts/seed-admin.ts` (D-05 + D-07) | D-05, D-07 | Test: pnpm seed:admin cria; pnpm seed:admin --reset troca |
| `package.json` scripts: `seed:admin` | — | — |
| `Dockerfile` standalone build | INFRA-01 | Multi-stage: deps → build → runtime |
| `docker-compose.yml` app + db | INFRA-01 | TZ + PGTZ env vars |
| `Caddyfile` no host | INFRA-01 | reverse_proxy + trusted_proxies cloudflare |
| `scripts/setup-ufw.sh` | INFRA-03 | CF IPs + dev SSH |
| `/etc/cron.weekly/refresh-cf-ips` | INFRA-03 | Cron weekly UFW reset |
| Cloudflare DNS records + SSL Full-Strict | INFRA-02 | Manual via painel CF (single-tenant; sem IaC) |

### Wave 7 — Verification (Phase gate)
| Step | REQ-IDs | Notes |
|------|---------|-------|
| Run all integration tests | All | See §Validation Architecture |
| Smoke: cadastro inteiro (signup → verify email → signin → reset → signin de novo) | AUTH-* | E2E manual ou Playwright thin slice |
| Smoke: LGPD (export → anonymize → tentar logar — falha porque account deletada) | LGPD-04, LGPD-05 | — |
| Smoke: admin (CLI seed → admin login em /admin/entrar → /admin/auditoria mostra eventos) | D-05, AUTH-10, AUTH-11 | — |
| Smoke origin hidden: curl direto VPS_IP retorna refused | INFRA-02, INFRA-03 | — |
| Smoke security headers: curl PROD URL inclui CSP, HSTS, X-Frame-Options | INFRA-05 | — |

---

## Common Pitfalls

### Pitfall 1: Better Auth + Prisma 7 esquema "additionalFields" desatualizado
**What goes wrong:** Better Auth 1.6.x lê `user.additionalFields` config para acrescentar campos no schema gerado pelo CLI `npx auth migrate`. Se você definir os fields manualmente no `schema.prisma` (como recomendamos para evitar mais um CLI), Better Auth pode não reconhecer e perder dados em UPDATE.
**Why it happens:** CLI `npx auth migrate` gera schema; manualmente no Prisma cria divergência se nomes diferirem.
**How to avoid:** Single source of truth: declarar `additionalFields` em `betterAuth({ user: { additionalFields: {...} } })` E garantir que `schema.prisma` tem os mesmos nomes/tipos. Após install, rodar `npx auth migrate` 1× pra validar — se ele pedir mudança no schema, ajustar manualmente e committar.
**Warning signs:** Cadastro funciona, mas `User.telefone` aparece null no Postgres mesmo passando `body.telefone`.

### Pitfall 2: `getSessionCookie` não valida sessão (só presença)
**What goes wrong:** Em `proxy.ts`, `getSessionCookie(request)` retorna `string | null` baseado apenas em ter o cookie — não valida session no DB. Sessão expirada/revogada pode passar pelo proxy e o usuário ver tela 500 no layout.
**Why it happens:** Better Auth deliberadamente faz isso por perf — `proxy.ts` deve ser leve.
**How to avoid:** Layout `(admin)/admin/layout.tsx` faz `await auth.api.getSession({ headers })` (DB hit) e renderiza 403/redirect. proxy.ts só presença → layout só validação completa. Documentar esse 2-layer no comentário do proxy.
**Warning signs:** Cookie ainda no browser após delete da session no DB → admin vê tela em branco em vez de redirect.

### Pitfall 3: `cookies()`/`headers()` síncrono em Server Action quebra silently
**What goes wrong:** Código antigo `const c = cookies()` não dá erro de compilação em Next 16 — retorna Promise sem await, type infere `unknown`, app crasha em runtime.
**Why it happens:** Migration manual sem rodar codemod oficial.
**How to avoid:** SEMPRE `const c = await cookies()` / `const h = await nextHeaders()`. Adicionar regra ESLint custom (ou `eslint-plugin-next-async-headers` se existir) — alternativa, code review de cada uso. Better Auth `nextCookies()` plugin lida com isso pra calls internas.
**Warning signs:** TypeError: Cannot read properties of undefined (reading 'get') ao chamar Server Action.

### Pitfall 4: pg-boss `boss.start()` antes de Postgres pronto
**What goes wrong:** `instrumentation.ts` chama `boss.start()`; container Postgres ainda subindo → `ECONNREFUSED`; Next.js falha boot.
**Why it happens:** Docker Compose `depends_on: [db]` espera container UP, não Postgres ready.
**How to avoid:** Healthcheck no Postgres em compose:
```yaml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    retries: 10
app:
  depends_on:
    db: { condition: service_healthy }
```
**Warning signs:** Logs "pg-boss start failed: connect ECONNREFUSED" no primeiro deploy.

### Pitfall 5: CF IPs mudam e UFW não atualiza
**What goes wrong:** Cloudflare adiciona novo CIDR (raro mas acontece); UFW não conhece; tráfego legítimo bloqueia; site fica offline.
**Why it happens:** Sem cron de refresh, ou cron silenciosamente falha.
**How to avoid:** Cron weekly + alerta de exit code != 0; opcional: comparar lista atual com snapshot anterior e logar diff.
**Warning signs:** Better Stack /api/health retorna 503 após dias OK + erro UFW BLOCKED em journalctl.

### Pitfall 6: Anti-enumeration timing leak no /esqueci-senha
**What goes wrong:** Server Action retorna mais rápido se email não existe (skip todo o flow) vs se existe (encolepe gen + DB write + send email). Atacante mede tempo via timing side-channel.
**Why it happens:** Implementação naive `if (user) { send } else { return generic }`.
**How to avoid:** Better Auth `auth.api.forgetPassword` faz isso direito (sleep aleatório se email não existe). Verificar no source ou benchmarkar (10 chamadas com email válido vs 10 com inválido — distribuição deve sobrepor).
**Warning signs:** PR review pede teste timing; auditor externo flagrou.

### Pitfall 7: `experimental.serverActions.allowedOrigins` não é "experimental" no nome mas ainda
**What goes wrong:** Em Next 16, `serverActions` config STILL lives under `experimental` key (despite SA being stable since 14). Dev assume `serverActions` é top-level, escreve `nextConfig.serverActions.allowedOrigins`, build ignora silently.
**Why it happens:** Naming inconsistency — Server Actions são stable mas a config sub-key fica em `experimental`.
**How to avoid:** SEMPRE `experimental.serverActions.allowedOrigins`. [VERIFIED: docs/03-api-reference/05-config/01-next-config-js/serverActions.md]
**Warning signs:** CSRF protection ineffective em PROD — testar via curl com Origin header malicioso.

### Pitfall 8: Anonimização não revoga sessão
**What goes wrong:** User `/minha-conta/excluir`; `User.deletedAt` set; mas cookie ainda válido; user faz F5 → sessão "viva" mas nome "[anonimizado]" aparecendo. Confuso e potencial bypass.
**Why it happens:** Esquecer de chamar `revokeUserSessions` no flow de anonimização.
**How to avoid:** `lib/lgpd/anonymize.ts` chama `tx.session.deleteMany({ where: { userId } })` dentro da TX (ver §LGPD).
**Warning signs:** Test E2E "anonimize → F5 sem fechar browser" não redireciona pra /entrar.

### Pitfall 9: Audit log com IP plaintext em vez de hash
**What goes wrong:** Logar `ip: '203.0.113.5'` em audit_log = PII em DB; leak do DB = LGPD incident.
**Why it happens:** "É só pra debug, depois removo" → fica.
**How to avoid:** Schema já força `ipHash`/`uaHash` String, não `ip`/`ua`. Helper `lib/audit/log.ts` recebe raw e hasheia (`crypto.createHash('sha256').update(ip).digest('hex')`).
**Warning signs:** Migração futura tem `ip text` em audit_log.

### Pitfall 10: Caddy auto-LE falha porque Cloudflare está em "Flexible" (não "Full Strict")
**What goes wrong:** SSL/TLS Encryption mode em "Flexible" = Cloudflare termina TLS e fala HTTP com origin → Caddy nunca recebe HTTPS challenge → cert nunca emite → 502.
**Why it happens:** Default Cloudflare é "Flexible".
**How to avoid:** Setar "Full (Strict)" no painel CF antes de subir Caddy primeira vez. Caddy auto-LE usa HTTP-01 challenge em porta 80 — Cloudflare proxied permite passar quando CF é "Full Strict" + DNS-01 funciona como alternativa.
**Warning signs:** `journalctl -u caddy -f` mostra erro "challenge failed" em loop.

---

## Code Examples (consolidated)

Already provided inline in §Architecture Patterns + §Auth Flows + §LGPD + §Middleware + §Schema. All snippets cite source: Next 16 docs local OR Better Auth official OR Prisma 7 official OR `[ASSUMED]` (none in critical sections).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` Edge runtime | `proxy.ts` Node.js runtime | Next 16 (Q4 2025) | Pode usar APIs Node em proxy (crypto, fs); mas perde Edge perf |
| `cookies()` síncrono | `await cookies()` | Next 16 (Q4 2025) | Toda Server Action precisa async |
| Lucia Auth | Better Auth | Lucia deprecated mar/2025 | Phase 1 não tinha legacy; greenfield = Better Auth |
| Prisma 6 com Rust query engine | Prisma 7 TypeScript puro | Prisma 7 launch (Q1 2026) | Bundle reduzido ~40%; cold start melhor em VPS pequena |
| `next lint` | `eslint .` direto | Next 16 | `package.json` `"lint": "eslint"` (já está assim no scaffold) |
| Coolify | Docker Compose direto | jan/2026 (11 CVEs CVSS 10.0) | Sem orquestrador = menos surface |
| PPR `experimental.ppr` | `cacheComponents: true` | Next 16 | Phase 1 não usa PPR (sem cacheComponents — ativar em Phase 3 quando vitrine surgir) |

**Deprecated/outdated:**
- **Lucia Auth**: substituído por Better Auth oficialmente
- **`unstable_cache`**: removido em Next 16; usar `'use cache'` directive
- **`images.domains`**: deprecated; usar `images.remotePatterns`
- **`@upstash/ratelimit`** (em CONTEXT.md como sugestão): NÃO tem modo memory — substituído por `rate-limiter-flexible`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Better Auth `auth.api.setUserPassword` e `auth.api.revokeUserSessions` existem como APIs públicas via admin plugin | §Auth Flows F7, §Bootstrap CLI | Se nomes diferirem (e.g., `adminSetPassword`), reset CLI quebra. Mitigação: planner re-checar via Context7 / `node_modules/better-auth/dist/...` antes de implementar. |
| A2 | Prisma 7 mantém comportamento idêntico ao 6 para `@db.Decimal(p, s)` e `@db.Timestamptz(n)` | §Schema Design | Phase 1 não tem money columns — qualquer drift descobre em Phase 2. Documentar pra Phase 2 verificar. |
| A3 | `Caddy` instalado via `apt install caddy` em Ubuntu 22.04+ inclui o módulo `caddy-trusted-cloudflare` | §Caddyfile | Se distro não inclui, planner precisa `xcaddy build` ou hardcode CIDRs (script existe pra UFW; reusar). |
| A4 | OWASP Argon2id perfil 2 (m=19456, t=2, p=1) é apropriado pra VPS Hostinger ~R$30 (assumed 2GB RAM) | §Argon2id Setup | Se VPS tiver <1GB livre durante login burst, time per hash sobe → UX degrade. Benchmark em deploy primeira vez (alvo: <500ms por hash em CPU contention). |
| A5 | Resend webhook secret env var name = `RESEND_WEBHOOK_SECRET` | §Email + §Env | Resend dashboard usa "Signing Secret"; planner verifica nome ao criar webhook no painel CF. |
| A6 | `pg-boss` 12.x cria schema `pgboss` automaticamente sem precisar de owner privilegiado adicional ao Postgres user padrão (`postgres`) | §pg-boss | Single-VPS com postgres role superuser → OK. Se trocar pra managed (research/STACK.md PRC-V2), pode falhar — checar permissões. |
| A7 | Footer DPO email `dpo@docesvalentina.com.br` é mailbox real (ou redireciona pra dev) | §LGPD-06 | Se não existir, LGPD-06 não cumprida. Setup MX/forward via Cloudflare Email Routing (free) — fora de Phase 1 mas planner nota. |
| A8 | `@node-rs/argon2` 2.0.2 tem prebuilt binaries pra linux-x64 (Hostinger arch padrão) | §Argon2id | Se Alpine Docker, precisa `linux-musl-x64` variant — `@node-rs/argon2` publica ambos. Verificar `npm install` log primeiro deploy. |

**Confirmation needed before locking these as decisions** — recomendo planner abrir 1 mini-discuss-phase round se A1/A4 forem riscos relevantes. A2-A8 são "verify-as-you-go" sem impacto bloqueante.

---

## Open Questions

1. **Better Auth user `role` field — additionalField vs admin plugin field?**
   - What we know: Admin plugin DOC SAYS adiciona `role` nativo. additionalFields também documentado.
   - What's unclear: Conflito? Se eu setar `role` em `additionalFields` E plugin admin estiver enabled, qual ganha?
   - Recommendation: Planner testa em DEV — provavelmente plugin admin sobrescreve/owna, `additionalFields` complementa. Documentar no PR.

2. **`pnpm` vs `npm` — qual o package manager do projeto?**
   - What we know: `package-lock.json` existe (não `pnpm-lock.yaml`); CLAUDE.md em `.planning/` diz "pnpm seed:admin" no D-05.
   - What's unclear: Migrar pra pnpm ou manter npm?
   - Recommendation: **Manter npm** (lockfile existente). Trocar `pnpm seed:admin` → `npm run seed:admin` em CONTEXT.md/UI-SPEC. Se user quiser pnpm, é decisão D-10 separada — research recomenda npm.

3. **Cloudflare Email Routing pra `dpo@docesvalentina.com.br`** — Phase 1 ou v1.x?
   - What we know: LGPD-06 exige email visível; mailbox precisa receber.
   - What's unclear: Faz parte do scope Phase 1 setup ou é op separada?
   - Recommendation: **Out of scope Phase 1** — é DNS/email infra, não código. Documentar como pre-launch checklist v1.0 release (junto com domain, DNS, etc.). Phase 1 entrega o EMAIL na UI; mailbox real é setup manual.

4. **Cookie `__Secure-better-auth.session_token` em DEV (`http://localhost:3000`)** — vai falhar?
   - What we know: `__Secure-` prefix exige `Secure` flag exige HTTPS. Em DEV HTTP, browser rejeita.
   - What's unclear: Better Auth detecta NODE_ENV e ajusta?
   - Recommendation: Better Auth tem `secure` config based on protocol; planner verifica via DEV smoke test (signup → cookie set?). Se quebrar, set `cookieOptions: { secure: env.NODE_ENV === 'production' }` em betterAuth init.

5. **Postgres `Decimal` retorna `Prisma.Decimal` ou string?** — Phase 1 não toca, mas convenção pra Phase 2.
   - What we know: Prisma docs dizem `Prisma.Decimal` (decimal.js compat).
   - What's unclear: JSON serialize de Decimal na export LGPD vai virar `{ s: 1, e: 4, d: [...] }` ou string? Cliente vai entender?
   - Recommendation: Ao serializar pra JSON em LGPD-04, usar `.toString()` ou `.toFixed(4)` pra evitar `Decimal` object. Documentar pra Phase 2.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next 16 build/runtime | (presumido sim — ambiente dev) | ≥20.9 obrigatório (Next 16) | — |
| npm | Package manager | sim (lockfile existe) | qualquer | — |
| `npx prisma` | Migrations + Studio | depois install (Wave 0) | 7.8.0 | — |
| Postgres 16 | DB | será provisionado via Docker em deploy (Wave 6) | 16-alpine | — |
| Docker + Compose | VPS deploy | será instalado em VPS (Wave 6) | latest | — |
| Caddy | Host reverse proxy | será instalado em VPS (Wave 6) | latest apt | — |
| UFW | Host firewall | builtin Ubuntu/Debian | — | — |
| Cloudflare account | DNS + proxy | dev provisiona (Wave 6) | — | sem fallback (CF é INFRA-02 lock) |
| Resend account | Email | dev provisiona (Wave 2) | — | sem fallback v1 (PROJECT.md travou) |
| Hostinger VPS (ou similar) | Hosting | dev provisiona | ~R$ 30/mês | — |

**Missing dependencies with no fallback:** Cloudflare account + Resend account + VPS — todos provisionamento manual humano. Planner deve incluir checklist humano ANTES de Wave 6.

**Missing dependencies with fallback:** Nenhum — todos os deps de código têm npm install path direto.

---

## Validation Architecture

> nyquist_validation enabled in `.planning/config.json` — required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (Wave 0 install) — unit + integration; Playwright 1.x (deferred — só smoke E2E manual em Wave 7) |
| Config file | `vitest.config.ts` (criar Wave 0) |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | App + DB sobem via docker-compose | smoke (manual em Wave 6) | `docker-compose up && curl localhost:3000` | Wave 0 |
| INFRA-02 | IP origin não responde direto | smoke (manual de fora) | `curl -k https://<VPS_IP>/` retorna refused/blocked | Wave 7 |
| INFRA-03 | UFW rules ativos | smoke (host) | `ufw status numbered` mostra CF v4/v6 + dev SSH | Wave 7 |
| INFRA-04 | Rate limit 11ª req em 60s falha | unit | `pytest tests/ratelimit.test.ts` (descrever 11 chamadas → 11ª retorna null) | Wave 0 |
| INFRA-05 | CSRF Server Action de origem inválida rejeitada | integration | `npx vitest run tests/serveraction-csrf.test.ts` (POST com Origin malicioso → 403) | Wave 0 |
| INFRA-06 | Build falha sem DATABASE_URL | build-test | `DATABASE_URL= npm run build` retorna exit !=0 | Wave 0 (CI script) |
| INFRA-07 | pino redact PII | unit | `npx vitest run tests/log-redact.test.ts` | Wave 0 |
| INFRA-08 | `prisma migrate deploy` aplica migration sem error | smoke | `npx prisma migrate deploy` em CI | Wave 0 |
| INFRA-09 | `Decimal @db.Decimal(19,4)` round-trip preserva precisão | unit | (Phase 2 — Phase 1 sem money columns; documentar test now, implement Phase 2) | Phase 2 |
| INFRA-10 | `DateTime @db.Timestamptz(6)` insert + read mantém timezone | unit | `npx vitest run tests/timezone.test.ts` | Wave 0 |
| INFRA-11 | `instrumentation.ts` chama `boss.start()` exatamente 1× | integration | `npx vitest run tests/instrumentation.test.ts` (mock boss.start, boot Next) | Wave 0 |
| INFRA-12 | `next.config.ts` tem `reactCompiler: true` | snapshot/static | `grep "reactCompiler: true" next.config.ts` em CI | Wave 0 |
| AUTH-01 | Cadastro completo cria User + Account com all required fields | integration | `npx vitest run tests/auth/signup.test.ts` (com test DB) | Wave 0 |
| AUTH-02 | Email-first detecta existência | integration | `tests/auth/email-first.test.ts` | Wave 0 |
| AUTH-03 | UI mostra "talvez tenha digitado errado" para email existente | (UI-level — manual smoke) | n/a | manual |
| AUTH-04 | Verification token criado, email enviado, click confirma | integration | `tests/auth/email-verify.test.ts` (mock Resend, exercise callback) | Wave 0 |
| AUTH-05 | Reset flow OWASP completo | integration | `tests/auth/password-reset.test.ts` (cobrir: token gen, expira em 60min, single-use, revoga sessões) | Wave 0 |
| AUTH-06 | argon2id hash produz output válido | unit | `tests/auth/argon2.test.ts` (hash + verify roundtrip; verifica params OWASP) | Wave 0 |
| AUTH-07 | Mensagens genéricas em /esqueci-senha (existente vs não-existente retornam mesma string) | integration | `tests/auth/anti-enum.test.ts` | Wave 0 |
| AUTH-08 | Login cliente cria sessão DB | integration | `tests/auth/signin.test.ts` | Wave 0 |
| AUTH-09 | Cliente acessa `/minha-conta/meus-dados` | smoke (manual Wave 7) | curl com cookie | manual |
| AUTH-10 | Sem sessão admin, `/admin/*` redireciona | integration | `tests/auth/admin-guard.test.ts` (proxy.ts + layout) | Wave 0 |
| AUTH-11 | Admin login grava AuditLog | integration | `tests/audit/admin-login.test.ts` | Wave 0 |
| LGPD-01 | Cadastro sem isAdult=true rejeita | integration | `tests/lgpd/+18.test.ts` | Wave 0 |
| LGPD-02 | termsAcceptedAt + termsVersion gravados | integration | `tests/lgpd/consent.test.ts` | Wave 0 |
| LGPD-03 | `/privacidade` contém Resend, Cloudflare, Hostinger | snapshot | `tests/lgpd/privacy-content.test.ts` (regex contains) | Wave 0 |
| LGPD-04 | `/api/me/export` retorna JSON com cadastro | integration | `tests/lgpd/export.test.ts` (test cliente recebe JSON com seu user) | Wave 0 |
| LGPD-05 | Anonimização preserva ID, troca email/name/telefone, revoga sessões | integration | `tests/lgpd/anonymize.test.ts` | Wave 0 |
| LGPD-06 | Footer renderiza dpo@docesvalentina.com.br | snapshot | `tests/lgpd/footer-dpo.test.ts` (render layout, query texto) | Wave 0 |

### Sampling Rate (Nyquist)
- **Per task commit:** `npx vitest run tests/<area>/*.test.ts --reporter=dot` — só área relevante (~ < 10s)
- **Per wave merge:** `npx vitest run` — full suite
- **Phase gate (Wave 7):** Full suite green + smoke manual de auth E2E + LGPD E2E + origin hidden + headers presentes

### Wave 0 Gaps
- [ ] `vitest.config.ts` criar — framework install + Postgres test DB connection (use Docker test container)
- [ ] `tests/setup.ts` — Prisma test DB reset entre testes; Better Auth init com test DB
- [ ] `tests/conftest.ts` (helpers compartilhados) — fixtures pra criar user limpo, gerar token, etc.
- [ ] CI script: `DATABASE_URL=... npx vitest run` — em GitHub Actions ou similar (Phase 1 é single-dev então OK rodar manualmente; CI fica v1.x)
- [ ] Test directory structure: `tests/auth/`, `tests/lgpd/`, `tests/audit/`, `tests/log-redact.test.ts`, `tests/timezone.test.ts`, `tests/ratelimit.test.ts`, `tests/instrumentation.test.ts`

**Framework install:**
```bash
npm install -D vitest@latest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx
```

(Playwright fica deferido pra Wave 7 ou v1.x)

---

## Security Domain

> security_enforcement enabled, ASVS Level 1, block_on: high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth + argon2id (OWASP profile 2: m=19456, t=2, p=1); requireEmailVerification; rate limit 10/min IP; minimum password 8 chars |
| V3 Session Management | yes | Better Auth sessions DB; cookie httpOnly + sameSite=lax + secure (PROD); 30d expire + 1d refresh; revokeSessionsOnPasswordReset |
| V4 Access Control | yes | proxy.ts + layout 2-layer; Role-based (admin/customer); ownership checks em LGPD endpoints (`session.user.id === target`) |
| V5 Input Validation | yes | Zod schemas em TODA Server Action; `@t3-oss/env-nextjs` Zod env validation no build |
| V6 Cryptography | yes | argon2id (não scrypt default); CSP nonce via `crypto.randomUUID()` base64; tokens via Better Auth (32-byte random hashed) |
| V7 Error Handling & Logging | yes | pino redact PII; AuditLog explicit calls; mensagens genéricas em fluxos sensíveis (AUTH-07) |
| V8 Data Protection | yes | LGPD: anonimização (não DELETE), export, retention 5 anos documentada; ipHash/uaHash não plaintext |
| V9 Communications | yes | TLS 1.3 (CF), HSTS preload, CSP, Cloudflare Full-Strict |
| V10 Malicious Code | partial | Sem dep externos pesados; npm install lockfile; planner recomenda `npm audit` no CI futuro (v1.x) |
| V11 Business Logic | yes | Rate limit; idempotency (Better Auth signup duplicate handled) |
| V12 Files & Resources | n/a Phase 1 | Sem upload em Phase 1 (Phase 3 sharp pipeline) |
| V13 API & Web Service | yes | Server Actions Origin check; webhook svix sig verify; CORS implícito (sameOrigin) |
| V14 Configuration | yes | Env validation no build; `.env` não em Git; Docker secrets via env_file fora do Git |

### Known Threat Patterns for Phase 1 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via Prisma | Tampering | Prisma sempre parameteriza; `$queryRaw` usa template literal seguro |
| CSRF em Server Actions | Tampering | Next 16 origin check + `experimental.serverActions.allowedOrigins` config + cookie sameSite=lax |
| XSS via user input em /admin/auditoria metadata | Tampering | React auto-escape + CSP nonce; renderizar metadata como `<code>` (text-only) |
| Session fixation | Spoofing | Better Auth gera token novo em signin (não reusa) |
| Email enumeration via /esqueci-senha | Information Disclosure | AUTH-07 mensagens genéricas + timing leveling (Better Auth nativo) |
| Password reset token leak via referrer | Information Disclosure | Token na URL → Referrer-Policy: strict-origin-when-cross-origin (já em proxy.ts headers) |
| Brute force login | DoS | Rate limit 10/min IP em /api/auth/* |
| DDoS na origin | DoS | Cloudflare proxy + UFW IP allowlist |
| MitM entre CF e VPS | Information Disclosure | Cloudflare Full-Strict + Caddy auto-LE |
| Credential stuffing | Spoofing | argon2id slow hash (~100ms); rate limit; HIBP check (deferido v1.x) |
| Privilege escalation cliente → admin | EoP | proxy.ts + layout 2-layer DB session check; role enum NOT NULL no schema |
| LGPD breach via log PII | Information Disclosure | pino redact paths comprehensive; ip/ua sempre hash |
| Dependency CVE (Better Auth, Prisma) | múltiplos | npm package-lock.json + `npm audit` no CI (v1.x) |
| Stolen .env | Compromise | Hostinger VPS access controlled (SSH dev only via UFW); `.env` not in Git; Bitwarden compartilhado (deferido v1.x mas docs mencionam) |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — proxy rename, async APIs, cacheComponents, image config
- `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md` — register() pattern, NEXT_RUNTIME check
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` — proxy.ts + nonce + CSP example
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — Better Auth listed in Auth Libraries; DAL pattern
- `node_modules/next/dist/docs/01-app/02-guides/forms.md` — Server Actions form pattern + auth check
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md` — `experimental.serverActions.allowedOrigins`
- `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` — `output: 'standalone'`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` — exact config shape
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — proxy.ts API reference
- `https://www.better-auth.com/docs/integrations/next` — `[...all]` route, getSessionCookie, nextCookies, signUp/signIn API
- `https://www.better-auth.com/docs/adapters/prisma` — prismaAdapter() init, schema fields
- `https://www.better-auth.com/docs/concepts/database` — User/Session/Account/Verification field list
- `https://www.better-auth.com/docs/authentication/email-password` — emailVerification + sendResetPassword + revokeSessionsOnPasswordReset + custom argon2 hash
- `https://www.better-auth.com/docs/plugins/admin` — admin plugin role field, setUserPassword, revokeUserSessions
- `https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections` — singleton pattern
- `https://www.prisma.io/docs/orm/reference/prisma-schema-reference` — `@db.Decimal(p,s)`, `@db.Timestamptz(n)`, `@db.Uuid` syntax
- `https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html` — Argon2id 5 profiles
- `https://github.com/timgit/pg-boss` — v12 init, work, schedule, send API
- `https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests` — svix.Webhook.verify pattern
- `https://resend.com/docs/dashboard/webhooks/event-types` — email.delivered, email.bounced, email.complained
- `https://env.t3.gg/docs/nextjs` — createEnv schema with runtimeEnv
- `https://www.cloudflare.com/ips/` — canonical IP source
- `https://caddyserver.com/docs/caddyfile/directives/reverse_proxy` — trusted_proxies cloudflare directive
- `npm view <pkg> version` for prisma 7.8.0, @prisma/client 7.8.0, better-auth 1.6.9, @node-rs/argon2 2.0.2, resend 6.12.2, svix 1.92.2, pg-boss 12.18.1, @t3-oss/env-nextjs 0.13.11, pino 10.3.1, decimal.js 10.6.0, sonner 2.0.7, lucide-react 1.14.0, zod 4.4.1, date-fns 4.1.0, rate-limiter-flexible 11.0.1, @upstash/ratelimit 2.0.8 — all verified 2026-04-30

### Secondary (MEDIUM confidence — verified across at least 2 sources)
- Better Auth `requireEmailVerification` flag — confirmado em /authentication/email-password e exemplo /integrations/next
- Caddy `trusted_proxies cloudflare` — caddyserver.com docs + Cloudflare community guidance about `X-Forwarded-For` spoofing
- Resend webhook events list — resend.com docs page (single official source; assumed stable)

### Tertiary (LOW confidence — único source)
- `caddy-trusted-cloudflare` plugin no `apt install caddy` Ubuntu 22.04+: assumed based on community discussions; planner verifica primeira install
- `@upstash/ratelimit` realmente NÃO tem memory mode: verified em upstash.com/docs (single canonical source — confiança HIGH em "absence" mas LOW em "they won't add it later")

### Pre-existing project research (consumed verbatim — HIGH)
- `.planning/phase-1-foundation/01-CONTEXT.md` — D-01..D-09 locked decisions
- `.planning/phase-1-foundation/01-UI-SPEC.md` — copy literais, paleta, surfaces
- `.planning/REQUIREMENTS.md` — 29 REQ-IDs
- `.planning/research/STACK.md` (atualizado 2026-04-30 Prisma 7) — version pins
- `.planning/research/ARCHITECTURE.md` — boundaries, build order intuition
- `.planning/research/PITFALLS.md` — 1.1, 1.2, 1.3, 4.1, 4.2, 4.4, 4.5, 7.1
- `.planning/research/SUMMARY.md` — synthesis
- `.planning/PROJECT.md` Key Decisions row Prisma 7

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas versões verificadas em npm 2026-04-30; Prisma 7 + Better Auth + node-rs/argon2 cross-verified em docs oficiais
- Architecture: HIGH — patterns derivam direto de docs Next 16 locais + Better Auth oficial; CONTEXT.md decisions locked
- Pitfalls: HIGH — 7 pitfalls cruzados com OWASP, Better Auth quirks documentados, Next 16 breaking changes em docs locais
- Validation/Test framework: MEDIUM-HIGH — Vitest é convenção; framework decision sem feedback do user (Wave 0 prerequisite)

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 dias) para stack pinned; 7 dias para Prisma 7 patches (publicado recente, pode ter point releases). Re-checar versões se planning >7 dias após research.

---

*Phase: 01-foundation*
*Researched: 2026-04-30*
*Researcher: gsd-phase-researcher (consumed by gsd-planner next)*
