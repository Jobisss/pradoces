---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [better-auth, argon2id, prisma-adapter, proxy, csp, nextjs16, role-gate, sessions]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 02)
    provides: "Prisma 7 driver-adapter singleton (lib/db/client.ts), User/Session/Account/Verification models + Role enum, real DB test fixtures (createTestUser/truncateAll), vitest .env loader"
  - phase: 01-foundation (Plan 01)
    provides: "lib/env.ts (BETTER_AUTH_SECRET/URL schema), lib/log.ts (pino + PII redaction), Vitest 4 harness"
provides:
  - "lib/auth/argon2.ts — argon2id hash/verify wrappers locked at OWASP profile 2 (m=19456, t=2, p=1)"
  - "lib/auth/server.ts — Better Auth init (prismaAdapter + emailAndPassword w/ argon2 + admin plugin + nextCookies last + 7 additionalFields + generateId:false)"
  - "lib/auth/client.ts — createAuthClient for Phase 2+ Client Components"
  - "app/api/auth/[...all]/route.ts — Better Auth catch-all handler (GET/POST)"
  - "proxy.ts — Next 16 proxy: per-request CSP nonce + security headers + cookie-presence guards for /admin/* and /minha-conta/*"
  - "app/(admin)/admin/layout.tsx + app/minha-conta/layout.tsx — DB-session role gate (2nd security layer)"
  - "Real auth test fixtures: signInAsCustomer/signInAsAdmin (forge valid signed session cookie), generateResetToken"
  - "Prisma migration better_auth_admin_fields: users.banned/ban_reason/ban_expires + sessions.impersonated_by"
affects: [01-04 (Resend wired into sendResetPassword/sendVerificationEmail stubs), 01-05 (auth UI forms + Server Actions), 01-06 (admin_login audit), 01-07 (LGPD anonymize revokes sessions), all Phase 2+ Server Actions and route guards]

# Tech tracking
tech-stack:
  added: ["better-auth@1.6.22", "@node-rs/argon2@2.0.2"]
  patterns: [two-layer-auth-guard, proxy-csp-nonce, argon2id-owasp-profile2, better-auth-prisma-adapter, db-uuid-generateId-false, signed-session-cookie-test-fixture]

key-files:
  created:
    - lib/auth/argon2.ts
    - lib/auth/server.ts
    - lib/auth/client.ts
    - app/api/auth/[...all]/route.ts
    - proxy.ts
    - app/(admin)/admin/layout.tsx
    - app/minha-conta/layout.tsx
    - tests/auth/argon2.test.ts
    - tests/auth/admin-guard.test.ts
    - prisma/migrations/20260629135330_better_auth_admin_fields/migration.sql
  modified:
    - prisma/schema.prisma
    - tests/conftest.ts
    - package.json

key-decisions:
  - "admin() configured defaultRole='customer'/adminRoles=['admin'] to match Prisma Role enum (plugin default 'user' is invalid for our enum)"
  - "advanced.database.generateId=false so Postgres/Prisma @default(uuid()) owns id generation (Better Auth's default ids are non-UUID strings, incompatible with @db.Uuid columns)"
  - "New migration adds the admin plugin's required columns (banned/banReason/banExpires/impersonatedBy) rather than dropping the admin plugin (Plan 03 + later D-05/D-07 CLI depend on setUserPassword/revokeUserSessions)"
  - "Test fixtures forge the exact Better Auth signed cookie (HMAC-SHA256 over the session token) instead of password sign-in, because createTestUser rows have no password/account"

patterns-established:
  - "2-layer auth guard (Pitfall #2): proxy.ts does fast DB-free cookie-PRESENCE check; protected-route layouts do the thorough auth.api.getSession DB role check. Every Phase 2+ protected segment follows this."
  - "proxy.ts owns CSP (per-request nonce + strict-dynamic) and security headers on every response; HSTS deferred to Caddy (Plan 08)"
  - "argon2id tuning lives only in lib/auth/argon2.ts (OWASP profile 2); future profile bumps touch one file"
  - "Better Auth session reads always use auth.api.getSession({ headers: await nextHeaders() }) (Next 16 async headers — Pitfall #3)"

requirements-completed: [AUTH-04, AUTH-05, AUTH-06, AUTH-08, AUTH-10, INFRA-05]

# Metrics
duration: ~35min
completed: 2026-06-29
---

# Phase 1 Plan 03: Auth Core (Better Auth + argon2id + proxy.ts + role-gate layouts) Summary

**Backbone de autenticação no ar: Better Auth 1.6 sobre o adapter Prisma 7, senhas em argon2id (OWASP profile 2), handler catch-all montado, `proxy.ts` do Next 16 com CSP por-request + guarda de presença de cookie, e layouts com checagem de role no banco — o padrão de guarda em 2 camadas que todas as fases seguintes herdam.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-29T13:25Z (approx)
- **Completed:** 2026-06-29T14:00Z
- **Tasks:** 3
- **Files created/modified:** 13 (10 created, 3 modified) + 1 migration

## Accomplishments
- **argon2id provado** com OWASP profile 2 (m=19456, t=2, p=1, argon2id) — 5 testes (roundtrip, senha errada, prefixo `$argon2id$`, params no PHC string, salt aleatório).
- **Better Auth inicializado** sobre o singleton Prisma 7 (`prismaAdapter(prisma, { provider: 'postgresql' })`), com `emailAndPassword` usando nossos wrappers argon2id, `requireEmailVerification`, `revokeSessionsOnPasswordReset`, reset token 1h, 7 `additionalFields` alinhados ao schema, `admin()` + `nextCookies()` (último).
- **Handler catch-all** `app/api/auth/[...all]/route.ts` montado — `POST /api/auth/sign-up/email` retorna 200 e persiste o usuário com **UUID real** e `role='customer'`.
- **`proxy.ts` (Next 16)** gera nonce de CSP por request, aplica CSP estrita + headers de segurança em toda resposta, e faz a guarda de presença de cookie: `/admin/*` → `/admin/entrar`, `/minha-conta/*` → `/entrar` (verificado por curl: 307 + Location corretos; `/admin/entrar` passa sem loop).
- **Guarda em 2 camadas** completa: layouts `app/(admin)/admin/layout.tsx` (403 UI para não-admin) e `app/minha-conta/layout.tsx` (redirect admin→/admin, D-06) com `auth.api.getSession`.
- **Fixtures de auth reais**: `signInAsCustomer`/`signInAsAdmin` forjam o cookie de sessão assinado exatamente como o Better Auth (HMAC-SHA256 sobre o token), aceito por `auth.api.getSession`; `generateResetToken` grava verification row. Suíte de auth: 10/10; suíte total: 16/16.

## Task Commits

Each task was committed atomically:

1. **Task 1: argon2id wrapper + Better Auth init + client + argon2 test** - `a0e866e` (feat)
2. **Task 2: auth route handler + proxy.ts (CSP + guards) + role-gate layouts** - `9514770` (feat)
3. **Task 3: real auth fixtures + admin-guard integration test** - `14b656a` (test)

**Plan metadata:** _(this SUMMARY commit — see final commit)_

## Files Created/Modified
- `lib/auth/argon2.ts` - hash/verify argon2id, OWASP profile 2 (parâmetros travados aqui)
- `lib/auth/server.ts` - `betterAuth({...})`: prismaAdapter, emailAndPassword (argon2), emailVerification stubs, additionalFields (7), session 30d, `advanced.database.generateId:false`, `admin({defaultRole:'customer',adminRoles:['admin']})` + `nextCookies()`
- `lib/auth/client.ts` - `createAuthClient` (`'use client'`) para Phase 2+
- `app/api/auth/[...all]/route.ts` - `toNextJsHandler(auth)` GET/POST
- `proxy.ts` - CSP nonce + headers + cookie-presence guards (raiz do projeto, convenção Next 16)
- `app/(admin)/admin/layout.tsx` - role gate DB; 403 com copy UI-SPEC "Essa parte é só pra administradora"
- `app/minha-conta/layout.tsx` - role gate DB; admin→/admin (D-06)
- `tests/auth/argon2.test.ts` - 5 testes argon2id
- `tests/auth/admin-guard.test.ts` - 5 testes getSession/role (T-PrivEsc-01)
- `tests/conftest.ts` - fixtures reais (cookie assinado), substituem stubs do Plan 02
- `prisma/schema.prisma` - +banned/banReason/banExpires (User), +impersonatedBy (Session)
- `prisma/migrations/20260629135330_better_auth_admin_fields/migration.sql` - ALTER TABLE (4 colunas)
- `package.json` - +better-auth@1.6.22, +@node-rs/argon2@2.0.2

## Decisions Made
- **`admin()` com `defaultRole:'customer'` + `adminRoles:['admin']`**: o plugin escreve `role` no signup; o default dele (`'user'`) não existe no enum `Role` (admin | customer). Alinhar evita `PrismaClientValidationError`.
- **`advanced.database.generateId:false`**: as colunas `id` são `@db.Uuid` com `@default(uuid())`; o gerador de id do Better Auth emite strings não-UUID (ex. `bgvKGHvUhfnWGa1sQkjA1nHIKZb11SmR`) que violam o tipo uuid. Deixar o Postgres gerar o id resolve.
- **Cookie assinado nas fixtures** (em vez de sign-in por senha): usuários de `createTestUser` não têm account/senha; replicar a assinatura HMAC do Better Auth dá um cookie válido para `getSession` sem precisar do fluxo de senha.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `nextCookies` importado de `better-auth/next-js`, não de `better-auth/plugins`**
- **Found during:** Task 1 (montagem de `lib/auth/server.ts`)
- **Issue:** O snippet verbatim do plano fazia `import { admin, nextCookies } from 'better-auth/plugins'`. Em Better Auth 1.6.22 `nextCookies` vive em `better-auth/next-js` (confirmado nos exports do pacote); o import falharia.
- **Fix:** `import { admin } from 'better-auth/plugins'` + `import { nextCookies } from 'better-auth/next-js'`.
- **Files modified:** lib/auth/server.ts
- **Verification:** `tsc --noEmit` exit 0; handler responde.
- **Committed in:** `a0e866e` (Task 1)

**2. [Rule 1 - Bug] Role default do admin plugin (`'user'`) incompatível com o enum `Role`**
- **Found during:** Task 2 (smoke test `POST /sign-up/email`)
- **Issue:** Signup retornava 422 `FAILED_TO_CREATE_USER`; log Prisma: `Invalid value for argument 'role'. Expected Role.` — o plugin gravava `role:'user'`.
- **Fix:** `admin({ defaultRole: 'customer', adminRoles: ['admin'] })`.
- **Files modified:** lib/auth/server.ts
- **Verification:** signup persistiu `role='customer'`.
- **Committed in:** `9514770` (Task 2)

**3. [Rule 2 - Missing Critical] Colunas exigidas pelo admin plugin ausentes no schema**
- **Found during:** Task 2 (smoke test, após corrigir o role)
- **Issue:** `Unknown argument 'banned'` — o admin plugin adiciona `banned/banReason/banExpires` ao user e `impersonatedBy` à session, que não existiam (migration do Plan 02 era anterior à entrada do Better Auth).
- **Fix:** schema.prisma + nova migration `better_auth_admin_fields` (`prisma migrate dev`) adicionando as 4 colunas (snake_case via `@map`, `ban_expires` Timestamptz(6)).
- **Files modified:** prisma/schema.prisma, prisma/migrations/20260629135330_better_auth_admin_fields/migration.sql
- **Verification:** `prisma migrate status` up-to-date; signup 200; client conhece os campos.
- **Committed in:** `9514770` (Task 2)

**4. [Rule 1 - Bug] Id não-UUID do Better Auth viola coluna `@db.Uuid`**
- **Found during:** Task 2 (smoke test)
- **Issue:** o create incluía `id:"bgvKGHvUhfnWGa1sQkjA1nHIKZb11SmR"` (não-UUID) — incompatível com `id @db.Uuid`.
- **Fix:** `advanced.database.generateId:false` → Prisma `@default(uuid())` gera o id.
- **Files modified:** lib/auth/server.ts
- **Verification:** usuário criado com UUID `a33773c8-74d5-45aa-be2c-25f204fcbd4f`.
- **Committed in:** `9514770` (Task 2)

**5. [Rule 3 - Blocking] Fixture com token cru não passa por `getSession` (cookie precisa de assinatura)**
- **Found during:** Task 3 (planejado pelo próprio plano como ponto de ajuste)
- **Issue:** O Better Auth assina o cookie de sessão (`token.HMAC`); um cookie com token cru (como no snippet do plano) seria rejeitado por `getSession`.
- **Fix:** Helper `signSessionToken` (webcrypto HMAC-SHA256, base64, `encodeURIComponent`) replicando `signCookieValue` do better-call; cookie `better-auth.session_token=<assinado>`.
- **Files modified:** tests/conftest.ts, tests/auth/admin-guard.test.ts
- **Verification:** "getSession returns session with valid cookie" passa; suíte de auth 10/10.
- **Committed in:** `14b656a` (Task 3)

---

**Total deviations:** 5 auto-fixed (2 blocking, 2 bug, 1 missing-critical). Todas necessárias para o auth core funcionar de fato.
**Impact on plan:** Sem scope creep. As correções 2-4 transformaram o "structured error aceitável" do plano num signup que realmente funciona (200 + usuário UUID + role correto), fortalecendo o must-have. A migration extra é exigência do admin plugin que o plano já mandava usar.

## Issues Encountered
- **Prisma Client desatualizado após a migration**: o app continuava com `Unknown argument 'banned'` até rodar `npx prisma generate` explicitamente e reiniciar o dev server (o `migrate dev` deste ambiente não deixou o client regenerado para o bundle do Turbopack). Resolvido com generate manual + restart.

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| argon2id hash + verify roundtrip (OWASP profile 2) | PASS — `tests/auth/argon2.test.ts` 5/5 |
| `auth.api.getSession({headers})` retorna sessão com cookie válido | PASS — `admin-guard.test.ts` (id + role conferem) |
| `auth.api.getSession` retorna null sem headers / sessão expirada | PASS — 2 testes dedicados |
| GET /admin sem cookie → redirect /admin/entrar (proxy) | PASS — curl 307 → http://localhost:3000/admin/entrar |
| GET /minha-conta sem cookie → redirect /entrar (proxy) | PASS — curl 307 → http://localhost:3000/entrar |
| GET /admin/entrar sem cookie passa (sem loop) | PASS — curl 404 (sem page ainda) e sem redirect |
| GET /admin com sessão customer → 403 do layout | PARCIAL — lógica provada por `getSession` (role customer ≠ admin) + layout type-checked; exercício HTTP completo aguarda as pages de `/admin/*` (Plans 05/12) |
| GET /minha-conta com sessão admin → redirect /admin (D-06) | PARCIAL — lógica provada (getSession devolve role=admin) + layout type-checked; HTTP completo aguarda pages de `/minha-conta/*` |
| POST /api/auth/sign-up/email funciona (handler montado) | PASS — 200; usuário persistido com UUID + role=customer |
| CSP header presente em toda resposta (proxy) | PASS — `Content-Security-Policy` com nonce + `X-Frame-Options:DENY` etc. em `/` e nas respostas de API |
| `tsc --noEmit` (projeto) | PASS — exit 0 |
| Suíte completa | PASS — 16/16 |

## Known Stubs
- `lib/auth/server.ts`: `sendResetPassword` e `sendVerificationEmail` são NOOP (apenas `logger.info`) — **intencional**, Plan 04 conecta o envio real via Resend. Não impedem o objetivo deste plano (auth core).
- Os layouts `(admin)/admin` e `minha-conta` ainda não têm `page.tsx` (entram em Plans 05/12); a guarda de proxy já funciona e a lógica de role dos layouts está provada por teste unitário de `getSession`.

## User Setup Required
None — o `.env` local (gitignored) já tem `BETTER_AUTH_SECRET` (40 chars) e `BETTER_AUTH_URL`, e o container `doces-pg` (Postgres 16, host 5440) está de pé. Para reproduzir: `docker start doces-pg` + `.env` com `DATABASE_URL`/`BETTER_AUTH_SECRET`.

## Next Phase Readiness
- **Plan 04 (Resend/email):** trocar os NOOPs `sendResetPassword`/`sendVerificationEmail` por envio real; tudo o mais do fluxo de verificação/reset já está ligado (`requireEmailVerification`, `revokeSessionsOnPasswordReset`, token 1h).
- **Plan 05 (UI auth + Server Actions):** `auth.api.*` pronto; usar o padrão `auth.api.getSession({ headers: await nextHeaders() })`; fixtures `signInAsCustomer`/`signInAsAdmin` disponíveis para testes.
- **Plans 04-09:** `signInAsCustomer`/`signInAsAdmin`/`generateResetToken` reais. Cookie de sessão em dev: `better-auth.session_token=<token>.<HMAC-base64 url-encoded>`.
- **Nota:** ao adicionar novas tabelas em Phase 2+, lembrar de incluí-las no `truncateAll`/`afterEach` (children antes de users).

## Self-Check: PASSED
Todos os 10 arquivos-fonte + a migration + o SUMMARY existem em disco; os 3 commits de task (a0e866e, 9514770, 14b656a) estão no histórico git.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
