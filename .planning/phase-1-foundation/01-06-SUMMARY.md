---
phase: 01-foundation
plan: 06
subsystem: infra
tags: [pg-boss, instrumentation, rate-limiter-flexible, rate-limit, nextjs16, proxy, queue, dos-mitigation]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 01)
    provides: "lib/env.ts (env.DATABASE_URL validated)"
  - phase: 01-foundation (Plan 02)
    provides: "Prisma 7 client connected via driver adapter (boot order: public.* before pgboss.*)"
  - phase: 01-foundation (Plan 03)
    provides: "proxy.ts (Node runtime, nonce/CSP + cookie-presence guard) + app/api/auth/[...all]/route.ts (Better Auth catch-all)"
provides:
  - "lib/queue/boss.ts — PgBoss singleton on dedicated 'pgboss' schema (INFRA-11)"
  - "instrumentation.ts — register() boots pg-boss once on the Node runtime"
  - "lib/ratelimit/memory.ts — rateLimitAuth (10/60s IP) + rateLimitForgotEmail (3/15min email)"
  - "proxy.ts rate-limit wiring — POST /api/auth/{sign-in/email,forget-password} throttled at the edge (429)"
affects: [01-08 (Server Actions consume the same in-process limiters as defense in depth), 04 (pg-boss boss.work workers + async email jobs)]

# Tech tracking
tech-stack:
  added: ["pg-boss@12.18.1", "rate-limiter-flexible@11.0.1"]
  patterns: [pg-boss-singleton-dedicated-schema, instrumentation-nextruntime-guard, in-memory-rate-limiter, proxy-boundary-throttle]

key-files:
  created:
    - lib/queue/boss.ts
    - instrumentation.ts
    - lib/ratelimit/memory.ts
    - tests/ratelimit.test.ts
    - tests/instrumentation.test.ts
    - tests/proxy-auth-ratelimit.test.ts
  modified:
    - proxy.ts
    - package.json

key-decisions:
  - "pg-boss runs on a dedicated 'pgboss' schema so its auto-created tables never pollute public and Prisma migrations ignore them"
  - "instrumentation.register() guards on NEXT_RUNTIME==='nodejs' — pg-boss needs a real Postgres pool and cannot run on Edge"
  - "Rate limit enforced at the proxy boundary (not only in Server Actions) because the Better Auth catch-all is directly reachable and would otherwise be a brute-force bypass"
  - "In-memory RateLimiterMemory (rate-limiter-flexible) over @upstash/ratelimit — Upstash has no memory mode (needs Redis); per-process reset accepted for v1 single-VPS"

patterns-established:
  - "pg-boss singleton: globalForBoss cache + new PgBoss({ connectionString, schema:'pgboss' }); Phase 4 registers boss.work(...) in instrumentation.ts"
  - "Boundary throttle: proxy.ts derives client IP from x-forwarded-for, calls rateLimitAuth.consume(ip) in try/catch, returns 429 JSON with pt-BR copy on reject — same limiter is shared in-process with Server Actions (defense in depth)"

requirements-completed: [INFRA-11, INFRA-04]

# Metrics
duration: 9min
completed: 2026-06-29
---

# Phase 1 Plan 06: pg-boss Boot Harness + Rate Limit Boundary Summary

**pg-boss boots once via instrumentation.ts on a dedicated `pgboss` schema (INFRA-11), and the Better Auth catch-all is now throttled at the proxy boundary — the 11th sensitive POST per IP gets a 429 instead of an unlimited brute-force window (INFRA-04 / SC4).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-29T17:14:12Z
- **Completed:** 2026-06-29T17:23:22Z
- **Tasks:** 3 (all TDD)
- **Files created/modified:** 8 (6 created, 2 modified)

## Accomplishments
- **Job harness lives (INFRA-11):** `lib/queue/boss.ts` is a `PgBoss` singleton bound to the dedicated `pgboss` schema, and `instrumentation.ts` `register()` calls `boss.start()` exactly once — but only when `NEXT_RUNTIME === 'nodejs'`, so the Edge runtime is a no-op. Zero domain workers in Phase 1 (proves it boots; Phase 4 adds `boss.work(...)`).
- **Auth boundary is no longer a bypass (INFRA-04 / SC4):** `proxy.ts` now consumes `rateLimitAuth.consume(ip)` for POSTs to `/api/auth/sign-in/email` and `/api/auth/forget-password`. The 11th request from the same IP in 60s returns a 429 JSON (`Muitas tentativas seguidas…`) before reaching the directly-reachable catch-all handler. GET and non-sensitive POSTs (sign-out, get-session) are untouched, IPs are isolated, and the existing nonce/CSP/cookie-guard is preserved.
- **In-memory limiters shipped:** `lib/ratelimit/memory.ts` exports `rateLimitAuth` (10/60s per IP) and `rateLimitForgotEmail` (3/15min per email) via `RateLimiterMemory` — Upstash was overridden (no memory mode). Same instances are shared in-process with the Plan 08 Server Actions for defense in depth.
- **Full suite green, no regression:** 36 passed / 2 todo across 21 files (up from 30); `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 (TDD): rate-limiter-flexible + lib/ratelimit/memory.ts**
   - `056971f` (test — RED: 11th/4th consume blocked, keys isolated)
   - `43739e8` (feat — GREEN: rateLimitAuth + rateLimitForgotEmail)
2. **Task 2 (TDD): lib/queue/boss.ts + instrumentation.ts**
   - `1f8641b` (test — RED: start once on nodejs, no-op on edge/unset)
   - `dad809a` (feat — GREEN: pg-boss singleton + register() boot hook)
3. **Task 3 (TDD): wire rateLimitAuth into proxy.ts boundary**
   - `fed1374` (test — RED: 11th sensitive POST → 429)
   - `d44439c` (feat — GREEN: proxy throttle + pg-boss@12 named-import fix)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `lib/queue/boss.ts` - `PgBoss` singleton on `schema:'pgboss'`, `connectionString: env.DATABASE_URL`; global cache outside production
- `instrumentation.ts` - root `register()`: returns early unless `NEXT_RUNTIME==='nodejs'`, then dynamic-imports boss and `await boss.start()`
- `lib/ratelimit/memory.ts` - `rateLimitAuth` (10/60s, block 60s) + `rateLimitForgotEmail` (3/15min, block 15min) via `RateLimiterMemory`
- `proxy.ts` - added import of `rateLimitAuth` + a pre-guard block that throttles POST sign-in/email & forget-password (429 JSON) before the existing CSP/cookie logic
- `tests/ratelimit.test.ts` - 11th/4th consume blocked, distinct keys isolated (3 tests)
- `tests/instrumentation.test.ts` - start once on nodejs, no-op on edge/unset (3 tests, boss mocked)
- `tests/proxy-auth-ratelimit.test.ts` - 11th POST → 429 + copy, GET/non-sensitive untouched, IPs isolated, non-auth routes keep CSP (6 tests)
- `package.json` - +pg-boss@12.18.1, +rate-limiter-flexible@11.0.1

## Decisions Made
- **Dedicated `pgboss` schema:** keeps pg-boss's auto-created tables (job/archive/schedule/subscription) out of `public` so Prisma migrations ignore them — no manual migration, clean separation.
- **`NEXT_RUNTIME==='nodejs'` guard:** Next calls `register()` in every runtime; pg-boss needs a real Postgres pool, so the Edge runtime must early-return (idempotent `boss.start()` per T-01-06-02).
- **Throttle at the proxy boundary, not only Server Actions:** the Better Auth catch-all (`app/api/auth/[...all]/route.ts`) is directly reachable; limiting only inside Server Actions left a brute-force bypass (T-01-06-01). The proxy runs the Node runtime, so the in-process `RateLimiterMemory` is shared with Plan 08's Server Actions as defense in depth.
- **`RateLimiterMemory` over `@upstash/ratelimit`:** Upstash has no memory mode (requires Redis); per-process reset on restart is accepted for v1 single-VPS (T-01-06-03), migratable to `RateLimiterPostgres` later without Redis.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pg-boss@12 has no default export**
- **Found during:** Task 3 (`tsc --noEmit` after wiring the proxy)
- **Issue:** RESEARCH's verbatim `import PgBoss from 'pg-boss'` targeted an older major; pg-boss@12.18.1 exports the class as a **named** export, so `tsc` raised `TS2613: Module '…/pg-boss' has no default export`.
- **Fix:** Changed `lib/queue/boss.ts` to `import { PgBoss } from 'pg-boss'` (with a comment noting the major-version change). Runtime behavior unchanged; the instrumentation test (which mocks the module) and the real construction both still work.
- **Files modified:** lib/queue/boss.ts
- **Verification:** `tsc --noEmit` exit 0; full suite 36 passed / 2 todo, no regression.
- **Committed in:** `d44439c` (Task 3 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** None on scope — a version-correctness import fix the planner's verbatim snippet predated. All three artifacts and the boundary throttle ship exactly as specified.

## Issues Encountered
- None beyond the pg-boss import correction above. Postgres (`doces-pg`) was already up, so the global `afterEach` truncate harness ran cleanly for the new test files.

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| instrumentation.register() initializes pg-boss (boss.start()) once on the Node boot | PASS — `instrumentation.test.ts`: start called once on `NEXT_RUNTIME='nodejs'`, never on edge/unset |
| The 11th request in 60s on the auth limiter is blocked | PASS — `ratelimit.test.ts`: 10 resolve, 11th rejects (BLOCKED) |
| The 4th reset request in 15min for the same email is blocked | PASS — `ratelimit.test.ts`: forgot-email 4th rejects |
| The 11th direct POST to /api/auth/sign-in/email (same IP, <60s) gets 429 at the proxy | PASS — `proxy-auth-ratelimit.test.ts`: 11th → 429 with pt-BR copy; catch-all no longer bypass |
| pg-boss uses dedicated 'pgboss' schema (not public) | PASS — `boss.ts` constructs with `schema: 'pgboss'` (grep gate == 1) |
| CSP + cookie-guard preserved in proxy.ts | PASS — Content-Security-Policy still set; cookie-guard untouched; non-auth route test asserts CSP present |
| `@upstash/ratelimit` not used (override respected) | PASS — grep count 0 in package.json |
| `tsc --noEmit` | PASS — exit 0 (after pg-boss named-import fix) |
| Full suite | PASS — 36 passed / 2 todo (21 files); no regression vs 30 prior |

## User Setup Required
None - no external service configuration required. pg-boss creates its `pgboss.*` tables automatically on first `boss.start()` against the existing `DATABASE_URL`. In production the boot order (Prisma `migrate deploy` → `boss.start()`) is enforced by docker-compose `depends_on: service_healthy` (Plan 05).

## Next Phase Readiness
- **Plan 08 (auth Server Actions):** can import `rateLimitAuth` + `rateLimitForgotEmail` from `lib/ratelimit/memory` and `.consume()` them as defense in depth — the same in-process instances the proxy uses.
- **Phase 4 (background jobs):** `instrumentation.ts` is the registration point — add `boss.work('send-email', handler)` etc. there; the singleton and `pgboss` schema are already live. The fire-and-forget email callbacks from Plan 04 can move onto pg-boss for retries/observability.

## Self-Check: PASSED
All 6 created files + 2 modified files exist on disk; the 6 task commits (056971f, 43739e8, 1f8641b, dad809a, fed1374, d44439c) are in git history.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
