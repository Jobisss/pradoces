---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [vitest, t3-env, zod, pino, next-config, server-actions, testing, observability]

# Dependency graph
requires:
  - phase: 01-foundation (research/patterns)
    provides: env schema shape, pino redact paths, next.config interfaces (RESEARCH/PATTERNS)
provides:
  - "Vitest 4 test framework (config + setup + conftest + per-domain test dirs)"
  - "lib/env.ts — build-time env validation (@t3-oss/env-nextjs + zod), gates next build"
  - "lib/log.ts — pino logger singleton with 27 PII redact paths + createLogger() test factory"
  - ".env.example — canonical template for all Phase 1 env vars"
  - "next.config.ts — output:standalone + experimental.serverActions.allowedOrigins (CSRF allowlist)"
affects: [01-02 (Prisma), 01-03 (Better Auth), all Phase 1+ plans needing tests/env/logging]

# Tech tracking
tech-stack:
  added: [vitest@4, "@vitejs/plugin-react", "@testing-library/react", "@testing-library/jest-dom", "@testing-library/user-event", tsx, "@t3-oss/env-nextjs", zod@4, pino@10, pino-pretty]
  patterns: [env-validation-as-build-gate, pino-redact-cumulative, test-dir-per-domain, server-actions-origin-allowlist]

key-files:
  created: [lib/env.ts, lib/log.ts, vitest.config.ts, tests/setup.ts, tests/conftest.ts, tests/log-redact.test.ts, tests/serveraction-csrf.test.ts, .env.example]
  modified: [package.json, next.config.ts, .gitignore]

key-decisions:
  - "Vitest 4 (not 1.x as plan assumed): poolOptions removed → fileParallelism:false replaces forks.singleFork for single-instance Postgres test DB"
  - "next.config.ts imports './lib/env' so createEnv() runs at build — without it env.ts is dead code and the build never fails on missing secrets"
  - "lib/log.ts reads process.env.NODE_ENV directly (sanctioned exception to the no-process.env-outside-env.ts convention): log.ts is imported too early/widely to route through env.ts without triggering full validation in tests/scripts"
  - "createLogger(destination) factory added to lib/log.ts so tests capture serialized output synchronously (pino's worker-thread transport bypasses process.stdout.write)"

patterns-established:
  - "Env additions: new vars go ONLY in lib/env.ts (server/client + runtimeEnv); never read process.env.X elsewhere (except NODE_ENV)"
  - "PII redaction: append to lib/log.ts redactPaths cumulatively; never remove a path"
  - "Tests: one directory per domain (tests/auth, tests/lgpd, tests/audit); shared fixtures in tests/conftest.ts; global hooks in tests/setup.ts"
  - "Server Actions: origin allowlist lives under experimental.serverActions.allowedOrigins (Next 16 key path verified against local docs)"

requirements-completed: [INFRA-05, INFRA-06, INFRA-07, INFRA-12]

# Metrics
duration: ~20min
completed: 2026-06-29
---

# Phase 1 Plan 01: Wave 0 Pre-flight Summary

**Vitest 4 framework + t3-env build-gate validation + pino 27-path PII redaction + next.config Server Actions origin allowlist — the foundation every downstream Phase 1 plan depends on.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-29T10:05Z (approx)
- **Completed:** 2026-06-29T10:17Z (approx)
- **Tasks:** 3 (+1 deviation fix commit)
- **Files modified/created:** 11 source files (+ package-lock.json)

## Accomplishments
- Instalado o framework de testes Vitest 4 com config (`fileParallelism:false` para o Postgres de teste single-instance), `tests/setup.ts`, `tests/conftest.ts` (fixtures stub) e diretórios por domínio (`tests/auth`, `tests/lgpd`, `tests/audit`).
- `lib/env.ts` valida todas as env vars da Phase 1 via `@t3-oss/env-nextjs` + zod, com `emptyStringAsUndefined: true` — e agora **trava o build** quando faltam secrets (INFRA-06, T-EnvLeak-01).
- `lib/log.ts` expõe o logger pino singleton com 27 paths de redação de PII (email/senha/telefone/cpf/token/ip/cookie/authorization/svix-signature/…), provado por teste para top-level, aninhado e headers (INFRA-07, T-PII-01).
- `next.config.ts` mantém `reactCompiler: true`, adiciona `output: 'standalone'` (Docker do Plan 08) e `experimental.serverActions.allowedOrigins` + `bodySizeLimit` (INFRA-05, T-CSRF-01).
- `.env.example` documenta todas as chaves do schema; `.gitignore` ajustado para versioná-lo.

## Task Commits

1. **Task 1: Install Wave 0 deps + scaffold tests/ + .env.example** - `4160d5d` (chore)
2. **Task 2: lib/env.ts + lib/log.ts + log-redact/csrf tests** - `9ab541a` (feat)
3. **Task 3: next.config.ts standalone output + serverActions allowlist** - `e28269b` (feat)
4. **Deviation fix: import lib/env in next.config to gate build** - `5f1b6cb` (fix)

**Plan metadata:** _(this SUMMARY commit — see final commit)_

## Files Created/Modified
- `vitest.config.ts` - Vitest 4 config: node env, globals, `@` alias, `tests/setup.ts`, forks pool, `fileParallelism:false`
- `tests/setup.ts` - global beforeEach hook (TODOs reserved for Plan 02 Prisma reset / Plan 03 Better Auth init)
- `tests/conftest.ts` - exported stub fixtures (createTestUser/signInAsCustomer/signInAsAdmin/generateResetToken/truncateAll) — throw until Plan 02/03 implement
- `tests/auth/.gitkeep`, `tests/lgpd/.gitkeep`, `tests/audit/.gitkeep` - per-domain test dirs
- `tests/log-redact.test.ts` - 4 tests proving redaction (top-level, nested *.email, headers, path-count ≥25)
- `tests/serveraction-csrf.test.ts` - `describe.todo` placeholder reserved for Plan 05
- `lib/env.ts` - t3-env schema (all Phase 1 server + client vars), `emptyStringAsUndefined`
- `lib/log.ts` - pino logger + `redactPaths` (27) + `createLogger()` factory
- `.env.example` - template for every env key
- `package.json` - +10 deps, scripts: test, test:area, test:build-fail, db:migrate:dev/deploy, db:studio, seed:admin
- `next.config.ts` - standalone output, serverActions allowlist, `import './lib/env'` build gate
- `.gitignore` - `!.env.example` exception

## Decisions Made
- **Vitest 4, not 1.x:** plan assumed Vitest 1.x; installed `vitest@latest` = 4.1.9. `test.poolOptions` was removed in v4, so `poolOptions.forks.singleFork` → `fileParallelism:false` (same intent: sequential file execution against the single Postgres test DB).
- **NODE_ENV read directly in log.ts:** routing it through `env.ts` would force full env validation at import time, and `log.ts` is imported by nearly everything (including tests/scripts where secrets aren't set). `process.env.NODE_ENV` is the universal t3-env carve-out.
- **createLogger factory:** the plan's stdout-spy test is unreliable for pino (worker-thread pino-pretty transport + SonicBoom write directly to the fd, bypassing `process.stdout.write`). Added a `createLogger(destination)` factory so tests assert on a synchronous in-memory stream using the same `redactPaths`. The `logger` export and all redact paths remain verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.env.example` blocked by `.gitignore` `.env*`**
- **Found during:** Task 1
- **Issue:** `git add .env.example` failed — `.env*` ignored it, but the plan requires it committed as an artifact.
- **Fix:** Added `!.env.example` negation to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `.env.example` now tracked and committed.
- **Committed in:** `4160d5d`

**2. [Rule 3 - Version compat] Vitest 4 removed `poolOptions`**
- **Found during:** Task 2 (running tests)
- **Issue:** `poolOptions.forks.singleFork` triggered a deprecation and was silently ignored in Vitest 4, which would let test files run in parallel against the single-instance Postgres test DB.
- **Fix:** Replaced with `pool:'forks'` + `fileParallelism:false`.
- **Files modified:** `vitest.config.ts`
- **Verification:** Full `vitest run` clean, no deprecation warning.
- **Committed in:** `9ab541a`

**3. [Rule 1 - Test bug] log-redact assertion false-positive**
- **Found during:** Task 2 (first test run)
- **Issue:** Test value `'sig'` is a substring of the (non-redacted) key name `"svix-signature"`, so `not.toContain('sig')` failed even though the value WAS redacted.
- **Fix:** Used a non-colliding test value `'v1,whsecSignatureValue'`.
- **Files modified:** `tests/log-redact.test.ts`
- **Verification:** All 4 redaction tests pass.
- **Committed in:** `9ab541a`

**4. [Rule 2 - Missing Critical] env validation not wired to build (INFRA-06)**
- **Found during:** must-have truth verification after Task 3
- **Issue:** `lib/env.ts` is never imported by app code at Plan 01, so `createEnv()` never ran during `next build` — `DATABASE_URL= npm run build` exited 0, violating must-have truth #2 (T-EnvLeak-01). The whole purpose of `env.ts` is to fail the build on missing secrets.
- **Fix:** Added `import './lib/env'` to `next.config.ts` (t3-env recommended wiring), so validation runs at build time.
- **Files modified:** `next.config.ts`
- **Verification:** empty `DATABASE_URL` build → exit 1 (validation error listing missing vars); valid env (via temp `.env`) build → exit 0, clean. Temp `.env` removed after test.
- **Committed in:** `5f1b6cb`

---

**Total deviations:** 4 auto-fixed (1 blocking gitignore, 1 version-compat, 1 test bug, 1 missing-critical).
**Impact on plan:** All necessary for correctness/security and to satisfy the plan's own must-have truths. No scope creep — `next.config.ts` gained only the env-import gate (no extra config like images/headers, per Task 3 constraint).

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| Vitest installed + `vitest run` no crash | PASS — Vitest 4.1.9; 4 passed, 2 todo |
| `DATABASE_URL= npm run build` exits non-zero | PASS — exit 1, "Invalid environment variables" |
| Valid-env build still passes (regression check) | PASS — exit 0, static pages generated |
| pino redacts email/password/telefone/cpf/token/ip/headers → `[redacted]` | PASS — `tests/log-redact.test.ts` 4/4 |
| next.config has `reactCompiler:true` AND `experimental.serverActions.allowedOrigins` | PASS — both present; allowlist nested under `experimental` |
| `tests/setup.ts` + `tests/conftest.ts` exist | PASS |
| redact paths ≥ 25 | PASS — 27 paths |
| no `process.env` outside env.ts (except NODE_ENV) | PASS — only `process.env.NODE_ENV` in log.ts (sanctioned) |

## Known Stubs
- `tests/conftest.ts` fixtures throw until implemented: `createTestUser`/`truncateAll` (Plan 02 — Prisma), `signInAsCustomer`/`signInAsAdmin`/`generateResetToken` (Plan 03 — Better Auth). Intentional — downstream plans wire real impls.
- `tests/setup.ts` `beforeEach` is a documented no-op until Plan 02 (DB reset) / Plan 03 (auth init).
- `tests/serveraction-csrf.test.ts` is `describe.todo` — real CSRF assertions activate in Plan 05 when the first Server Action exists.

## Issues Encountered
- **Windows strips `TZ` from `process.env`:** Node on Windows does not surface an inherited/exported `TZ` env var (libuv quirk) — `export TZ=America/Sao_Paulo` → `process.env.TZ === undefined`, while setting it inside Node or via a `.env` file works. This is a local-dev artifact only; the Linux/Docker deploy sets TZ normally. The pass-case build was verified by loading env from a temporary `.env` file (which dotenv injects programmatically). No code change needed; `TZ: z.literal('America/Sao_Paulo')` in `lib/env.ts` is correct.

## Next Phase Readiness
- Plan 01-02 (Prisma 7) can implement `createTestUser`/`truncateAll` and wire DB reset in `tests/setup.ts`.
- Plan 01-03 (Better Auth) can implement the auth fixtures and turn `serveraction-csrf.test.ts` real (Plan 05).
- Env additions (Prisma already present; future STORAGE_* etc.) go only in `lib/env.ts`.
- No external service configuration required for this plan.

## Self-Check: PASSED
All 10 claimed files exist on disk; all 4 task commits (4160d5d, 9ab541a, e28269b, 5f1b6cb) present in git history.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
