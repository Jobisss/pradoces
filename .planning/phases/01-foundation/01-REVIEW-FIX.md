---
phase: 01-foundation
fixed_at: 2026-06-30T00:00:00Z
review_path: .planning/phase-1-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
suite_status: green
suite_files: 27 passed | 0 failed | 1 skipped (28)
suite_tests: 85 passed | 2 todo (87)
vitest_exit_code: 0
tsc: clean
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-06-30
**Source review:** `.planning/phase-1-foundation/01-REVIEW.md`
**Iteration:** 1
**Scope:** HIGH + MEDIUM only (HI-01, HI-02, ME-01, ME-02, ME-03). Low/Info findings (LO-01..05, IN-01..02) intentionally NOT fixed.

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

**Suite status:** GREEN. `tsc --noEmit` clean. `vitest run` — 27 files passed / 0 failed / 1 skipped (28); 85 tests passed / 2 todo (87); exit code 0. (A jsdom suite-load failure surfaced during verification and was fixed production-side — see "Follow-up fix" below.)

## Fixed Issues

### HI-01: Boundary rate limit bypassable via spoofed `X-Forwarded-For`

**Files modified:** `lib/net/client-ip.ts` (new), `proxy.ts`, `lib/actions/auth.ts`, `tests/net/client-ip.test.ts` (new)
**Commit:** `cffe17d`
**Applied fix:** Added one shared `clientIp(headers)` helper that trusts `CF-Connecting-IP` (set by the Cloudflare edge, not client-forwardable), then the **rightmost** XFF hop (closest trusted proxy), then `'unknown'`. Wired it into both the proxy boundary throttle and the Server-Action `clientContext()`, so a rotating spoofed leftmost XFF can no longer mint a fresh rate-limit bucket per request. Test proves an attacker rotating the leftmost XFF still gets bucketed by `CF-Connecting-IP` and is blocked on the 11th request.

### HI-02: Direct `POST /api/auth/sign-up/email` bypasses the LGPD consent gate

**Files modified:** `app/api/auth/[...all]/route.ts`, `proxy.ts`, `tests/auth/signup-route-block.test.ts` (new)
**Commit:** `7184c75`
**Applied fix:** Chose review option (a) — disabled the public HTTP `sign-up/email` (and bare `sign-up`) route in the Better Auth catch-all (returns 403, creates no row). All account creation now flows exclusively through the `signupCustomer` Server Action, which stamps LGPD-01/LGPD-02 consent. Trusted server-side callers (the Server Action, the `seed-admin` CLI, tests) call `auth.api.signUpEmail` directly and are unaffected — verified by grepping all `signUpEmail` call sites (none use the HTTP route). Also added `/sign-up/email` to the proxy `sensitive` throttle set (account-creation flood). Option (a) was preferred over a `databaseHooks.user.create.before` consent reject because the admin-seed CLI and several existing tests legitimately create users without customer consent fields, so a hard create-hook would have an unacceptable blast radius.

### ME-01: Audit IP/UA hashed with unsalted SHA-256 — reversible

**Files modified:** `lib/env.ts`, `lib/audit/log.ts`, `app/api/me/delete/route.ts`, `.env.example`, `.env.production.example`, `tests/audit/audit-service.test.ts`
**Commit:** `4b6effa`
**Applied fix:** Added a required `AUDIT_HASH_PEPPER` (>=32 chars) env var (t3-env). Replaced the unsalted `sha256` with an exported keyed `hashPii()` HMAC-SHA256 helper, and routed the previously-inlined `/api/me/delete` IP/UA hashing through the same helper. Documented the new var in both `.env` example templates. Updated the audit-service test's exact-hash assertions from SHA-256 to `hashPii`, and added an assertion that the stored hash differs from a bare SHA-256 of the same input. (A local-dev placeholder for `AUDIT_HASH_PEPPER` was added to the gitignored `.env` so the suite/app boot — real secrets are not committed.)

### ME-02: Account-deletion confirmation case-sensitive — blocks legitimate LGPD deletion

**Files modified:** `lib/validation/lgpd.ts`, `tests/lgpd/anonymize.test.ts`
**Commit:** `2377e7a`
**Applied fix:** Added `.toLowerCase()` to `DeleteAccountSchema.confirmacao` so the typed confirmation is normalized the same way stored emails are. The route still compares against the (lowercase) `session.user.email`, so the gate stays tied to the verified owner (anti-IDOR unchanged). Added a test that an auto-capitalized confirmation (`EMAIL.toUpperCase()`) still anonymizes the account.

### ME-03: Boundary rate-limit coverage gaps on directly-reachable auth endpoints

**Files modified:** `proxy.ts`, `lib/auth/server.ts`, `lib/actions/auth.ts`, `tests/proxy-auth-ratelimit.test.ts`, `tests/auth/forgot-email-throttle.test.ts` (new)
**Commit:** `79fd49a`
**Applied fix:** (1) Moved the per-email forgot cap (3/15min) from the `requestPasswordReset` Server Action into the Better Auth `sendResetPassword` chokepoint, so it now applies to BOTH the action AND a direct `POST /api/auth/forget-password` (targeted email-bombing of a known victim). When exhausted the send is skipped (the server-issued token is harmless without the email). The action's own per-email consume was removed to avoid double-counting (it previously also degraded the action's real budget). (2) Added `/reset-password` (POST) and `/verify-email` (GET token link) to the per-IP throttled set in the proxy to blunt reset/verification token brute-force. Tests cover both new proxy paths and the per-email cap via the direct API.

## Skipped Issues

None — all five in-scope findings were fixed.

## Follow-up fix: import-time t3-env reads broke a jsdom suite load

**File modified:** `lib/auth/server.ts`, `lib/email/resend.ts`
**Commit:** `03609dd`

**Symptom:** `vitest run` reported `numFailedTestSuites: 1`, `success: false` (non-zero exit). `tests/admin/admin-login-no-loop.test.tsx` (jsdom) failed to LOAD (0 tests run): `Attempted to access a server-side environment variable on the client`.

**Root cause:** The `'use client'` admin login page imports the `signinAdmin` Server Action. Its module graph (`lib/actions/auth` -> `lib/auth/server` -> `send-verification`/`send-password-reset` -> `lib/email/resend`) reads t3-env **server vars at module load** — `betterAuth({ secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL })` (`lib/auth/server.ts:32-33`) and `new Resend(env.RESEND_API_KEY)` (`lib/email/resend.ts:11`). Under jsdom (`window` defined) `@t3-oss/env` treats a module-load access of a server var as a CLIENT access and throws. vitest has no Next.js server/client boundary strip, so the whole graph evaluates and the suite fails to load. The throw at `resend.ts` was just the first of two; `auth/server.ts` was the deeper culprit.

**Investigation note (correcting an earlier claim in this report):** I initially flagged this as "pre-existing, not my work." It is true that the failure reproduces with ALL my source changes reverted to the base review commit `19ede5c` (verified) — i.e. it was introduced by an earlier gap-closure commit, not by the 5 finding fixes. However, "predates my fixes" does not make a red suite shippable, and the user's success criteria require a green suite, so it is fixed here.

**Fix:** Apply the project's already-sanctioned `process.env` carve-out (documented in `lib/db/client.ts` and `lib/log.ts`) to the two import-time culprits: read `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` and `RESEND_API_KEY` from `process.env` instead of the t3-env proxy. This removes the load-time t3-env access (so the server graph no longer throws when pulled into a jsdom render) without changing runtime behavior — `next.config.ts` still runs `createEnv()` at build/boot, so all vars remain validated. No test was mocked or mutated; the fix is entirely production-side.

**Result:** Full suite green — `27 files passed | 0 failed | 1 skipped (28)`; `85 tests passed | 2 todo (87)`; `vitest` exit code `0`; `tsc --noEmit` clean. (The 1 skipped file is `tests/serveraction-csrf.test.ts`, 2 intentional `todo`s — unrelated.)

---

_Fixed: 2026-06-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
