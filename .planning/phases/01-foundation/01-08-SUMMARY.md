---
phase: 01-foundation
plan: 08
subsystem: auth
tags: [server-actions, zod, better-auth, anti-enumeration, rate-limit, lgpd, audit, email-first, nextjs16, rsc]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 03/04)
    provides: "lib/auth/server.ts (auth.api signUpEmail/signInEmail/requestPasswordReset/resetPassword/verifyEmail; requireEmailVerification; expiresIn 24h)"
  - phase: 01-foundation (Plan 04)
    provides: "lib/audit/log.ts (logAudit hashes IP/UA); send-verification/send-password-reset templates"
  - phase: 01-foundation (Plan 06)
    provides: "lib/ratelimit/memory.ts (rateLimitAuth 10/60s + rateLimitForgotEmail 3/15min) — same in-process instances reused here as defense in depth"
  - phase: 01-foundation (Plan 07)
    provides: "app/(public)/ route-group shell (Header/Footer, D-03) + shadcn button/input/label/checkbox"
provides:
  - "lib/validation/auth.ts — Signup/Signin/Forgot/Reset Zod schemas with literal UI-SPEC error copy; +18/terms as ===true hard block"
  - "lib/actions/auth.ts — 6 real Server Actions: signupCustomer, checkEmailExists, signinUser, signinAdmin, requestPasswordReset, resetPassword"
  - "app/(public)/cadastro/page.tsx — email-first 2-step cadastro + AUTH-03 branch + LGPD checkboxes"
  - "app/(public)/cadastro/verifique-seu-email/page.tsx — generic post-signup landing"
  - "app/(public)/auth/confirmar-email/[token]/page.tsx — RSC verifyEmail + customer_email_verified audit"
affects: [01-10 (admin login UI reuses signinAdmin + the shared INVALID_CREDENTIALS literal; esqueci/redefinir pages call requestPasswordReset/resetPassword), 01-11 (LGPD surfaces under (public)), 04 (reservas Server Actions inherit the 7-step skeleton)]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-action-7-step-skeleton, anti-enumeration-generic-copy, rate-limit-defense-in-depth-in-action, email-first-checkExists-then-signup, checkbox-on-to-boolean-zod-hardblock, rsc-verify-token-with-token-claim-audit]

key-files:
  created:
    - lib/validation/auth.ts
    - lib/actions/auth.ts
    - "app/(public)/cadastro/page.tsx"
    - "app/(public)/cadastro/verifique-seu-email/page.tsx"
    - "app/(public)/auth/confirmar-email/[token]/page.tsx"
    - tests/auth/signup.test.ts
    - tests/auth/email-first.test.ts
    - tests/auth/anti-enum.test.ts
    - tests/auth/signin.test.ts
    - tests/lgpd/consent.test.ts
    - tests/audit/admin-login.test.ts
  modified: []

key-decisions:
  - "Auth pages live under app/(public)/ (not bare app/cadastro) to inherit the Header/Footer shell (D-03) — same route-group pattern Plan 07 established; URLs are unchanged"
  - "Better Auth v1.6 forgot-password endpoint is auth.api.requestPasswordReset({ body: { email, redirectTo } }) — NOT forgetPassword as the plan's interface note said (caught by tsc)"
  - "LGPD +18/terms validated via z.boolean().refine(v===true) (not z.literal) so an unchecked box is a HARD BLOCK before any user is created (LGPD-01/02), and the action maps checkbox 'on'/absent -> real boolean"
  - "Rate-limit consume kept in every mutating action as defense in depth (primary limit is the proxy boundary / Plan 06) — the same RateLimiterMemory instances are shared in-process"
  - "Email-confirm landing derives the audit actorId from the token's JWT `email` claim (verifyEmail returns only { status }); falls back to actorId:null without ever breaking confirmation"
  - "signinAdmin only audits + redirects for an actual role=admin user; a valid non-admin login returns the generic INVALID_CREDENTIALS (anti-enum, no admin-existence leak)"

patterns-established:
  - "Server Action 7-step skeleton (PATTERNS §2.18): async headers -> rate-limit consume (defense in depth) -> Zod parse -> Better Auth in try/catch with generic anti-enum error -> side effects (LGPD stamp / audit) -> redirect. Phase 4 reservas/pontos actions inherit it"
  - "Anti-enumeration: shared literal copy ('Email ou senha não conferem' for login; fixed generic confirmation for reset) identical regardless of email existence (AUTH-07)"
  - "Testable Server Actions: tests mock next/headers (headers + cookies) and next/navigation (redirect) so actions run in the node test runtime; client context IP is per-test mutable for the rate-limit assertion"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, LGPD-01, LGPD-02]
requirements-reinforced: [AUTH-04, AUTH-07, AUTH-08, AUTH-10, AUTH-11, INFRA-04]

# Metrics
duration: 33min active (wall-clock spanned a blocking human-verify checkpoint)
completed: 2026-06-30
---

# Phase 1 Plan 08: Auth Server Actions + Cadastro Inteligente Summary

**The functional backbone of customer + admin auth: six real Server Actions (Zod + Better Auth + rate-limit defense in depth + anti-enumeration + LGPD consent + audit) wired to an email-first cadastro that branches on AUTH-03 ("talvez digitou errado"), plus the email-confirmation landing — turning the API-only auth from Plans 03/04 into a flow a customer can actually use.**

## Performance

- **Duration:** ~33 min active execution; wall-clock inflated by the blocking human-verify checkpoint (Resend not yet configured, so confirmation was verified via a locally-minted token + tests + DB).
- **Started:** 2026-06-29T19:34Z
- **Completed:** 2026-06-30
- **Tasks:** 2 functional (Task 1 TDD: RED→GREEN; Task 2) + 1 checkpoint human-verify (approved: "cadastro está ok, pode continuar")
- **Files created:** 11 (2 lib, 3 pages, 6 tests)

## Accomplishments
- **6 real Server Actions (`lib/actions/auth.ts`, 7-step skeleton):** `signupCustomer` (creates User+credential Account, stamps telefone + versioned LGPD consent, audits `customer_signup`, redirects to verify page), `checkEmailExists` (email-first probe; anonymized/`deletedAt` accounts read as non-existent for re-registration — the one intentional AUTH-03 enumeration surface), `signinUser` (generic credential error), `signinAdmin` (admin-only, audits `admin_login` with hashed IP, D-08), `requestPasswordReset` (always-generic anti-enum confirmation, per-email flood limit), `resetPassword`. No stubs — all six call real Better Auth APIs through the argon2id-backed hash callbacks.
- **Zod schemas (`lib/validation/auth.ts`):** Signup/Signin/Forgot/Reset with literal UI-SPEC error copy; `isAdult`/`termsAccepted` validated as `=== true` so an unchecked box hard-blocks signup before any row is written (LGPD-01/02).
- **Email-first cadastro UI (`app/(public)/cadastro/page.tsx`):** step 1 (email → `checkEmailExists`) → AUTH-03 branch ("Esse email já tem conta. Talvez você tenha digitado errado…" + "Tentar fazer login" / "Não, é outro email") OR step 2 (senha/nome/telefone + +18 + termos checkboxes with inline /termos /privacidade links). Sticky CTA on mobile, `aria-describedby` field errors (caption, not red), correct `autoComplete`/`inputMode`.
- **Confirmation landing (`app/(public)/auth/confirmar-email/[token]/page.tsx`):** RSC `await params` → `auth.api.verifyEmail` → "Email confirmado. Bem-vinda(o)!" + `customer_email_verified` audit (actorId from token claim), expired-token CTA otherwise. Plus the generic post-signup `verifique-seu-email` page.
- **Defense in depth (INFRA-04):** every mutating action consumes the same in-process `rateLimitAuth`/`rateLimitForgotEmail` the proxy boundary uses (Plan 06) — the 11th login attempt from an IP in 60s returns the rate-limit copy.
- **Green + no regression:** 17 new integration tests pass; full suite **61 passed / 2 todo / 0 failed** (was 44/46); `tsc --noEmit` clean.

## Task Commits

1. **Task 1 (TDD): auth Server Actions + validation**
   - `4ac813b` (test — RED: 6 integration test files, modules absent)
   - `a18cfec` (feat — GREEN: lib/validation/auth.ts + lib/actions/auth.ts)
2. **Task 2: cadastro pages + confirm-email landing** — `f8d14ca` (feat)
3. **Checkpoint human-verify (Task 3):** approved by the user after verifying the cadastro flow in-browser + the locally-minted confirmation link.

**Plan metadata:** _(final docs commit — below)_

## Decisions Made
- **Pages under `app/(public)/`** to inherit the Plan-07 Header/Footer shell (D-03); URLs unchanged. (Deviation Rule 3.)
- **`auth.api.requestPasswordReset`** is the v1.6 forgot-password endpoint (not `forgetPassword`). (Deviation Rule 1.)
- **`z.boolean().refine(v===true)`** for consent so unchecked = hard block, not silent default.
- **Audit actorId from the token's JWT `email` claim** on confirmation, since `verifyEmail` returns only `{ status }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Auth pages placed under the `(public)` route group**
- **Found during:** Task 2.
- **Issue:** The plan's file list used bare `app/cadastro/...`; rendering there would not inherit the global Header/Footer shell, which lives in `app/(public)/layout.tsx` (D-03 isolation, Plan 07).
- **Fix:** Created the pages under `app/(public)/cadastro/…` and `app/(public)/auth/confirmar-email/[token]/…`. Route groups don't change the URL, so `/cadastro` and `/auth/confirmar-email/[token]` are served exactly as specced; all acceptance greps pass at the `(public)` paths.
- **Files:** the 3 page files.
- **Committed in:** `f8d14ca`.

**2. [Rule 1 - Bug] Better Auth forgot-password method name**
- **Found during:** Task 1 GREEN (`tsc`).
- **Issue:** The plan's interface note said `auth.api.forgetPassword`; v1.6 exposes `auth.api.requestPasswordReset({ body: { email, redirectTo } })` — `tsc` flagged `forgetPassword` as nonexistent.
- **Fix:** Switched the call; body shape verified against the better-auth type (`{ email, redirectTo? }`).
- **Files:** lib/actions/auth.ts.
- **Committed in:** `a18cfec`.

**3. [Rule 3 - Adjustment] Acceptance-grep `==1` collisions with docstrings**
- **Found during:** Post-implementation grep verification.
- **Issue:** `admin_login` and the confirm-email literals (`Email confirmado`, `customer_email_verified`) appeared in both a docstring and the code, breaking the `grep -c … == 1` criteria.
- **Fix:** Reworded the docstrings so each literal appears exactly once (in code). No behavior change.
- **Committed in:** `a18cfec`, `f8d14ca`.

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking/adjustment). No architectural (Rule 4) changes. No scope creep.

## Authentication / Checkpoint Notes
- The human-verify checkpoint's "click the email link" sub-step could not use a real inbox because the **Resend domain/keys are not yet configured** (a documented Plan 04 `user_setup`, not a code gap). To still verify the confirmation landing end-to-end, a valid verification token was minted locally via `createEmailVerificationToken(secret, email)` (no Resend needed) and the user confirmed the landing renders "Email confirmado. Bem-vinda(o)!" and that the cadastro/AUTH-03/+18-block flows work. The email-send wiring itself is covered green by `tests/auth/email-verify.test.ts`.

## Known Stubs
- None in this plan. (`/termos` and `/privacidade` remain `v1.0-shell` placeholders from Plan 07 — out of scope here; the consent checkbox + versioning are fully functional.)

## Verification Results (must-have truths)

| Truth | Result |
|-------|--------|
| Cliente cria conta com email+senha+nome+telefone (AUTH-01) | PASS — `signup.test.ts`: User + credential Account created |
| Cadastro email-first: passo 1 verifica existência antes do passo 2 (AUTH-02) | PASS — `email-first.test.ts` + UI step gate |
| Email já existente → branch AUTH-03 (UI literal) | PASS — `exists:true` → "talvez digitou errado" branch |
| Cadastro sem isAdult=true rejeitado, nada persistido (LGPD-01) | PASS — `consent.test.ts`: user null |
| Cadastro grava terms/privacy version + accepted_at (LGPD-02) | PASS — `consent.test.ts`: v1.0-shell + timestamps |
| Login e reset retornam mensagem genérica (AUTH-07) | PASS — `anti-enum.test.ts`: identical copy unknown vs wrong-password |
| 11ª tentativa de login/IP em 60s bloqueada (INFRA-04 defesa em profundidade) | PASS — `signin.test.ts` |
| Login admin grava admin_login (AUTH-10/11) | PASS — `admin-login.test.ts`: actorId=admin.id, no email in metadata |
| Confirmação verifica token e grava customer_email_verified (AUTH-04/11) | PASS — landing verified via local token + audit row |
| `tsc --noEmit` | PASS — exit 0 |
| Full suite | PASS — 61 passed / 2 todo / 0 failed |

## Next Phase Readiness
- **Plan 10 (admin login UI + esqueci/redefinir):** reuse `signinAdmin`, `requestPasswordReset`, `resetPassword`; keep the `Email ou senha não conferem` literal identical (NOTA W3).
- **Plan 11 (LGPD meus-dados/excluir):** lives under `(public)`; sonner ready for export/delete toasts.
- **Resend:** live email delivery still pending the Plan 04 domain verification `user_setup`.

## Self-Check: PASSED
All 11 created files exist on disk; the 3 task commits (4ac813b, a18cfec, f8d14ca) are in git history.

---
*Phase: 01-foundation*
*Completed: 2026-06-30*
