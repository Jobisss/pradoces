---
phase: 01-foundation
plan: 02
subsystem: database
tags: [prisma7, postgres, timestamptz, driver-adapter, prisma-config, vitest, migrations]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 01)
    provides: "Vitest 4 harness (setup.ts/conftest.ts stubs), lib/env.ts (DATABASE_URL schema), TZ convention"
provides:
  - "Prisma 7 schema: User, Session, Account, Verification, AuditLog + Role enum"
  - "Initial migration 20260629133830_init applied (5 tables, snake_case, Timestamptz(6))"
  - "lib/db/client.ts — hot-reload-safe PrismaClient singleton via @prisma/adapter-pg driver adapter"
  - "prisma.config.ts — Prisma 7 datasource/url home + .env loader (CLI)"
  - "Real DB test fixtures: createTestUser(), truncateAll(); global afterEach DB reset"
  - "tests/timezone.test.ts — proves Timestamptz(6) round-trip for America/Sao_Paulo (INFRA-10)"
affects: [01-03 (Better Auth adapter Prisma), 01-06 (audit_log persist), 01-07 (LGPD export/anon), all Phase 2+ domain models]

# Tech tracking
tech-stack:
  added: ["prisma@7.8.0", "@prisma/client@7.8.0", "@prisma/adapter-pg@7.8.0", "decimal.js@10", "pg (via adapter)"]
  patterns: [prisma7-config-datasource, prisma7-driver-adapter-runtime, uuid-pk, snake-case-map, timestamptz6, decimal-19-4-convention, db-backed-test-fixtures]

key-files:
  created: [prisma/schema.prisma, prisma.config.ts, lib/db/client.ts, "prisma/migrations/20260629133830_init/migration.sql", prisma/migrations/migration_lock.toml, tests/timezone.test.ts]
  modified: [package.json, vitest.config.ts, tests/setup.ts, tests/conftest.ts]

key-decisions:
  - "Prisma 7 moved datasource url out of schema.prisma into prisma.config.ts; client connects via @prisma/adapter-pg driver adapter (Rust engine removed)"
  - "AuditLog uses BigInt autoincrement PK (cheap append-only index) vs UUID used by domain/auth tables"
  - "lib/db/client.ts reads process.env.DATABASE_URL directly (sanctioned carve-out like NODE_ENV in log.ts) to avoid forcing full t3-env validation at import time"
  - "vitest.config.ts loads .env via process.loadEnvFile() before workers fork so the adapter sees DATABASE_URL at module-import time"

patterns-established:
  - "Prisma 7 connection: schema.prisma has NO url; prisma.config.ts holds datasource.url for CLI; PrismaClient gets a driver adapter at runtime"
  - "Model conventions: String @id @default(uuid()) @db.Uuid, snake_case @@map/@map, DateTime @db.Timestamptz(6), money (Phase 2+) Decimal @db.Decimal(19,4)"
  - "Test isolation: global afterEach in tests/setup.ts truncates Phase 1 tables in one $transaction (children before users); append new tables here in future phases"

requirements-completed: [INFRA-08, INFRA-09, INFRA-10]

# Metrics
duration: ~40min
completed: 2026-06-29
---

# Phase 1 Plan 02: Prisma 7 Schema + Initial Migration + DB Client + Tests Summary

**Prisma 7 trazido ao projeto com schema declarativo de 5 modelos (User/Session/Account/Verification/AuditLog) + enum Role, migration inicial aplicada num Postgres dedicado, client singleton via driver adapter `@prisma/adapter-pg`, e harness de teste real com round-trip de `Timestamptz(6)` provando `America/Sao_Paulo` (INFRA-10).**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-29T10:05Z (approx)
- **Completed:** 2026-06-29T10:43Z (approx)
- **Tasks:** 3
- **Files modified/created:** 10 source files (+ package-lock.json)

## Accomplishments
- **Prisma 7 instalado e funcional** (`prisma`/`@prisma/client`/`@prisma/adapter-pg` 7.8.0 + `decimal.js@10`). Lidando com a mudança de quebra do v7 (Rust query engine removido; `Query Compiler: enabled`).
- **`prisma/schema.prisma`** com 5 modelos + enum `Role`, seguindo as convenções travadas: PK UUID (`@db.Uuid`), `@@map`/`@map` snake_case, **18 campos `@db.Timestamptz(6)`**, e convenção de dinheiro `Decimal @db.Decimal(19,4)` documentada em comentário (Phase 1 não tem coluna de dinheiro — trava o padrão pra Phase 2).
- **Migration `20260629133830_init` aplicada** ao DB: 5 tabelas (`users`, `sessions`, `accounts`, `verifications`, `audit_log`) + `CREATE TYPE "Role"`, todas com `TIMESTAMPTZ(6)`. `migration_lock.toml` versionado (`provider = "postgresql"`).
- **`lib/db/client.ts`** — singleton hot-reload-safe (`globalForPrisma`) usando o driver adapter `PrismaPg` (obrigatório no v7 pra conexão direta).
- **Fixtures de teste reais:** `createTestUser()` e `truncateAll()` agora batem no Postgres (deixaram de ser stubs que lançavam erro); `tests/setup.ts` faz reset global por `afterEach` em uma transação.
- **`tests/timezone.test.ts`** prova INFRA-10: instante em São Paulo persiste e lê de volta o mesmo instante (UTC), e renderiza `30/04/2026 14:00` em `America/Sao_Paulo`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Prisma 7 + schema.prisma + lib/db/client.ts (+ prisma.config.ts)** - `b495371` (feat)
2. **Task 2: [BLOCKING] prisma migrate dev --name init** - `5e4b7b7` (feat)
3. **Task 3: Real test fixtures + tests/timezone.test.ts (+ vitest .env load)** - `ef5df62` (feat)

**Plan metadata:** _(this SUMMARY commit — see final commit)_

## Files Created/Modified
- `prisma/schema.prisma` - 5 models + Role enum; UUID PK, snake_case @@map, Timestamptz(6); datasource sem `url` (v7)
- `prisma.config.ts` - **NOVO (deviation v7):** home do `datasource.url` + carregamento de `.env` via `process.loadEnvFile()` pro CLI
- `lib/db/client.ts` - PrismaClient singleton via `PrismaPg` driver adapter (lê `process.env.DATABASE_URL`)
- `prisma/migrations/20260629133830_init/migration.sql` - DDL das 5 tabelas + enum Role (TIMESTAMPTZ(6))
- `prisma/migrations/migration_lock.toml` - pin `provider = "postgresql"`
- `tests/conftest.ts` - `createTestUser`/`truncateAll` reais (Prisma-backed); auth fixtures continuam stub até Plan 03
- `tests/setup.ts` - `afterEach` global trunca tabelas Phase 1 em 1 `$transaction`
- `tests/timezone.test.ts` - 2 testes de round-trip Timestamptz (INFRA-10)
- `vitest.config.ts` - carrega `.env` antes dos workers forkarem (DATABASE_URL pro adapter)
- `package.json` / `package-lock.json` - +4 deps (prisma como devDep)

## Decisions Made
- **AuditLog com BigInt autoincrement PK** (vs UUID das demais): tabela append-only de alto volume; índice inteiro é mais barato que UUID. (Confirma decisão de 01-CONTEXT.md "Claude's Discretion / Audit log".)
- **`process.env.DATABASE_URL` lido direto em `lib/db/client.ts`:** mesma justificativa do carve-out de `NODE_ENV` em `lib/log.ts` (Plan 01) — `client.ts` é importado cedo/amplo (incl. testes/scripts) e roteá-lo por `lib/env.ts` forçaria validação t3-env completa de todos os secrets no import. `lib/env.ts` ainda valida `DATABASE_URL` no build via `next.config.ts`.
- **Postgres de teste dedicado em container Docker isolado** (`doces-pg`, host port `5440`, db `doces_valentina`) — não reusa os Postgres de outros projetos já rodando na máquina; `127.0.0.1` em vez de `localhost` no `DATABASE_URL` pra evitar resolução IPv6 (`::1`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Version compat / Blocking] Prisma 7 removeu `url` do datasource — exige `prisma.config.ts` + driver adapter**
- **Found during:** Task 1 (`prisma validate`)
- **Issue:** O schema verbatim do plano (de RESEARCH.md, era v6) usava `url = env("DATABASE_URL")` no bloco `datasource` e `import { PrismaClient } from '@prisma/client'` sem adapter. Prisma 7.8 falhou: `P1012 — The datasource property 'url' is no longer supported in schema files. Move connection URLs ... to prisma.config.ts and pass either 'adapter' ... or 'accelerateUrl'`. Exatamente a quebra que AGENTS.md mandou verificar antes de codar.
- **Fix:** (a) removi `url` do `datasource`; (b) criei `prisma.config.ts` com `defineConfig({ datasource: { url: env('DATABASE_URL') }, ... })` + `process.loadEnvFile()` (v7 não auto-carrega `.env`); (c) instalei `@prisma/adapter-pg@7` e configurei `lib/db/client.ts` com `new PrismaPg({ connectionString })` passado ao `PrismaClient({ adapter })`.
- **Files modified:** prisma/schema.prisma, prisma.config.ts (novo), lib/db/client.ts, package.json
- **Verification:** `prisma validate` → "The schema ... is valid"; `prisma generate` → "Generated Prisma Client (v7.8.0)"; `tsc --noEmit` exit 0; migration aplica e testes conectam.
- **Committed in:** `b495371` (Task 1) / `5e4b7b7` (migration)

**2. [Rule 3 - Blocking] Vitest não injeta `.env` no `process.env` — adapter recebia DATABASE_URL undefined**
- **Found during:** Task 3 (primeira execução de `tests/timezone.test.ts`)
- **Issue:** `prisma:error SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` — o adapter é criado no import de `lib/db/client.ts` (antes de qualquer hook), e Vitest não carrega `.env` para `process.env`, então `connectionString` era `undefined`.
- **Fix:** `process.loadEnvFile()` no topo de `vitest.config.ts` (avaliado antes dos workers forkarem; forks herdam o env). Sem dependência de `dotenv` (built-in do Node 24).
- **Files modified:** vitest.config.ts
- **Verification:** `vitest run tests/timezone.test.ts` → 2 passed (680ms); suíte completa → 6 passed / 2 todo.
- **Committed in:** `ef5df62` (Task 3)

---

**Total deviations:** 2 auto-fixed (ambas blocking — 1 quebra de versão Prisma 7, 1 carregamento de env no Vitest).
**Impact on plan:** Necessárias pra correção; o resultado funcional é idêntico ao pretendido pelo plano (schema, migration, client singleton, fixtures, teste de timezone). O `prisma.config.ts` é arquivo novo exigido pelo v7 — sem scope creep além disso. As convenções de modelo (UUID/snake_case/Timestamptz/Decimal) ficaram exatamente como especificado.

## Known Stubs
- `tests/conftest.ts`: `signInAsCustomer`, `signInAsAdmin`, `generateResetToken` ainda lançam `Error('Plan 03 implements this once Better Auth lands')`. **Intencional** — dependem do Better Auth (Plan 03). `createTestUser`/`truncateAll` (escopo deste plano) são reais.

## Issues Encountered
- **Postgres local com senha desconhecida:** o PG16 instalado na máquina (porta 5432) recusou `postgres/postgres`. Resolvido subindo um container Docker dedicado (`doces-pg`) na porta 5440, isolado dos outros bancos da máquina.
- **IPv6 `::1`:** `localhost:5440` falhava ("server closed connection unexpectedly") via cliente psql do host; `127.0.0.1` funciona. `DATABASE_URL` usa `127.0.0.1`.
- **`binaryTargets` no generator:** mantido verbatim do plano; v7 ignora (engine removido) sem erro em `validate`/`generate`. Inofensivo; pode ser limpo numa fase futura.

## User Setup Required
None para CI/dev local automatizado neste plano. Para reproduzir localmente: subir um Postgres 16 e apontar `DATABASE_URL` no `.env` (gitignored). O `.env` deste ambiente aponta para o container `doces-pg` em `127.0.0.1:5440`.

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| `prisma migrate dev --name init` cria 5 tabelas + enum Role sem erro | PASS — `20260629133830_init`; `\dt` lista users/sessions/accounts/verifications/audit_log |
| Timestamptz(6) em America/Sao_Paulo preserva o instante no insert/read | PASS — `tests/timezone.test.ts` 2/2 (toISOString igual; render `30/04/2026 14:00`) |
| `lib/db/client.ts` singleton reusável em hot-reload (DEV) sem novos clients | PASS — `globalForPrisma.prisma ?? new PrismaClient`; reatribui só fora de production |
| Fixtures `truncateAll()`/`createTestUser()` reais (não lançam "Plan 02") | PASS — Prisma-backed; suíte 6 passed / 2 todo |
| `prisma validate` | PASS — "The schema ... is valid" |
| `prisma migrate status` | PASS — "Database schema is up to date!" |
| `tsc --noEmit` (projeto) | PASS — exit 0 |
| migration.sql usa TIMESTAMPTZ(6) (≥10) | PASS — 21 ocorrências |

## Next Phase Readiness
- **Plan 01-03 (Better Auth):** pode usar o adapter Prisma; tabelas `users/sessions/accounts/verifications` já casam com o shape do Better Auth; pode implementar `signInAsCustomer`/`signInAsAdmin`/`generateResetToken` em `tests/conftest.ts`.
- **Plan 01-06/07 (audit_log / LGPD):** `prisma.auditLog`, `prisma.user` (deletedAt/anonymizedAt) prontos.
- **Phase 2+:** convenção `Decimal @db.Decimal(19,4)` documentada no schema; novas tabelas devem entrar na lista de truncate em `tests/setup.ts`.
- **Nota de infra:** container `doces-pg` (Docker) é o Postgres de dev/teste local; um `docker-compose.yml` versionado virá no Plan de infra (08). `.env` é gitignored.

## Self-Check: PASSED
Todos os 10 arquivos declarados existem em disco; os 3 commits de task (b495371, 5e4b7b7, ef5df62) presentes no histórico git.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
