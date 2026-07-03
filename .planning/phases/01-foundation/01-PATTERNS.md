# Phase 1: Foundation — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 64 (4 modificados + 60 novos)
**Analogs found:** 4 / 64 (codebase analogs); 60 first-instance (greenfield, padrão vem de UI-SPEC + RESEARCH + Next 16 docs locais)

---

## Sumário Executivo

Phase 1 é a **primeira fase do projeto** — codebase só tem o scaffold default `create-next-app` (4 arquivos: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts` + `package.json`/`tsconfig.json`). Os outros 60 arquivos são **first-instance**: cada um vira o **template canônico** para Phases 2-7 herdarem.

**Política de pattern source para arquivos novos (sem analog em codebase):**
1. **UI surfaces** (pages/layouts) → seção literal de `01-UI-SPEC.md` (copy, copy-paste contract)
2. **Backend infra** (Prisma, Better Auth, pg-boss, env, log, audit, lgpd) → blocos de código `01-RESEARCH.md` (verbatim — RESEARCH.md já tem snippets completos com `[VERIFIED:]` ou `[CITED:]`)
3. **Next 16 specifics** (proxy.ts, instrumentation.ts, server actions) → `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` + arquivos relacionados
4. **OWASP/segurança** (argon2, anti-enum, CSP) → `cheatsheetseries.owasp.org` + RESEARCH.md §Common Pitfalls

---

## 1. Existing Assets Reusable (já existem no codebase)

| File | Status em Phase 1 | Reuse Strategy |
|------|-------------------|----------------|
| `app/layout.tsx` | **MODIFY** (não recriar) | Mantém imports `Geist`/`Geist_Mono` + `geistSans.variable`/`geistMono.variable`; adiciona `Fraunces` font, `lang="pt-BR"` (atualmente `"en"`), header global, footer global D-03, sonner provider, `metadata` real (atualmente "Create Next App"). |
| `app/globals.css` | **MODIFY** (não recriar) | Mantém `@import "tailwindcss"` + `@theme inline { --font-sans, --font-mono }` (já wired). Substitui `--background`/`--foreground` defaults pelos 12 tokens UI-SPEC §Color (`--color-accent #9D2D7A`, `--color-background #FFF6FB`, etc.). Remove `@media (prefers-color-scheme: dark)` (Phase 1 não habilita dark mode — UI-SPEC). |
| `next.config.ts` | **MODIFY** | Mantém `reactCompiler: true` (já atende INFRA-12). Adiciona `output: 'standalone'`, `experimental.serverActions.allowedOrigins`, `experimental.serverActions.bodySizeLimit`. |
| `app/page.tsx` | **REPLACE** | Scaffold Vercel "Deploy Now" → landing D-01/D-02/D-04 (3 variants by session via RSC). Apaga imports `next/image` + asset Vercel. |
| `package.json` | **MODIFY** | Adiciona ~25 deps (lista completa em RESEARCH.md §Standard Stack `Installation` block). Adiciona scripts `seed:admin`, `db:migrate`, `db:studio`, `test`. Mantém base Next 16.2.4 + React 19.2.4 + TS 5 + Tailwind 4. |
| `tsconfig.json` | **NO CHANGE** | Já tem `paths: { "@/*": ["./*"] }` (todos os imports de RESEARCH.md usam `@/lib/...`, `@/app/...` — funciona out-of-the-box). |
| `app/favicon.ico` | **NO CHANGE Phase 1** | Pode trocar por favicon Doces Valentina mas não é blocker — defer. |
| `next-env.d.ts` | **NO CHANGE** | Auto-gerenciado pelo Next. |

**Insight crítico:** o scaffold atual tem `lang="en"` em `app/layout.tsx:27` — **Phase 1 OBRIGATORIAMENTE troca pra `lang="pt-BR"`** (PROJECT.md "pt-BR único" + UI-SPEC §Brand & Voice).

---

## 2. New Files — First-Instance Patterns (Backend / Infra)

> Cada arquivo abaixo NÃO tem analog em codebase. Pattern source = `01-RESEARCH.md` (snippets verbatim). Estes arquivos viram **template canônico** para Phases 2+.

### 2.1 `prisma/schema.prisma` (NEW — first-instance)

- **Role:** schema (declarative ORM definition)
- **Data flow:** N/A (definition file)
- **Pattern source:** `01-RESEARCH.md` §Schema Design `prisma/schema.prisma` block (lines ~565-708)
- **Code to copy verbatim:** generator + datasource + enum Role + 5 models (User, Session, Account, Verification, AuditLog)
- **Conventions locked (Phase 2+ herda):**
  - Datetime → `DateTime @db.Timestamptz(6)` (INFRA-10)
  - Money → `Decimal @db.Decimal(19, 4)` (Phase 1 sem money columns; convenção documentada)
  - UUID → `String @id @default(uuid()) @db.Uuid`
  - Snake_case table mapping → `@@map("users")`
  - Audit log genérico desde Phase 1 (`actorType`, `entityType` nullable; CONTEXT.md "Claude's Discretion")
- **No-analog note:** **Sets pattern for Phase 2+** — toda nova model criada em Phases 2-7 segue convenções acima sem revisar (locked).

### 2.2 `prisma/migrations/<timestamp>_init/migration.sql` (NEW — generated)

- **Role:** migration (DDL)
- **Pattern source:** Auto-gerado por `npx prisma migrate dev --name init` a partir do schema
- **Convenções locked:** expand-then-contract (INFRA-08); migrations versionadas no Git
- **No-analog note:** Phase 2+ adiciona migrations incrementais (e.g., `20260601_ingredientes`, `20260615_lotes`). Convenção: 1 migration por feature contida.

### 2.3 `lib/db/client.ts` (NEW — first-instance)

- **Role:** server-utility (PrismaClient singleton)
- **Data flow:** N/A (singleton init)
- **Pattern source:** `01-RESEARCH.md` §Architecture Pattern 2 (lines ~462-482)
- **Code to copy verbatim:** `globalForPrisma` pattern com `globalThis as unknown` + log levels DEV vs PROD
- **Why this pattern:** Hot-reload em DEV cria múltiplos `PrismaClient` se naive `new PrismaClient()` no module-scope. Pattern oficial Prisma docs.
- **No-analog note:** Toda Phase 2+ importa `import { prisma } from '@/lib/db/client'` — nunca instancia novo `PrismaClient`.

### 2.4 `lib/auth/server.ts` (NEW — first-instance)

- **Role:** server-utility (Better Auth init)
- **Data flow:** request-response (auth APIs called from Server Actions + Route Handlers)
- **Pattern source:** `01-RESEARCH.md` §Auth Flows `Better Auth init` block (lines ~929-1019)
- **Code to copy verbatim:** `betterAuth({ database: prismaAdapter, emailAndPassword: { requireEmailVerification, revokeSessionsOnPasswordReset, resetPasswordTokenExpiresIn: 3600, sendResetPassword, onPasswordReset, password: { hash, verify } }, emailVerification: { sendVerificationEmail }, user: { additionalFields }, session: { expiresIn, updateAge }, plugins: [admin, nextCookies] })`
- **Critical gotchas (RESEARCH.md §Pitfalls):**
  - `nextCookies()` plugin SEMPRE último na lista (Pitfall enforcement)
  - `additionalFields` declarados aqui DEVEM bater com `prisma/schema.prisma` (Pitfall #1)
  - `hash`/`verify` callbacks override scrypt default por argon2id OWASP profile 2 (m=19456, t=2, p=1)
- **No-analog note:** Phases 2+ não tocam neste arquivo (auth não muda). Plugin `admin` já configurado pra Phase 7 admin features.

### 2.5 `lib/auth/argon2.ts` (NEW — first-instance)

- **Role:** server-utility (argon2id wrapper)
- **Data flow:** N/A (pure function)
- **Pattern source:** `01-RESEARCH.md` §Auth Flows + §Security Domain (OWASP profile 2 params)
- **Code to copy:**
  ```ts
  import { hash, verify } from '@node-rs/argon2'
  const argon2Opts = {
    memoryCost: 19456, timeCost: 2, parallelism: 1,
    algorithm: 2 as const, // Argon2id
  }
  export const hashPassword = (pwd: string) => hash(pwd, argon2Opts)
  export const verifyPassword = (storedHash: string, pwd: string) => verify(storedHash, pwd, argon2Opts)
  ```
- **No-analog note:** OWASP params locked at this layer; mudança de profile (e.g., perfil 3 quando VPS upgradar) toca SÓ este arquivo.

### 2.6 `lib/auth/client.ts` (NEW — first-instance)

- **Role:** client-utility (Better Auth React client)
- **Data flow:** N/A (init)
- **Pattern source:** `better-auth.com/docs/integrations/next` `createAuthClient`
- **Code to copy:**
  ```ts
  'use client'
  import { createAuthClient } from 'better-auth/react'
  export const authClient = createAuthClient({ baseURL: process.env.NEXT_PUBLIC_URL })
  ```
- **No-analog note:** Phase 1 raramente usa (forms são `<form action={serverAction}>`). Existe pra Phase 2+ caso surja Client Component que precise consumir sessão sem RSC.

### 2.7 `lib/env.ts` (NEW — first-instance)

- **Role:** config (env validation)
- **Data flow:** N/A (build-time validation)
- **Pattern source:** `01-RESEARCH.md` §Env Validation block (lines ~1567-1604)
- **Code to copy verbatim:** `createEnv({ server: { ... }, client: { NEXT_PUBLIC_URL }, runtimeEnv: { ... }, emptyStringAsUndefined: true })`
- **Server vars Phase 1:** `DATABASE_URL`, `NODE_ENV`, `TZ` literal `'America/Sao_Paulo'`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY` (`startsWith('re_')`), `RESEND_WEBHOOK_SECRET`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD?`, `ADMIN_RESET_PASSWORD?`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?`
- **No-analog note:** Phase 2+ adiciona vars (e.g., `STORAGE_*` em Phase 3 quando upload de imagens chegar). Nunca usar `process.env.X` direto fora deste arquivo (anti-pattern enforcement).

### 2.8 `lib/log.ts` (NEW — first-instance)

- **Role:** server-utility (pino logger singleton)
- **Data flow:** event-driven (log emit)
- **Pattern source:** `01-RESEARCH.md` §Logging block (lines ~1639-1671)
- **Code to copy verbatim:** `pino({ level, redact: { paths, censor: '[redacted]', remove: false }, transport: isDev ? pino-pretty : undefined })`
- **Redact paths Phase 1 (locked):** `email`, `*.email`, `password`, `*.password`, `pwd`, `*.pwd`, `telefone`, `*.telefone`, `phone`, `*.phone`, `cpf`, `*.cpf`, `name`, `user.name`, `token`, `*.token`, `session.token`, `authorization`, `cookie`, `set-cookie`, `svix-signature`, `ip`, `*.ip`, `req.ip`, `req.headers.x-forwarded-for`, `user-agent`, `req.headers.user-agent`
- **No-analog note:** Phase 2+ adiciona paths conforme novos PII (e.g., `cpf_cliente` em Phase 4). Nunca remover paths existentes.

### 2.9 `lib/email/resend.ts` (NEW — first-instance)

- **Role:** server-utility (Resend SDK singleton)
- **Pattern source:** `01-RESEARCH.md` §Email Infra `Resend client` block (lines ~1462-1467)
- **Code to copy:**
  ```ts
  import { Resend } from 'resend'
  import { env } from '@/lib/env'
  export const resend = new Resend(env.RESEND_API_KEY)
  ```

### 2.10 `lib/email/send-verification.tsx` (NEW — first-instance React Email template)

- **Role:** server-utility (email template + send function)
- **Data flow:** request-response (callback from Better Auth `emailVerification.sendVerificationEmail`)
- **Pattern source:** `01-RESEARCH.md` §Email Infra `React Email templates` block (lines ~1471-1497)
- **Copy literal Phase 1 (UI-SPEC voice):**
  - Subject: `'Confirma seu email — Doces Valentina'`
  - Heading: `"Confirma seu email pra terminar o cadastro"`
  - Body: `"A gente só quer ter certeza que esse email é seu mesmo."`
  - Button: `"Confirmar email"`
  - Footer: `"O link vale por 24 horas. Se já passou, é só fazer cadastro de novo."`
- **From address:** `'Doces Valentina <nao-responda@docesvalentina.com.br>'`
- **No-analog note:** First React Email template do projeto. Phase 4 adiciona `send-reservation-confirmed.tsx`, `send-points-earned.tsx` seguindo MESMO esqueleto (`<Html><Body><Container>` + render + resend.emails.send).

### 2.11 `lib/email/send-password-reset.tsx` (NEW — first-instance)

- **Role:** server-utility (email template)
- **Data flow:** request-response (callback from Better Auth `emailAndPassword.sendResetPassword`)
- **Pattern source:** Mesmo esqueleto de `send-verification.tsx` (RESEARCH.md §Email Infra)
- **Copy Phase 1 (UI-SPEC voice — adapt do `send-verification`):**
  - Subject: `"Recuperar sua senha — Doces Valentina"`
  - Heading: `"Pediu pra trocar a senha?"`
  - Body: `"Clica no botão abaixo pra escolher uma nova. Se não foi você, pode ignorar — sua senha continua a mesma."`
  - Button: `"Criar senha nova"`
  - Footer: `"O link vale por 1 hora."`

### 2.12 `lib/audit/log.ts` (NEW — first-instance audit helper)

- **Role:** server-utility (AuditLog write wrapper)
- **Data flow:** event-driven (called from Server Actions, scripts, callbacks)
- **Pattern source:** `01-RESEARCH.md` §Audit Log + §LGPD `anonymizeUser` example
- **Pattern (extract from RESEARCH.md examples):**
  ```ts
  import crypto from 'node:crypto'
  import { prisma } from '@/lib/db/client'
  export async function logAudit(input: {
    actorType: 'admin' | 'customer' | 'system' | 'cli'
    actorId: string | null
    action: string
    entityType?: string | null
    entityId?: string | null
    metadata?: Record<string, unknown>
    ipHash?: string
    uaHash?: string
    rawIp?: string  // helper hashes raw IP — NEVER plaintext (Pitfall #9)
    rawUa?: string
  }) {
    const ipHash = input.ipHash ?? (input.rawIp ? sha256(input.rawIp) : undefined)
    const uaHash = input.uaHash ?? (input.rawUa ? sha256(input.rawUa) : undefined)
    return prisma.auditLog.create({ data: { ...input, ipHash, uaHash, metadata: input.metadata as any } })
  }
  function sha256(s: string) { return crypto.createHash('sha256').update(s).digest('hex') }
  ```
- **Phase 1 actions populadas (RESEARCH.md §Audit Log table):** `admin_login`, `admin_seed_via_cli`, `admin_password_reset_via_cli`, `customer_signup`, `customer_email_verified`, `customer_password_reset`, `customer_account_deleted`
- **No-analog note:** Helper "absorve" hashing de IP/UA — call sites passam raw, helper hasheia (Pitfall #9 mitigation). Phase 2+ adiciona actions sem schema migration (CONTEXT.md "Claude's Discretion").

### 2.13 `lib/lgpd/export.ts` (NEW — first-instance)

- **Role:** service (LGPD-04 export builder)
- **Data flow:** transform (User + relations → JSON)
- **Pattern source:** `01-RESEARCH.md` §LGPD-04 `exportUserData` block (lines ~1289-1308)
- **Code to copy verbatim:** `prisma.user.findUnique` com `select` whitelist + return shape `{ versao_export, gerado_em, cadastro, reservas: [], pontos: [] }`
- **No-analog note:** Phase 4 popula `reservas` array; Phase 5 adiciona `sorteios`, `resgates`. NUNCA usar `select: undefined` (vaza fields internos como `password`).

### 2.14 `lib/lgpd/anonymize.ts` (NEW — first-instance)

- **Role:** service (LGPD-05 anonymization)
- **Data flow:** CRUD (UPDATE within `prisma.$transaction`)
- **Pattern source:** `01-RESEARCH.md` §LGPD-05 `anonymizeUser` block (lines ~1313-1349)
- **Code to copy verbatim:** `$transaction(async tx => { update user (placeholder email, name '[anonimizado]', telefone null, deletedAt, anonymizedAt); deleteMany account; deleteMany sessions })` + `logAudit` FORA da TX
- **Critical (Pitfall #8):** SEMPRE inclui `tx.session.deleteMany({ where: { userId } })` na TX
- **No-analog note:** Phase 4+ pode adicionar sanitização de `Reserva.observacao` se virar PII (preserva FK pra histórico fiscal).

### 2.15 `lib/ratelimit/memory.ts` (NEW — first-instance)

- **Role:** server-utility (rate limit instances)
- **Pattern source:** `01-RESEARCH.md` §Rate Limit block (lines ~1184-1209)
- **Code to copy verbatim:** Two `RateLimiterMemory` exports: `rateLimitAuth` (10 req/60s, blockDuration 60s) e `rateLimitForgotEmail` (3 req/15min, blockDuration 15min)
- **CRITICAL OVERRIDE:** RESEARCH.md confirma `@upstash/ratelimit` NÃO tem modo memory. **Use `rate-limiter-flexible@11.0.1` `RateLimiterMemory`** (CONTEXT.md "Claude's Discretion" original sugeriu Upstash; pesquisa contradiz).
- **No-analog note:** Phase 4+ pode adicionar `rateLimitWebhook` (Resend → svix); migrar pra `RateLimiterPostgres` quando volume justificar (sem Redis — PROJECT.md lock).

### 2.16 `lib/queue/boss.ts` (NEW — first-instance)

- **Role:** server-utility (pg-boss singleton)
- **Pattern source:** `01-RESEARCH.md` §pg-boss Boot Harness block (lines ~1533-1545)
- **Code to copy verbatim:** `globalForBoss` pattern + `new PgBoss({ connectionString, schema: 'pgboss' })`
- **No-analog note:** Phase 4 adiciona `boss.work('send-email', handler)` em arquivos separados (e.g., `lib/queue/workers/send-email.ts`); registration acontece em `instrumentation.ts`.

### 2.17 `lib/validation/auth.ts` + `lib/validation/lgpd.ts` (NEW — first-instance Zod schemas)

- **Role:** validation (Zod schemas)
- **Pattern source:** `01-RESEARCH.md` §Architecture Pattern 1 (signup form parse) + UI-SPEC literal copy errors
- **Schemas Phase 1:**
  - `SignupSchema` → email, senha (min 8, copy "A senha precisa ter pelo menos 8 caracteres."), nome, telefone, isAdult (literal `true`), termsAccepted (literal `true`)
  - `SigninSchema` → email, senha
  - `ForgotSchema` → email
  - `ResetSchema` → newPassword (min 8)
  - `DeleteAccountSchema` → confirmacao (string === session.user.email — validation feita no route handler, schema só shape)
- **Error messages:** literal UI-SPEC §Error/fallback copy ("Esse email não parece certo. Confere o `@` e o `.com`.", "A senha precisa ter pelo menos 8 caracteres.", "Esse campo é obrigatório.")
- **No-analog note:** Phase 2+ adiciona `lib/validation/ingrediente.ts`, `receita.ts`, etc. Convenção: 1 file por domain area; `*Schema` named exports.

### 2.18 `lib/actions/auth.ts` (NEW — first-instance Server Action template)

- **Role:** server-action (Server Actions for auth forms)
- **Data flow:** request-response (form submit → mutation)
- **Pattern source:** `01-RESEARCH.md` §Architecture Pattern 1 `signupCustomer` block (lines ~415-459)
- **Pattern shape (every action follows):**
  1. `'use server'` directive
  2. `const h = await nextHeaders()` (NEXT 16 — async — Pitfall #3)
  3. Rate limit consume (`rateLimitAuth.consume(ip).catch(() => null)` — return null check)
  4. Zod parse (return early on `!parsed.success`)
  5. Better Auth API call inside try/catch
  6. Generic error message (anti-enumeration AUTH-07 + UI-SPEC literal)
  7. `redirect()` on success
- **Actions in this file Phase 1:** `signupCustomer`, `signinUser`, `requestPasswordReset`, `resetPassword`, `deleteMyAccount` (LGPD-05 confirm)
- **No-analog note:** Phase 4+ adiciona `lib/actions/reservas.ts`, `pontos.ts`, etc. seguindo MESMO 7-step skeleton.

### 2.19 `instrumentation.ts` (NEW — first-instance, raiz do projeto)

- **Role:** instrumentation (Next 16 boot hook)
- **Data flow:** N/A (one-time boot)
- **Pattern source:** `01-RESEARCH.md` §pg-boss Boot Harness `instrumentation.ts` block + `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md`
- **Code to copy verbatim:**
  ```ts
  export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    const { boss } = await import('./lib/queue/boss')
    await boss.start()
    // Phase 1: ZERO workers de domínio. Phase 4 adiciona boss.work('send-email', ...)
  }
  ```
- **Critical:** `if (process.env.NEXT_RUNTIME !== 'nodejs') return` — instrumentation roda em Edge runtime também; pg-boss exige Node.
- **No-analog note:** Phase 4 popula com `boss.work(...)` registrations DEPOIS de `boss.start()`.

### 2.20 `proxy.ts` (NEW — first-instance, raiz; substitui `middleware.ts` convention)

- **Role:** middleware/proxy (Next 16 — `proxy.ts` substitui `middleware.ts`)
- **Data flow:** request-response (every HTTP request, gated by matcher)
- **Pattern source:** `01-RESEARCH.md` §Middleware/proxy.ts block (lines ~1041-1129) + `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- **Code to copy verbatim:** `proxy()` function + `config.matcher`
- **Concerns layered:**
  1. CSP nonce gen per-request (`Buffer.from(crypto.randomUUID()).toString('base64')`)
  2. CSP header build (`default-src 'self'; script-src 'self' 'nonce-...' 'strict-dynamic'; ...; font-src https://fonts.gstatic.com; ...`)
  3. `getSessionCookie(request)` from `better-auth/cookies` (presence-only, no DB hit — Pitfall #2)
  4. `/admin/*` guard (redirect to `/admin/entrar` if !sessionCookie)
  5. `/minha-conta/*` guard (redirect to `/entrar` if !sessionCookie)
  6. Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`)
- **2-layer pattern (RESEARCH.md note):** proxy.ts faz cookie-presence check (leve); layouts (`app/(admin)/admin/layout.tsx`) fazem DB-session role check com `auth.api.getSession`.
- **No-analog note:** **Sets pattern for Phase 2+ route guards.** Phase 4 adiciona route guards de `/api/reservas/*` aqui.

### 2.21 `app/api/auth/[...all]/route.ts` (NEW — first-instance Better Auth handler)

- **Role:** route-handler (catch-all auth endpoints)
- **Data flow:** request-response (Better Auth handles all sub-paths)
- **Pattern source:** `01-RESEARCH.md` §Auth Flows `Better Auth route handler` block (lines ~1023-1033) + `better-auth.com/docs/integrations/next`
- **Code to copy verbatim:**
  ```ts
  import { auth } from '@/lib/auth/server'
  import { toNextJsHandler } from 'better-auth/next-js'
  export const { GET, POST } = toNextJsHandler(auth)
  ```
- **CONTEXT.md correction (RESEARCH.md §Pitfall):** CONTEXT.md "Integration Points" mencionou `[...path]` — RESEARCH.md corrige para `[...all]` (convenção doc oficial Better Auth, exemplos copiáveis batem).
- **No-analog note:** First catch-all route do projeto. Phase 4 adiciona `app/api/reservas/[...]/route.ts` seguindo Convention de catch-all com slug literal docs.

### 2.22 `app/api/me/export/route.ts` (NEW — first-instance LGPD route)

- **Role:** route-handler (LGPD-04 JSON download)
- **Data flow:** request-response (GET → JSON file download)
- **Pattern source:** `01-RESEARCH.md` §LGPD-04 block (lines ~1265-1284)
- **Code to copy verbatim:** `GET()` async function + `auth.api.getSession({ headers: await nextHeaders() })` auth check + `exportUserData(session.user.id)` + `Response` com `Content-Disposition: attachment; filename="..."` + `Cache-Control: no-store`
- **No-analog note:** Phase 4+ adiciona `app/api/me/reservas/export/route.ts` (export individual de reservas) seguindo MESMO padrão.

### 2.23 `app/api/me/delete/route.ts` (NEW — first-instance LGPD)

- **Role:** route-handler (LGPD-05 anonymization endpoint)
- **Data flow:** request-response (POST com typed-email confirm → anonymize + redirect)
- **Pattern source:** `01-RESEARCH.md` §LGPD-05 `app/api/me/delete/route.ts` block (lines ~1352-1378)
- **Code to copy verbatim:** auth check + formData parse + `typedEmail !== session.user.email` 400-check + ipHash/uaHash compute + `anonymizeUser(...)` + `redirect('/?msg=conta-excluida')`
- **No-analog note:** Único endpoint destrutivo (LGPD-05); typed-email gate é UI-SPEC contract (não usar dialog).

### 2.24 `app/api/webhooks/resend/route.ts` (NEW — first-instance webhook + svix verify)

- **Role:** route-handler (Resend webhook receiver — skeleton em Phase 1)
- **Data flow:** event-driven (Resend POST → svix verify → log only Phase 1)
- **Pattern source:** `01-RESEARCH.md` §Email Infra `Webhook handler` block (lines ~1502-1523)
- **Code to copy verbatim:** `request.text()` (RAW body — svix exige) + `Webhook(secret).verify(payload, headers)` + log only (Phase 1)
- **Phase 1 scope:** SÓ valida signature. **Phase 4 popula handler** (persistir em `email_events` table, marcar `account.email_invalid` em bounces).
- **No-analog note:** First svix-verified webhook. Phase 4+ pode adicionar webhooks adicionais (e.g., notificação WhatsApp se virar Twilio); padrão: sempre `request.text()` + lib-specific verify.

### 2.25 `scripts/seed-admin.ts` (NEW — first-instance CLI script, D-05/D-07)

- **Role:** CLI script (admin bootstrap + reset)
- **Data flow:** batch (one-shot CLI invocation)
- **Pattern source:** `01-RESEARCH.md` §Bootstrap CLI Scripts block (lines ~1839-1903)
- **Code to copy verbatim:** flag `--reset` parsing + 2 paths (seed vs reset) + Better Auth API calls (`signUpEmail`, `setUserPassword`, `revokeUserSessions`) + AuditLog writes
- **CRITICAL invariants:**
  - Reset: exatamente 1 admin existe — falha se 0 ou >1
  - Seed: idempotente (se admin existe, log + exit; não recria)
  - Audit log SEMPRE escrito (`actorType: 'cli'`, `actorId: null`)
  - `tsx scripts/seed-admin.ts` (devDep `tsx` instalado em Wave 0)
- **No-analog note:** First CLI script. Convenção: `scripts/<verb>-<noun>.ts` + `package.json` script `"<verb>:<noun>": "tsx scripts/..."`. Phase 4+ adiciona `scripts/sync-resend-domain.ts` etc.

### 2.26 `Dockerfile` (NEW — first-instance, INFRA-01)

- **Role:** infra (multi-stage Docker build)
- **Pattern source:** Convention from `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` (`output: 'standalone'`) + RESEARCH.md §Cloudflare Proxy + UFW + Caddy
- **Pattern (3-stage):**
  1. `deps`: `node:20-alpine` + `npm ci`
  2. `builder`: copy from deps + `npm run build` + leverage `output: 'standalone'`
  3. `runner`: `node:20-alpine` + copy `.next/standalone` + `.next/static` + `public` + `prisma` + `node_modules/.prisma`; `USER node`; `EXPOSE 3000`; `CMD ["node", "server.js"]`
- **Critical:** `@node-rs/argon2` Linux musl build (Alpine → musl variant — RESEARCH.md Assumption A8); install path: prebuilt binaries publicados.

### 2.27 `docker-compose.yml` (NEW — first-instance, INFRA-01)

- **Role:** infra (compose stack)
- **Pattern source:** `01-RESEARCH.md` §Cloudflare Proxy + UFW + Caddy `Stack Docker Compose` (lines ~1786-1805) + Pitfall #4 healthcheck
- **Code to copy verbatim:** `services: { app, db }` + `volumes: { pgdata }` + `db.healthcheck` (`pg_isready`) + `app.depends_on: { db: { condition: service_healthy } }` (Pitfall #4 mitigation) + `TZ`/`PGTZ` env vars
- **Ports:** app expõe `127.0.0.1:3000:3000` (loopback only — Caddy faz proxy do host)

### 2.28 `Caddyfile` (NEW — first-instance, INFRA-01)

- **Role:** infra (host-level reverse proxy config)
- **Pattern source:** `01-RESEARCH.md` §Cloudflare/Caddy `Caddyfile` block (lines ~1747-1772)
- **Critical:**
  - `trusted_proxies cloudflare` (requer plugin `caddy-trusted-cloudflare` — verificar `apt install caddy` Ubuntu 22.04+ — RESEARCH.md Assumption A3)
  - HSTS `max-age=31536000; includeSubDomains`
  - `reverse_proxy 127.0.0.1:3000`
  - **NÃO duplicar CSP/X-Frame-Options** aqui — proxy.ts faz isso (Pitfall #10 esclarecido)

### 2.29 `scripts/setup-ufw.sh` (NEW — first-instance, INFRA-03)

- **Role:** infra script (host firewall setup)
- **Pattern source:** `01-RESEARCH.md` §Cloudflare/Caddy `UFW rules` block (lines ~1707-1734)
- **Code to copy verbatim:** `ufw --force reset` + `default deny incoming` + `allow from $DEV_IP port 22` + loop CF v4 + loop CF v6 + `ufw --force enable`
- **Test:** `scripts/test-origin-hidden.sh` (RESEARCH.md §Build Order Wave 7 — `curl -k https://<VPS_IP_RAW>/` esperado refused)

### 2.30 `.env.example` (NEW — first-instance template)

- **Role:** config template
- **Pattern source:** `01-RESEARCH.md` §Env Validation `.env.example` block (lines ~1606-1624)
- **Code to copy verbatim:** todas as 13 vars com placeholders + comments destacando `__SET_BEFORE_RUNNING_SEED__`

### 2.31 `vitest.config.ts` + `tests/setup.ts` + `tests/conftest.ts` (NEW — first-instance test framework)

- **Role:** test config + fixtures
- **Pattern source:** `01-RESEARCH.md` §Validation Architecture (Wave 0 Gaps section)
- **Notes Phase 1:**
  - Vitest 1.x; Postgres test DB via Docker test container
  - `tests/setup.ts` reset Prisma test DB entre testes; init Better Auth com test DB
  - `tests/conftest.ts` fixtures (createCleanUser, generateToken, etc.)
- **Test files Phase 1 (RESEARCH.md §Phase Requirements → Test Map):**
  - `tests/log-redact.test.ts`, `tests/timezone.test.ts`, `tests/ratelimit.test.ts`, `tests/instrumentation.test.ts`
  - `tests/auth/argon2.test.ts`, `signup.test.ts`, `email-first.test.ts`, `email-verify.test.ts`, `password-reset.test.ts`, `signin.test.ts`, `admin-guard.test.ts`, `anti-enum.test.ts`, `serveraction-csrf.test.ts`
  - `tests/audit/admin-login.test.ts`
  - `tests/lgpd/+18.test.ts`, `consent.test.ts`, `privacy-content.test.ts`, `export.test.ts`, `anonymize.test.ts`, `footer-dpo.test.ts`
- **No-analog note:** First test framework setup. Convenção: 1 directory por domain area (`tests/auth/`, `tests/lgpd/`, `tests/audit/`). Phase 2+ adiciona `tests/ingredientes/`, etc.

---

## 3. New Files — UI Surfaces (Pages, Layouts, Components)

> Pattern source primário: `01-UI-SPEC.md` §Surface Inventory + literal copy. Cada surface mapeia a 1+ seção da UI-SPEC.

### 3.1 `app/page.tsx` (REPLACE scaffold)

- **Role:** page (RSC landing — 3 variants by session)
- **Data flow:** server-render (lê sessão, troca CTAs)
- **UI-SPEC reference:** §Surface Inventory (público) + CONTEXT.md D-01/D-02/D-04 + UI-SPEC §Brand & Voice + §Color
- **3 variants:**
  - Visitor (no session) → CTAs "Criar minha conta" (primary `#9D2D7A`) + "Entrar" (secondary)
  - Customer logged → CTAs "Minha conta" (primary, → `/minha-conta/meus-dados`) + "Sair" (secondary)
  - Admin logged → CTAs "Painel admin" (primary, → `/admin`) + "Sair" (secondary)
- **Hero copy (UI-SPEC §Brand & Voice):** "Em breve: reserva os doces caseiros da Valentina" + Fraunces wordmark + 2 paragraphs institutional voice
- **Pattern source for session read:** `await auth.api.getSession({ headers: await nextHeaders() })` (RESEARCH.md §Layout-level role gate)

### 3.2 `app/cadastro/page.tsx` (NEW — public)

- **Role:** page (cadastro inteligente — 2 steps in 1 route)
- **UI-SPEC reference:** §Surface Inventory rows 1-2 + §Auth flow copy (locked literals) + §Mobile-First Layout (sticky CTA on long forms)
- **Step 1 copy (literal):** Heading "Vamos começar com seu email"; field "Seu email" + help "A gente vai mandar um link de confirmação pra esse endereço."; CTA "Continuar"
- **Step 2 copy (literal):** Heading "Faltam só alguns dados"; fields "Senha" (autocomplete `new-password`, help "Mínimo 8 caracteres. Use o que você lembra — não precisa ser difícil."), "Como a gente te chama" (autocomplete `name`), "Telefone com DDD" (autocomplete `tel`, inputmode `tel`, help "Pra mãe poder te avisar pelo WhatsApp."), checkbox +18 LGPD-01 (literal copy), checkbox termos LGPD-02 (literal copy com inline links `/termos` `/privacidade`); CTA "Criar minha conta" (sticky bottom mobile)
- **AUTH-03 branch (UI-SPEC literal):** if email exists → "Esse email já tem conta. Talvez você tenha digitado errado — quer tentar fazer login?" + buttons "Tentar fazer login" (primary, → `/entrar`) + "Não, é outro email" (back to step 1)
- **Server Action:** `signupCustomer` from `lib/actions/auth.ts` (Pattern 2.18)

### 3.3 `app/entrar/page.tsx` (NEW — public, cliente login)

- **UI-SPEC reference:** §Surface Inventory row 4 + §Auth copy
- **Copy (literal):** Heading "Entrar"; CTA "Entrar"; secondary link "Esqueci minha senha"; bottom link "Ainda não tem conta? Criar agora"
- **autocomplete:** email `email`, senha `current-password`
- **Anti-enum (AUTH-07):** error genérico "Email ou senha não conferem"

### 3.4 `app/esqueci-minha-senha/page.tsx` + `app/esqueci-minha-senha/enviado/page.tsx` (NEW)

- **UI-SPEC reference:** §Surface Inventory rows 5-6 + §Auth copy "Generic anti-enumeration confirmation"
- **`/esqueci-minha-senha` copy (literal):** Heading "Recuperar minha senha"; CTA "Enviar link de recuperação"; rate limit per-email 3/15min
- **`/esqueci-minha-senha/enviado` copy (literal):** "Se esse email estiver cadastrado, você vai receber um link em alguns minutos. Verifique também o spam."

### 3.5 `app/redefinir-senha/[token]/page.tsx` (NEW)

- **UI-SPEC reference:** §Surface Inventory row 7
- **Copy (literal):** Heading "Criar uma senha nova"; CTA "Salvar nova senha"; success "Pronto! Sua senha foi atualizada. Pode entrar com a nova."; expired "Esse link expirou. Pede um novo abaixo."
- **Server Action calls Better Auth `auth.api.resetPassword({ token, newPassword })` (revoga sessões via `revokeSessionsOnPasswordReset: true`)**

### 3.6 `app/auth/confirmar-email/[token]/page.tsx` (NEW)

- **UI-SPEC reference:** §Surface Inventory row 3 + §Auth copy "Email confirmation landing"
- **Copy (literal — sucesso):** "Email confirmado. Bem-vinda(o)!" + CTA "Entrar agora"
- **Copy (literal — expirado):** "Esse link expirou. Sem problema — pede um novo." + CTA "Reenviar email de confirmação"

### 3.7 `app/(public)/termos/page.tsx` + `app/(public)/privacidade/page.tsx` (NEW — placeholder shells)

- **UI-SPEC reference:** §Surface Inventory rows 11-12 + §Auth copy "Termos page intro" / "Privacidade page intro"
- **`/termos` intro (literal):** "Estes são os termos que valem desde [data]. Se mudar, a gente avisa por email."
- **`/privacidade` content:** RESEARCH.md §LGPD-03 block (lines ~1231-1261) — placeholder pt-BR cobrindo coleta, base legal, operadores reais (Resend EUA, Cloudflare EUA, Hostinger Lituânia), retenção 5 anos, direitos LGPD art. 18, DPO email
- **Version locked:** `'v1.0-shell'` em `User.termsVersion` / `User.privacyVersion`

### 3.8 `app/minha-conta/layout.tsx` (NEW — cliente shell)

- **Role:** layout (RSC role gate)
- **Pattern source:** `01-RESEARCH.md` §Middleware/proxy.ts `Layout-level role gate` block (lines ~1149-1158)
- **Code to copy verbatim:** `await auth.api.getSession({ headers: await nextHeaders() })` + `if (!session) redirect('/entrar')` + `if (session.user.role === 'admin') redirect('/admin')` (D-06)

### 3.9 `app/minha-conta/meus-dados/page.tsx` (NEW)

- **UI-SPEC reference:** §Surface Inventory row 8 + §LGPD copy
- **Copy (literal):** Heading "Seus dados, do seu jeito"; body intro "Você pode baixar tudo o que a gente tem sobre você, ou apagar sua conta. O histórico de reservas é mantido por 5 anos por exigência fiscal — depois disso, a gente anonimiza tudo."; CTA "Baixar meus dados em JSON" (primary); link "Excluir minha conta" (foreground+underline, NOT destructive)
- **Export:** `<a href="/api/me/export">` ou Server Action que retorna Response com Content-Disposition (RESEARCH.md §LGPD-04)

### 3.10 `app/minha-conta/excluir/page.tsx` (NEW — typed-email confirmation gate)

- **UI-SPEC reference:** §Surface Inventory row 9 + §Destructive actions inventory
- **Copy (literal):** Heading "Excluir minha conta"; body "Seu nome, email e telefone vão sair do sistema. O histórico de reservas continua salvo (anônimo) por 5 anos por exigência fiscal. Você pode criar uma conta nova depois com o mesmo email, se quiser voltar."; gate label "Para confirmar, digite seu email completo abaixo."; destructive CTA "Excluir minha conta" (`--color-destructive`)
- **NÃO usa dialog "tem certeza?"** — confirmação física via digitação (UI-SPEC §Brand & Voice + §Destructive actions)

### 3.11 `app/(admin)/admin/layout.tsx` (NEW — admin shell)

- **Role:** layout (RSC role gate + admin-specific shell)
- **Pattern source:** RESEARCH.md §Middleware/proxy.ts `Layout-level role gate` block + UI-SPEC §Mobile-First Layout (admin shell sem footer global D-03)
- **Code (RESEARCH.md):** `await auth.api.getSession` + `if (!session) redirect('/admin/entrar')` + `if (session.user.role !== 'admin') return <403 com UI-SPEC error copy>`
- **403 copy (UI-SPEC literal):** "Essa parte é só pra administradora. Se você é cliente, [vai pra sua conta]." (link to `/minha-conta/meus-dados`)
- **Shell:** sidebar 240px ≥md (UI-SPEC §Mobile-First Layout), max-width 1200px content
- **NO footer** (D-03 explicit)

### 3.12 `app/(admin)/admin/entrar/page.tsx` (NEW — admin login)

- **UI-SPEC reference:** §Surface Inventory row 13 + §Admin copy
- **Copy (literal):** Heading "Entrar como administradora"; CTA "Entrar"
- **Pattern:** Reusa form de `/entrar` mas com copy diferente; após login, audit log `admin_login` (D-08, sem email)

### 3.13 `app/(admin)/admin/page.tsx` (NEW — admin home placeholder)

- **UI-SPEC reference:** §Surface Inventory row 14
- **Phase 1 conteúdo:** Placeholder "Phase 7 traz dashboard"; nav (Auditoria) sidebar
- **No-analog note:** Phase 7 substitui por dashboard real.

### 3.14 `app/(admin)/admin/auditoria/page.tsx` (NEW — audit log viewer)

- **UI-SPEC reference:** §Surface Inventory row 15 + §Admin copy
- **Pattern source:** `01-RESEARCH.md` §Audit Log `app/(admin)/admin/auditoria/page.tsx` block (lines ~1411-1453)
- **Code to copy verbatim:** RSC `prisma.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 200 })` + ACTION_COPY map (PT-BR descriptive strings) + empty state
- **Copy (literal):**
  - Heading "Quem fez o quê"
  - Empty state heading: "Nenhum evento ainda"
  - Empty state body: "Quando alguém entrar no painel ou mexer em alguma coisa importante, vai aparecer aqui."
  - Row format: `{quando} — {quem} — {ação}` (e.g., "Hoje, 14:32 — você — entrou no painel") via `format(e.ts, ..., { locale: ptBR })`

### 3.15 `app/layout.tsx` (MODIFY — add header/footer/sonner/Fraunces, change `lang`)

- **Role:** root layout
- **UI-SPEC reference:** §Mobile-First Layout (header 56px mobile / 64px desktop, brand wordmark Fraunces left) + §Footer (D-03) + §Component Inventory (sonner)
- **Modifications:**
  1. `lang="en"` → `lang="pt-BR"` (line 27 atual)
  2. Add `Fraunces` font import (`next/font/google`)
  3. `metadata` "Create Next App" → "Doces Valentina" + description
  4. Add `<Header>` component (brand wordmark Fraunces 28px mobile / 32px md, conditional CTAs based on session — pattern same as `app/page.tsx` 3-variant)
  5. Add `<Footer>` component (D-03 — 1 line mobile, 2 lines ≥md, content `Doces Valentina · Termos · Privacidade · Dúvidas sobre seus dados? dpo@docesvalentina.com.br`)
  6. Add `<Toaster />` from `sonner` (UI-SPEC §Interaction: top-center mobile, top-right ≥md, 5s success / 8s error)
- **Conditional render:** `<Footer>` NÃO em `/admin/*` paths — handled via segment-specific layout (admin layout sobrescreve), OR root checks `pathname` (preferir admin layout sobrescrevendo).

### 3.16 `app/globals.css` (MODIFY — paleta UI-SPEC)

- **UI-SPEC reference:** §Color tokens (12 CSS vars) + dark-mode tokens (forward-compat, não habilitado)
- **Modifications:**
  - Substituir `--background: #ffffff` / `--foreground: #171717` defaults por `--color-*` tokens UI-SPEC §Color (12 tokens: background, surface, border, accent, accent-soft, accent-foreground, destructive, destructive-foreground, foreground, foreground-muted, ring, success)
  - REMOVER `@media (prefers-color-scheme: dark)` (Phase 1 não habilita dark mode — UI-SPEC §Color "Dark mode" section explicit)
  - MANTER `@theme inline { --font-sans, --font-mono }` (já wired)
  - Adicionar `--font-display: var(--font-fraunces)` (Fraunces variable wired em `app/layout.tsx`)

### 3.17 Header / Footer / Toaster components (NEW — first-instance, em `components/` ou `app/_components/`)

- **Role:** client-component or RSC (header conditional, footer static, toaster client)
- **UI-SPEC reference:** §Mobile-First Layout + §Component Inventory + D-03
- **Files:**
  - `components/header.tsx` (RSC; reads session; renders Fraunces wordmark + conditional CTAs)
  - `components/footer.tsx` (static RSC; D-03 content)
  - `components/toaster.tsx` (`'use client'` wrapper around `Toaster` from sonner)
- **No-analog note:** First "global" components. Phase 2+ adiciona `components/product-card.tsx` etc., seguindo convention (RSC default; `'use client'` only when interactive).

### 3.18 shadcn components (NEW — installed via `npx shadcn add`)

- **Role:** UI primitives (auto-generated by shadcn CLI in `components/ui/`)
- **UI-SPEC reference:** §Component Inventory (11 components) + §Registry Safety (only official `https://ui.shadcn.com`)
- **Components:** `button`, `input`, `label`, `form`, `checkbox`, `card`, `alert`, `sonner`, `separator`, `skeleton`, `table`
- **CLI command:** `npx shadcn@latest init` (preset: new-york + neutral baseColor + CSS vars enabled) → manual override CSS vars per UI-SPEC §Color → `npx shadcn@latest add button input label form checkbox card alert sonner separator skeleton table`
- **NÃO instalar Phase 1 (UI-SPEC):** `dialog`, `select`, `combobox`, `popover`, `dropdown-menu` (defer to phases que precisem)

---

## 4. Files Modified (já existem, foram cobertos em §1 + §3)

Resumo (cross-ref §1 e §3):

| File | Modification |
|------|--------------|
| `app/layout.tsx` | §3.15 — `lang="pt-BR"`, Fraunces, header, footer, sonner, metadata |
| `app/globals.css` | §3.16 — UI-SPEC §Color CSS vars, remove dark-mode media query |
| `app/page.tsx` | §3.1 — REPLACE scaffold por landing 3-variant D-01/D-02/D-04 |
| `next.config.ts` | §1 — add `output: 'standalone'`, `experimental.serverActions.allowedOrigins`, `bodySizeLimit` (mantém `reactCompiler: true`) |
| `package.json` | §1 — add ~25 deps (RESEARCH.md §Standard Stack `Installation` block) + scripts `seed:admin`, `db:migrate`, `db:studio`, `test` |

---

## 5. Closest Analog Notes — Pattern Source Per New File

> Para cada arquivo novo SEM codebase analog, citação concreta da seção source.

| File | Pattern Source (line refs in RESEARCH.md unless noted) |
|------|--------------------------------------------------------|
| `prisma/schema.prisma` | RESEARCH.md §Schema Design lines 565-708 (verbatim copy) |
| `prisma/migrations/<ts>_init/*.sql` | Generated by `npx prisma migrate dev --name init` — no manual code |
| `lib/db/client.ts` | RESEARCH.md §Architecture Pattern 2 lines 462-482 |
| `lib/auth/server.ts` | RESEARCH.md §Auth Flows lines 929-1019 |
| `lib/auth/argon2.ts` | RESEARCH.md §Auth Flows lines 947-952 (argon2Opts block) + OWASP Cheatsheet citation |
| `lib/auth/client.ts` | better-auth.com/docs/integrations/next `createAuthClient` |
| `lib/env.ts` | RESEARCH.md §Env Validation lines 1567-1604 |
| `lib/log.ts` | RESEARCH.md §Logging lines 1639-1671 |
| `lib/email/resend.ts` | RESEARCH.md §Email Infra lines 1462-1467 |
| `lib/email/send-verification.tsx` | RESEARCH.md §Email Infra lines 1471-1497 |
| `lib/email/send-password-reset.tsx` | Same skeleton as send-verification.tsx; copy from UI-SPEC voice (auth flow copy section) |
| `lib/audit/log.ts` | RESEARCH.md §Audit Log + §LGPD `anonymizeUser` example helper inferred |
| `lib/lgpd/export.ts` | RESEARCH.md §LGPD-04 lines 1289-1308 |
| `lib/lgpd/anonymize.ts` | RESEARCH.md §LGPD-05 lines 1313-1349 + Pitfall #8 |
| `lib/ratelimit/memory.ts` | RESEARCH.md §Rate Limit lines 1184-1209 (override Upstash with rate-limiter-flexible) |
| `lib/queue/boss.ts` | RESEARCH.md §pg-boss lines 1533-1545 |
| `lib/validation/auth.ts` | RESEARCH.md §Architecture Pattern 1 (Zod usage) + UI-SPEC §Error copy literal |
| `lib/validation/lgpd.ts` | UI-SPEC §LGPD copy (typed-email confirm) |
| `lib/actions/auth.ts` | RESEARCH.md §Architecture Pattern 1 lines 415-459 (signupCustomer) |
| `instrumentation.ts` | RESEARCH.md §pg-boss lines 1547-1556 + `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md` |
| `proxy.ts` | RESEARCH.md §Middleware/proxy.ts lines 1041-1129 + `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` + `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` §625 (proxy rename) |
| `app/api/auth/[...all]/route.ts` | RESEARCH.md §Auth Flows lines 1023-1033 (CORRECTION: `[...all]` not `[...path]`) |
| `app/api/me/export/route.ts` | RESEARCH.md §LGPD-04 lines 1265-1284 |
| `app/api/me/delete/route.ts` | RESEARCH.md §LGPD-05 lines 1352-1378 |
| `app/api/webhooks/resend/route.ts` | RESEARCH.md §Email Infra lines 1502-1523 |
| `scripts/seed-admin.ts` | RESEARCH.md §Bootstrap CLI lines 1839-1903 (D-05 + D-07) |
| `Dockerfile` | RESEARCH.md §Cloudflare/Caddy + `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` (`output: 'standalone'`) |
| `docker-compose.yml` | RESEARCH.md §Cloudflare/Caddy lines 1786-1805 + Pitfall #4 (healthcheck) |
| `Caddyfile` | RESEARCH.md §Cloudflare/Caddy lines 1747-1772 |
| `scripts/setup-ufw.sh` | RESEARCH.md §Cloudflare/Caddy lines 1707-1734 |
| `.env.example` | RESEARCH.md §Env Validation lines 1606-1624 |
| `vitest.config.ts` / `tests/setup.ts` / `tests/conftest.ts` | RESEARCH.md §Validation Architecture (Wave 0 Gaps) |
| All `tests/auth/*.test.ts`, `tests/lgpd/*.test.ts`, etc. | RESEARCH.md §Phase Requirements → Test Map (lines ~2189-2219) |
| `app/page.tsx` | UI-SPEC §Surface Inventory + CONTEXT.md D-01/D-02/D-04 + UI-SPEC §Brand & Voice |
| `app/cadastro/page.tsx` | UI-SPEC §Surface Inventory rows 1-2 + §Auth flow copy (locked literals) + §Mobile-First (sticky CTA) |
| `app/entrar/page.tsx` | UI-SPEC §Surface Inventory row 4 + §Auth copy |
| `app/esqueci-minha-senha/page.tsx` | UI-SPEC row 5 + §Auth copy "Generic anti-enumeration" |
| `app/esqueci-minha-senha/enviado/page.tsx` | UI-SPEC row 6 |
| `app/redefinir-senha/[token]/page.tsx` | UI-SPEC row 7 + §Auth copy "Redefinir senha" |
| `app/auth/confirmar-email/[token]/page.tsx` | UI-SPEC row 3 + §Auth copy "Email confirmation landing" |
| `app/(public)/termos/page.tsx` | UI-SPEC row 11 + §Auth copy "Termos page intro" |
| `app/(public)/privacidade/page.tsx` | UI-SPEC row 12 + §Auth copy "Privacidade page intro" + RESEARCH.md §LGPD-03 lines 1231-1261 (placeholder content) |
| `app/minha-conta/layout.tsx` | RESEARCH.md §Middleware lines 1151-1157 (cliente layout role gate) |
| `app/minha-conta/meus-dados/page.tsx` | UI-SPEC row 8 + §LGPD copy |
| `app/minha-conta/excluir/page.tsx` | UI-SPEC row 9 + §Destructive actions inventory + §LGPD copy "Excluir conta" |
| `app/(admin)/admin/layout.tsx` | RESEARCH.md §Middleware lines 1141-1149 + UI-SPEC §Mobile-First (admin shell) + D-03 (no footer) |
| `app/(admin)/admin/entrar/page.tsx` | UI-SPEC row 13 + §Admin copy |
| `app/(admin)/admin/page.tsx` | UI-SPEC row 14 (placeholder Phase 7) |
| `app/(admin)/admin/auditoria/page.tsx` | UI-SPEC row 15 + §Admin copy + RESEARCH.md §Audit Log lines 1411-1453 |
| `components/header.tsx` | UI-SPEC §Mobile-First Layout (header) + CONTEXT.md D-01/D-02/D-04 (CTA conditional) |
| `components/footer.tsx` | UI-SPEC D-03 (footer fino global) + §LGPD copy "DPO email no rodapé" |
| `components/toaster.tsx` | UI-SPEC §Interaction (sonner top-center mobile / top-right ≥md, 5s/8s) |
| `components/ui/*.tsx` (shadcn) | `npx shadcn add` — official registry only |

---

## 6. Shared Patterns (Cross-Cutting Concerns)

### 6.1 Authentication / Session Read

- **Source:** `lib/auth/server.ts` (Pattern 2.4) — Better Auth `auth.api.getSession({ headers: await nextHeaders() })`
- **Apply to:** Every page/layout/route-handler that needs to know who is logged in
- **Critical:** `await nextHeaders()` (Next 16 async — Pitfall #3); never `headers()` synchronous
- **Concrete code:**
  ```ts
  import { headers as nextHeaders } from 'next/headers'
  import { auth } from '@/lib/auth/server'
  // RSC or Server Action:
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  ```

### 6.2 Error Handling / Anti-Enumeration

- **Source:** UI-SPEC §Error/fallback copy + RESEARCH.md Pitfall #6
- **Apply to:** Every Server Action in `lib/actions/auth.ts` + LGPD endpoints
- **Pattern:** All errors return UI-SPEC literal copy; sensitive flows always return same message regardless of email existence
- **Code excerpt (RESEARCH.md §Architecture Pattern 1):**
  ```ts
  try {
    await auth.api.signUpEmail({ body: ... })
  } catch (e) {
    return { error: 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.' }
  }
  ```

### 6.3 Validation (Zod)

- **Source:** `lib/validation/auth.ts` (Pattern 2.17)
- **Apply to:** Every Server Action that takes user input + every Route Handler that takes formData/body
- **Pattern:** `Schema.safeParse(Object.fromEntries(formData))` → return early on `!success` with UI-SPEC field error literals

### 6.4 Rate Limiting

- **Source:** `lib/ratelimit/memory.ts` (Pattern 2.15)
- **Apply to:** All Server Actions that call Better Auth APIs (`signupCustomer`, `signinUser`, `requestPasswordReset`, `resetPassword`)
- **Pattern (RESEARCH.md §Architecture Pattern 1):**
  ```ts
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.' }
  ```

### 6.5 Audit Logging

- **Source:** `lib/audit/log.ts` (Pattern 2.12)
- **Apply to:** Every state change relevant to AUTH-11 (admin login, signup, email verify, password reset, account delete, CLI seed/reset)
- **Critical:** Pass `rawIp`/`rawUa`; helper hashes (Pitfall #9 — never plaintext IP/UA in DB)

### 6.6 Logging (pino)

- **Source:** `lib/log.ts` (Pattern 2.8)
- **Apply to:** Every server module that needs structured logging (NOT for user-visible errors — those go to UI-SPEC copy via `return { error: ... }`)
- **Pattern:** `import { logger } from '@/lib/log'`; never `console.log` in app code

### 6.7 CSP Nonce Propagation

- **Source:** `proxy.ts` (Pattern 2.20) generates nonce; pages access via `(await nextHeaders()).get('x-nonce')`
- **Apply to:** Any inline `<script>` that Phase 1 has (none expected — UI-SPEC has no inline scripts; Phase 4+ analytics inline scripts must use nonce)
- **Code excerpt (RESEARCH.md §CSP):**
  ```ts
  const nonce = (await nextHeaders()).get('x-nonce')
  return <script nonce={nonce} ...>
  ```

### 6.8 Server Action Origin Check

- **Source:** `next.config.ts` `experimental.serverActions.allowedOrigins`
- **Apply to:** Built-in to Next 16; configured once in `next.config.ts`
- **Pitfall #7:** Config STAYS under `experimental` despite SA being stable — easy to put at top-level by mistake

---

## 7. No Analog Found (Files with Zero Codebase Reference)

**ALL 60 new files are no-analog** — Phase 1 is greenfield.

For all of them, the pattern source is RESEARCH.md or UI-SPEC.md (cited per file in §5 above). This is expected and normal for the first phase of a project.

**Implication for planner:** Plans referencing these files should cite the RESEARCH.md/UI-SPEC.md line ranges directly (do not waste tokens looking for non-existent codebase analogs). Each file becomes the **template** for Phase 2+ to copy.

---

## 8. Pattern Inheritance for Phase 2+

The following Phase 1 files become **canonical templates**. Phase 2+ planner/executor copies these patterns 1:1:

| Pattern | First-Instance File (Phase 1) | Phase 2+ Inheritance |
|---------|-------------------------------|----------------------|
| Prisma model conventions (`@db.Decimal(19,4)`, `@db.Timestamptz(6)`, `@db.Uuid`, `@@map` snake_case) | `prisma/schema.prisma` | Every new model in Phase 2 (`Ingrediente`, `Receita`, `Lote`, `Produto`) follows |
| Server Action 7-step skeleton | `lib/actions/auth.ts` | `lib/actions/reservas.ts`, `lib/actions/ingredientes.ts`, etc. |
| Route Handler with auth + JSON download | `app/api/me/export/route.ts` | Future per-domain export handlers |
| Webhook svix verify | `app/api/webhooks/resend/route.ts` | Any future signed webhook |
| CLI script with audit log | `scripts/seed-admin.ts` | Future `scripts/sync-resend-domain.ts`, `scripts/anonymize-aged-data.ts` |
| Test directory per domain | `tests/auth/`, `tests/lgpd/`, `tests/audit/` | `tests/ingredientes/`, `tests/reservas/`, etc. |
| Layout role gate | `app/(admin)/admin/layout.tsx`, `app/minha-conta/layout.tsx` | Any future role-gated route group |
| Email template with React Email + UI-SPEC voice | `lib/email/send-verification.tsx` | Phase 4 `send-reservation-confirmed.tsx`, `send-points-earned.tsx` |
| Audit log helper invocation pattern | `lib/audit/log.ts` callers | Phase 2+ `logAudit({ action: 'preco_alterado', ... })` (no schema migration needed) |

---

## Metadata

**Analog search scope:** Project root (`E:/BRCONNECT/doces_mae/`) — verified via `Glob app/**/*` + `Glob *.{ts,tsx,js,json,md}` + read of all 4 scaffold files (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`) + `package.json` + `tsconfig.json`.

**Files scanned in codebase:** ~7 (scaffold default; codebase is greenfield).

**Pattern extraction date:** 2026-04-30

**Source files consumed:**
- `01-CONTEXT.md` (147 lines, full read)
- `01-RESEARCH.md` (2349 lines, read in 4 non-overlapping ranges: 1-600, 600-1300, 1300-2000, 2000-2349)
- `01-UI-SPEC.md` (397 lines, full read)
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`, `package.json`, `tsconfig.json` (all of codebase)

---

*Phase: 01-foundation*
*Pattern map: 2026-04-30*
*Mapper: gsd-pattern-mapper*
*Consumed by: gsd-planner (next step in /gsd-plan-phase orchestrator)*
