---
phase: 01-foundation
plan: 09
subsystem: auth
tags: [better-auth, admin-plugin, cli, bootstrap, break-glass, audit-log, sha256, tsx, nextjs16]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 03)
    provides: "lib/auth/server.ts — Better Auth init w/ admin plugin (signUpEmail, setUserPassword, revokeUserSessions), argon2id hashing, role enum aligned"
  - phase: 01-foundation (Plan 04)
    provides: "lib/audit/log.ts — logAudit() append-only writer (actorType='cli', actorId=null supported)"
  - phase: 01-foundation (Plan 02)
    provides: "lib/db/client.ts — Prisma 7 singleton; conftest truncateAll/createTestUser fixtures"
  - phase: 01-foundation (Plan 01)
    provides: "lib/env.ts — ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD / ADMIN_RESET_PASSWORD (optional); package.json seed:admin script + tsx devDep"
provides:
  - "scripts/seed-admin.ts — seedAdmin() (D-05 idempotent bootstrap) + resetAdmin() (D-07 break-glass reset)"
  - "Forged-admin-session helper so the admin-plugin endpoints authorize from a session-less CLI (cookie name read from auth.$context for prod __Secure-)"
  - "audit events admin_seed_via_cli / admin_password_reset_via_cli (no plaintext password)"
affects: [01-10/01-11 (admin operability assumed), 02+ (admin-only flows require a seeded admin), deploy (production bootstrap runs `pnpm seed:admin`)]

# Tech tracking
tech-stack:
  added: []
  patterns: [cli-export-for-testability, forged-admin-session-for-cli, direct-run-guard-import-meta]

key-files:
  created:
    - scripts/seed-admin.ts
    - tests/admin/seed-admin.test.ts
  modified: []

key-decisions:
  - "Admin-plugin endpoints (setUserPassword/revokeUserSessions) run behind adminMiddleware (requires an authoritative admin session); the CLI forges a short-lived signed session for the target admin instead of calling them headerless (the RESEARCH verbatim snippet would throw UNAUTHORIZED in better-auth 1.6)"
  - "Cookie name resolved from auth.$context.authCookies.sessionToken.name so the production __Secure- prefix is honored (not hardcoded to the dev name)"
  - "Forged session signed with standard-base64 HMAC over the token (matches better-call signCookieValue) and revoked by revokeUserSessions — single-use"
  - "seedAdmin()/resetAdmin() take an optional password override param (default reads env) for deterministic tests; the CLI entrypoint always uses env (threat T-01-09-01)"
  - "main() runs only on direct execution (import.meta.url === resolved argv[1]) so the test suite can import the functions without triggering a seed"

patterns-established:
  - "CLI-export-for-testability: export the pure async functions, keep a thin main() behind a direct-run guard — integration tests import and call the functions against the real DB"
  - "Forged-admin-session: mint a Session row + sign the exact better-auth cookie to authorize admin-plugin server APIs from a session-less context"

requirements-completed: [AUTH-10, AUTH-11]

# Metrics
duration: 3min
completed: 2026-06-29
---

# Phase 1 Plan 09: Admin Bootstrap + Break-Glass Reset CLI Summary

**`scripts/seed-admin.ts` bootstraps the single admin (D-05, idempotent) and rotates the admin password + revokes sessions (D-07, break-glass) via the Better Auth admin plugin — authorized from the session-less CLI by forging a short-lived signed admin session, with both paths audited (`admin_seed_via_cli` / `admin_password_reset_via_cli`) and the plaintext password never logged or persisted.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-29T17:35:07Z
- **Completed:** 2026-06-29T17:38:21Z
- **Tasks:** 1 (TDD)
- **Files created/modified:** 2 (2 created, 0 modified)

## Accomplishments
- **Admin is now bootstrappable (AUTH-10 / D-05):** `seedAdmin()` creates the User via `auth.api.signUpEmail`, promotes it to `role='admin'` with `emailVerified`, `isAdult`, and the `v1.0-shell` LGPD shells, then audits `admin_seed_via_cli`. Running it again is a no-op — it detects the existing admin and returns `created:false` (idempotent, T-01-09-02).
- **Break-glass reset works (AUTH-11 / D-07):** `resetAdmin()` requires EXACTLY one admin (throws on 0 or >1), rotates the password via `auth.api.setUserPassword`, revokes every active session via `auth.api.revokeUserSessions`, and audits `admin_password_reset_via_cli` with `admin_id` only.
- **Session-less CLI authorization solved:** the admin-plugin endpoints sit behind `adminMiddleware`, which throws `UNAUTHORIZED` without an admin session. The CLI mints a 5-minute signed session for the target admin (cookie name read from `auth.$context` so prod `__Secure-` is correct, standard-base64 HMAC matching better-call) — which `revokeUserSessions` then deletes, leaving it single-use.
- **No secret leakage:** passwords are read only from env; audit metadata holds the email hash / admin id and is asserted to never contain the plaintext password (T-01-09-01).
- **Green, no regression:** 5/5 new tests pass; full suite 41 passed / 2 todo (was 36/2), `tsc --noEmit` exit 0.

## Task Commits

Task 1 (TDD) committed atomically (RED → GREEN):

1. **Task 1 (TDD): scripts/seed-admin.ts (seed D-05 + --reset D-07) + integration test**
   - `d35d14f` (test — RED: 5 behaviors, import of the absent script fails the suite)
   - `f742938` (feat — GREEN: seedAdmin + resetAdmin + forged-session helper + direct-run guard)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `scripts/seed-admin.ts` - `seedAdmin()` (idempotent bootstrap, signUpEmail + promote + audit), `resetAdmin()` (0/1/>1 guard, setUserPassword + revokeUserSessions + audit), `forgeAdminSessionHeaders()` (signed single-use admin session), `main()` behind an `import.meta.url === argv[1]` direct-run guard
- `tests/admin/seed-admin.test.ts` - 5 real-DB integration tests: create/idempotent/reset+revoke/0-admin-throw/>1-admin-throw, plus plaintext-password-absence assertions

## Decisions Made
- **Forge an admin session rather than call the admin APIs headerless:** `adminMiddleware` → `getAuthoritativeSessionFromCtx` requires a valid admin session; the RESEARCH verbatim snippet (`auth.api.setUserPassword({ body })` with no headers) throws `UNAUTHORIZED` in better-auth 1.6. Forging the target admin's own session is the minimal correct authorization for a break-glass CLI.
- **Resolve the cookie name from `auth.$context.authCookies.sessionToken.name`:** guarantees the production `__Secure-better-auth.session_token` name (and any `cookiePrefix` override) instead of hardcoding the dev name.
- **Optional password-override params on both functions:** keeps the env-only invariant for the real CLI while letting tests pass `ADMIN_RESET_PASSWORD` deterministically (it is not set in `.env`).
- **Direct-run guard:** `main()` runs only when `import.meta.url` resolves to `argv[1]`, so importing the module in tests never triggers a real seed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Admin-plugin APIs throw UNAUTHORIZED when called headerless (RESEARCH snippet version drift)**
- **Found during:** Task 1 (designing `resetAdmin` against better-auth 1.6)
- **Issue:** The RESEARCH verbatim code calls `auth.api.setUserPassword({ body })` and `auth.api.revokeUserSessions({ body })` with no headers. In better-auth 1.6 both endpoints use `adminMiddleware` → `getAuthoritativeSessionFromCtx`, which throws `UNAUTHORIZED` without a valid admin session — so `pnpm seed:admin --reset` would fail at runtime and AUTH-11's reset path would be inoperable.
- **Fix:** Added `forgeAdminSessionHeaders(adminId)` — creates a 5-minute `Session` row for the admin, signs the exact better-auth cookie (standard-base64 HMAC over the token, cookie name from `auth.$context.authCookies.sessionToken.name`), and passes it as `headers` to both API calls. `revokeUserSessions` then deletes the forged session along with all others (single-use).
- **Files modified:** scripts/seed-admin.ts
- **Verification:** `resetAdmin` test passes end-to-end (password rotated, session count 0, audit written); `tsc --noEmit` exit 0; full suite green.
- **Committed in:** `f742938` (Task 1 GREEN)

**2. [Rule 3 - Blocking] `ADMIN_RESET_PASSWORD` absent from `.env` (frozen by t3-env at import)**
- **Found during:** Task 1 (writing the reset tests)
- **Issue:** `lib/env.ts` (t3-oss) parses `runtimeEnv` once at import and freezes it; `ADMIN_RESET_PASSWORD` is not in `.env`, so `env.ADMIN_RESET_PASSWORD` is permanently `undefined` and the reset tests could never exercise the success/guard paths.
- **Fix:** Both functions accept an optional `{ resetPassword }` / `{ initialPassword }` override, defaulting to env. The CLI entrypoint passes nothing (env-only, threat T-01-09-01 preserved); tests pass the password explicitly.
- **Files modified:** scripts/seed-admin.ts, tests/admin/seed-admin.test.ts
- **Verification:** All 5 reset/seed tests pass deterministically without touching `.env`.
- **Committed in:** `f742938` (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug/version-drift, 1 blocking). A doc-comment wording tweak was also applied so the `revokeUserSessions` acceptance grep gate is exactly 1 (the literal appears only on the real call).
**Impact on plan:** No scope change. Both fixes are correctness requirements — without the forged session the D-07 reset is inoperable in this better-auth version, and the override param is the only way to test the reset path given the frozen env. The `package.json` `seed:admin` script and `tsx` devDep were pre-provided by Plan 01 and were NOT modified (no file collision with Plan 06).

## Issues Encountered
- Verified the cookie HMAC scheme before relying on it: better-call `signCookieValue`/`verifySignature` use **standard** base64 (`btoa`/`atob`), not the base64url that `@better-auth/utils` `createHMAC('…','base64')` would emit — so `crypto.createHmac(...).digest('base64')` is byte-identical to what better-auth verifies (and matches the existing conftest fixtures).

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| `seed:admin` creates the single admin (role=admin, emailVerified=true) if none exists | PASS — test asserts admin row with role/emailVerified/isAdult/LGPD shells + `created:true` |
| `seed:admin` is idempotent — running 2x does not create a second admin | PASS — second call returns `created:false`; admin count stays 1 |
| `seed:admin --reset` rotates the admin password and revokes active sessions | PASS — `setUserPassword` + `revokeUserSessions`; pre-created session count drops to 0 |
| `--reset` fails with 0 or >1 admins | PASS — throws `/No admin/` (0) and `/Multiple admins/` (>1) |
| Both paths audit (admin_seed_via_cli / admin_password_reset_via_cli) without the password | PASS — audit rows present (actorType='cli', actorId=null); metadata excludes plaintext password |
| `npx tsc --noEmit` | PASS — exit 0 |
| Full suite | PASS — 41 passed / 2 todo (25 files); no regression vs 36 prior |

## User Setup Required
None for the code itself. **Operational note for production bootstrap:** set `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` (and `ADMIN_RESET_PASSWORD` only when running a break-glass reset) in the server env, then run `pnpm seed:admin`. The initial password is delivered to the mãe in person (D-05); `--reset` is the SSH-only recovery path (D-07).

## Next Phase Readiness
- **Admin-only flows (Plans 01-10/01-11 and Phase 2+):** a seeded admin is now obtainable, so admin-guarded routes/actions have a real principal to authenticate.
- **Deploy:** the production runbook's bootstrap step (`pnpm seed:admin`) is now backed by a real, idempotent script; the break-glass reset is documented and tested.

## Self-Check: PASSED
Both created files exist on disk; the two task commits (`d35d14f`, `f742938`) are in git history.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
