---
phase: 01-foundation
plan: 04
subsystem: auth
tags: [resend, react-email, svix, webhook, audit-log, better-auth, email-verification, sha256, nextjs16]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 03)
    provides: "lib/auth/server.ts (Better Auth init w/ NOOP email callbacks), requireEmailVerification + revokeSessionsOnPasswordReset + resetPasswordTokenExpiresIn 1h, real auth test fixtures (createTestUser/truncateAll/signInAsCustomer)"
  - phase: 01-foundation (Plan 02)
    provides: "AuditLog model (actorId @db.Uuid nullable, ipHash/uaHash), Prisma 7 singleton, vitest .env loader + afterEach truncate"
  - phase: 01-foundation (Plan 01)
    provides: "lib/env.ts (RESEND_API_KEY/RESEND_WEBHOOK_SECRET validated), lib/log.ts (pino + PII redaction incl. svix-signature/ip/user-agent)"
provides:
  - "lib/email/resend.ts — Resend SDK singleton"
  - "lib/email/send-verification.tsx — VerifyEmail React Email template + sendVerificationEmail() (copy pt-BR, 24h)"
  - "lib/email/send-password-reset.tsx — ResetPasswordEmail template + sendPasswordResetEmail() (copy pt-BR, 1h)"
  - "lib/audit/log.ts — logAudit() append-only writer that hashes raw IP/UA to sha256 (never plaintext)"
  - "app/api/webhooks/resend/route.ts — svix-verified webhook receiver (400 on bad signature, 200 on valid)"
  - "lib/auth/server.ts rewired — real Resend delivery on verification/reset, emailVerification.expiresIn 24h, onPasswordReset audit"
affects: [01-05 (auth UI forms call signup→verification email), 01-06 (admin_login audit via logAudit), 01-07 (LGPD anonymize uses logAudit customer_account_deleted), 04 (pg-boss async email + email_events table from webhook)]

# Tech tracking
tech-stack:
  added: ["resend@6.12.2", "@react-email/components@1.0.12", "@react-email/render@2.0.8", "svix@1.92.2"]
  patterns: [resend-singleton, react-email-template-skeleton, audit-write-wrapper-absorbs-hashing, svix-verify-raw-body, fire-and-forget-email-callback]

key-files:
  created:
    - lib/email/resend.ts
    - lib/email/send-verification.tsx
    - lib/email/send-password-reset.tsx
    - lib/audit/log.ts
    - app/api/webhooks/resend/route.ts
    - tests/audit/audit-service.test.ts
    - tests/webhooks/resend-svix.test.ts
    - tests/auth/email-verify.test.ts
  modified:
    - lib/auth/server.ts
    - package.json

key-decisions:
  - "logAudit absorbs IP/UA hashing: call sites pass rawIp/rawUa, helper sha256-hashes them — plaintext IP/UA can never reach audit_log (T-01-04-02 / Pitfall #9)"
  - "Email callbacks are fire-and-forget (void sendXxx) so the Server Action never blocks on the Resend round-trip (T-01-04-04); Phase 4 moves to pg-boss"
  - "emailVerification.expiresIn set to 60*60*24 — the email copy promises 24h; Better Auth default is 1h (AUTH-04 consistency)"
  - "Webhook test mocks @/lib/env with the canonical svix sample secret for a hermetic signed round-trip, because the local RESEND_WEBHOOK_SECRET placeholder is not valid base64 for svix's strict decoder"

patterns-established:
  - "React Email template skeleton: <Html><Body><Container> + render() (async) + resend.emails.send({ from real domain, to, subject, html }) — Phase 4 reservation/points emails follow this"
  - "Audit-write wrapper: logAudit({ actorType, actorId, action, ...hash-on-write }) is the single entry point for audit_log; actions are free strings (no migration to add new ones)"
  - "svix-verified webhook: read request.text() RAW first, build svix-id/timestamp/signature headers, new Webhook(secret).verify, 400 before any processing on failure"

requirements-completed: [AUTH-04, AUTH-05, AUTH-11]

# Metrics
duration: 10min
completed: 2026-06-29
---

# Phase 1 Plan 04: Email Delivery + Audit Log Foundation Summary

**Real Resend + React Email delivery replaces the Plan 03 NOOPs (verification email with a backend-enforced 24h window, password-reset email), plus the `logAudit` write-wrapper that sha256-hashes IP/UA and a svix-verified Resend webhook that rejects forged payloads.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-29T16:52:52Z
- **Completed:** 2026-06-29T17:02:54Z
- **Tasks:** 3 (Tasks 2 & 3 TDD)
- **Files created/modified:** 10 (8 created, 2 modified)

## Accomplishments
- **Email delivery is real:** `lib/email/resend.ts` singleton + two React Email templates (`send-verification.tsx`, `send-password-reset.tsx`) with literal pt-BR copy and the real `nao-responda@docesvalentina.com.br` from-address. The verification copy's "24 horas" promise is now backend-true via `emailVerification.expiresIn = 60*60*24` (was Better Auth's 1h default).
- **Audit foundation:** `logAudit()` persists append-only rows and absorbs IP/UA hashing — raw values are sha256-hashed on write and never stored plaintext (proved: `ipHash`/`uaHash` are 64-char hex ≠ input). `actorId:null` works for CLI/system events.
- **Webhook hardened:** `app/api/webhooks/resend/route.ts` verifies the svix signature over the RAW body and returns 400 before any processing on a missing/forged signature, 200 `{ ok:true }` on a valid one (T-01-04-01, block-on:high).
- **Better Auth rewired:** verification + reset callbacks now deliver via Resend (fire-and-forget so the Server Action never blocks), `onPasswordReset` writes a `customer_password_reset` audit event (AUTH-11), and the NOOP logs are gone.
- **Full suite green, no regression:** 24 passed / 2 todo across 8 files (up from 16 prior tests); `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD tasks: test → feat):

1. **Task 1: Email deps + lib/email (resend client + 2 templates)** - `b0a6d47` (feat)
2. **Task 2 (TDD): logAudit + svix webhook**
   - `7d1098b` (test — RED: audit hashing + webhook signature)
   - `9016b34` (feat — GREEN: logAudit + webhook receiver)
3. **Task 3 (TDD): rewire lib/auth/server.ts + email-verify test**
   - `4849a88` (test — RED: real send + 24h window)
   - `b5ee509` (feat — GREEN: callbacks wired, expiresIn 24h, reset audit)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `lib/email/resend.ts` - Resend SDK singleton (`new Resend(env.RESEND_API_KEY)`)
- `lib/email/send-verification.tsx` - VerifyEmail template + `sendVerificationEmail({ to, url })`, copy "Confirma seu email…", 24h footer
- `lib/email/send-password-reset.tsx` - ResetPasswordEmail template + `sendPasswordResetEmail({ to, url })`, copy "Pediu pra trocar a senha?", 1h footer
- `lib/audit/log.ts` - `logAudit()` append-only writer; sha256-hashes rawIp/rawUa; actorId nullable for cli/system
- `app/api/webhooks/resend/route.ts` - POST: raw body + svix verify, 400 invalid / 200 ok, logs event_type+email_id only
- `lib/auth/server.ts` - callbacks rewired to real Resend send (void), `emailVerification.expiresIn = 60*60*24`, `onPasswordReset` → `logAudit`; dropped unused logger import
- `tests/audit/audit-service.test.ts` - hashing, null actor, pre-hashed passthrough (3 tests)
- `tests/webhooks/resend-svix.test.ts` - missing/forged → 400, valid → 200 (3 tests)
- `tests/auth/email-verify.test.ts` - signup fires send once + expiresIn 24h (2 tests)
- `package.json` - +resend, +@react-email/components, +@react-email/render, +svix

## Decisions Made
- **logAudit absorbs hashing** (call sites pass raw IP/UA): single place enforces the never-plaintext invariant (Pitfall #9) instead of trusting every call site to hash.
- **Fire-and-forget email callbacks** (`void sendXxx`): keeps signup/reset Server Actions fast (T-01-04-04); Phase 4 promotes to pg-boss for retries/observability.
- **emailVerification.expiresIn = 24h**: aligns the backend token lifetime with the email copy's "24 horas" promise (default was 1h) — AUTH-04 consistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Webhook round-trip test needed a valid svix secret**
- **Found during:** Task 2 (GREEN run of the signed-payload webhook test)
- **Issue:** The local/CI `RESEND_WEBHOOK_SECRET` is a placeholder whose base64 body svix's strict decoder rejects (`Base64Coder: incorrect characters`), so `new Webhook(secret)` threw and the valid-signature case could never be exercised.
- **Fix:** The webhook test mocks `@/lib/env` (via `vi.hoisted` + `vi.mock`) with the canonical svix sample secret `whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw`; both the route and the test signer share it, making the round-trip hermetic and independent of the real Resend secret.
- **Files modified:** tests/webhooks/resend-svix.test.ts
- **Verification:** 3/3 webhook tests pass; the route's production path is unchanged (still reads `env.RESEND_WEBHOOK_SECRET`).
- **Committed in:** `9016b34` (Task 2 GREEN)

**2. [Rule 1 - Bug] `user.role` not on the onPasswordReset callback's base user type**
- **Found during:** Task 3 (tsc after rewiring `onPasswordReset`)
- **Issue:** `TS2339: Property 'role' does not exist` — Better Auth's `onPasswordReset` user type omits `additionalFields` (role), though `role` is present at runtime.
- **Fix:** Narrowed via `const role = (user as { role?: string }).role` before the `actorType` branch; behavior matches the plan (admin → 'admin', else 'customer').
- **Files modified:** lib/auth/server.ts
- **Verification:** `tsc --noEmit` exit 0; full suite green.
- **Committed in:** `b5ee509` (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). Both were test/type-correctness fixes; no production behavior or scope changed.
**Impact on plan:** None on scope — the webhook mock makes the high-severity signature test runnable in any environment, and the role narrowing preserves the exact audit behavior the plan specified.

## TDD Gate Compliance
Both TDD tasks followed RED → GREEN with explicit gate commits:
- Task 2: `7d1098b` (test, RED) → `9016b34` (feat, GREEN)
- Task 3: `4849a88` (test, RED) → `b5ee509` (feat, GREEN)
No REFACTOR commits were needed (implementations were minimal and clean).

## Issues Encountered
- `vi.mock` hoisting: referencing a top-level `const` inside the mock factory threw `Cannot access … before initialization`. Resolved by defining the secret via `vi.hoisted(() => ({ … }))` so it exists before the hoisted `vi.mock` runs.

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| Cadastro dispara email de verificação real via Resend (não NOOP) | PASS — `email-verify.test.ts`: signup invokes `sendVerificationEmail({ to: email, url })` once |
| Pedido de reset dispara email de reset real via Resend | PASS — `sendResetPassword` callback calls `sendPasswordResetEmail` (NOOP removed; tsc + suite green) |
| Link de verificação expira em 24h (emailVerification.expiresIn = 86400) | PASS — `auth.options.emailVerification.expiresIn === 60*60*24` asserted |
| Webhook rejeita payload sem assinatura svix válida (400) | PASS — missing headers → 400 "invalid signature"; forged → 400 |
| Webhook aceita assinatura svix válida (200) | PASS — signed round-trip → 200 `{ ok: true }` |
| Reset grava customer_password_reset em audit_log | PASS — `onPasswordReset` → `logAudit` (wired; action string present, type-checked) |
| logAudit persiste com IP/UA hasheados (nunca plaintext) | PASS — `audit-service.test.ts`: ipHash/uaHash are 64-hex sha256 ≠ input |
| `tsc --noEmit` | PASS — exit 0 |
| Suíte completa | PASS — 24 passed / 2 todo (8 files); no regression vs 16 prior |

## User Setup Required
**External service (Resend) requires manual configuration for real delivery** (see plan `user_setup`). Code is wired and tested, but live email needs:
- `RESEND_API_KEY` (`re_…`) and `RESEND_WEBHOOK_SECRET` (`whsec_…`) in `.env` — already validated by `lib/env.ts` (present locally).
- Resend Dashboard → Domains: verify `docesvalentina.com.br` (SPF/DKIM/DMARC) for the `nao-responda@` from-address.
- Resend Dashboard → Webhooks: create endpoint `https://docesvalentina.com.br/api/webhooks/resend` with the signing secret matching `RESEND_WEBHOOK_SECRET`.

## Next Phase Readiness
- **Plan 05 (auth UI + Server Actions):** signup now triggers a real verification email; forms can rely on the end-to-end flow. `logAudit` is available for `customer_signup`/`customer_email_verified`.
- **Plan 06 (admin login audit):** `logAudit({ actorType:'admin', action:'admin_login' })` ready.
- **Plan 07 (LGPD):** `logAudit({ action:'customer_account_deleted' })` ready for the anonymize flow.
- **Phase 4:** move `void sendXxx` email callbacks onto pg-boss; populate the webhook handler with an `email_events` table and bounce handling (skeleton already verifies signatures).

## Self-Check: PASSED
All 8 created source/test files + the 2 modified files exist on disk; the 5 task commits (b0a6d47, 7d1098b, 9016b34, 4849a88, b5ee509) are in git history.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
