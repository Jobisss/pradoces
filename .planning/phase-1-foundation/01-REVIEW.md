---
phase: 01-foundation
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - lib/actions/auth.ts
  - lib/validation/auth.ts
  - lib/validation/lgpd.ts
  - lib/auth/server.ts
  - lib/auth/client.ts
  - lib/auth/argon2.ts
  - lib/audit/log.ts
  - lib/lgpd/export.ts
  - lib/lgpd/anonymize.ts
  - lib/ratelimit/memory.ts
  - lib/queue/boss.ts
  - lib/email/resend.ts
  - lib/email/send-verification.tsx
  - lib/email/send-password-reset.tsx
  - proxy.ts
  - instrumentation.ts
  - app/api/auth/[...all]/route.ts
  - app/api/me/export/route.ts
  - app/api/me/delete/route.ts
  - app/api/webhooks/resend/route.ts
  - app/(public)/cadastro/page.tsx
  - app/(public)/cadastro/verifique-seu-email/page.tsx
  - app/(public)/auth/confirmar-email/[token]/page.tsx
  - app/(public)/entrar/page.tsx
  - app/(public)/esqueci-minha-senha/page.tsx
  - app/(public)/esqueci-minha-senha/enviado/page.tsx
  - app/(public)/redefinir-senha/[token]/page.tsx
  - app/(public)/minha-conta/excluir/page.tsx
  - app/(public)/minha-conta/meus-dados/page.tsx
  - app/(public)/minha-conta/layout.tsx
  - app/(public)/layout.tsx
  - app/(admin)/admin/layout.tsx
  - app/(admin)/admin/page.tsx
  - app/(admin)/admin/auditoria/page.tsx
  - app/(admin-auth)/admin/entrar/page.tsx
  - app/(admin-auth)/layout.tsx
  - app/layout.tsx
  - components/header.tsx
  - components/footer.tsx
  - components/toaster.tsx
  - scripts/seed-admin.ts
  - scripts/dev-login.ts
  - prisma/schema.prisma
  - prisma/migrations/20260629135330_better_auth_admin_fields/migration.sql
findings:
  critical: 0
  high: 2
  medium: 3
  low: 5
  info: 2
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-30
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Phase 1 foundation (Better Auth + argon2id, LGPD export/anonymize, audit logging, proxy
rate-limit, svix webhook, admin bootstrap CLI) is generally well-structured, and the most
sensitive invariants the brief called out are correctly implemented:

- Export and delete **do** derive identity from `auth.api.getSession(...).user.id`/`.email`,
  never from request-supplied ids (no IDOR). The export uses an explicit `select` whitelist.
- Delete compares the typed `confirmacao` against the **server** session email.
- The svix webhook reads the **raw** body and verifies the signature before any processing.
- The audit writer hashes IP/UA and never persists plaintext password/token; the export
  whitelist excludes credential fields; `/minha-conta` and `/admin` both have a real DB
  role gate in their layouts (the second of the two security layers).

The defects below cluster around the **rate-limit boundary** (the brief's stated primary
brute-force control), which is bypassable via a spoofed `X-Forwarded-For` header and does
not cover every directly-reachable Better Auth endpoint, and a few correctness/robustness
gaps. No clean auth bypass or PII leak was found, hence no Critical, but two High items
defeat stated security/compliance controls and should block ship.

## High

### HI-01: Boundary rate limit is bypassable via spoofed `X-Forwarded-For`

**File:** `proxy.ts:57` (and `lib/actions/auth.ts:45`)
**Issue:** Both the proxy boundary throttle and the Server-Action defense layer derive the
client IP from `request.headers.get('x-forwarded-for').split(',')[0]` — the **leftmost**
XFF value. Behind Cloudflare + Caddy, Cloudflare **appends** the real client IP to any
client-supplied `X-Forwarded-For`, so the leftmost entry is attacker-controlled. An attacker
can send a random `X-Forwarded-For` on each request and land in a fresh rate-limit bucket
every time, fully defeating INFRA-04 / T-01-06-01 (the documented primary brute-force
control). argon2id slows online guessing but does not restore the throttle.
**Fix:** Behind Cloudflare, trust the `CF-Connecting-IP` header (set by the edge, not
forwardable by the client); fall back to the **rightmost** XFF hop only for the trusted
proxy. Centralize this in one `clientIp(request)` helper used by both `proxy.ts` and
`clientContext()`:
```ts
function clientIp(h: Headers): string {
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = (h.get('x-forwarded-for') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return xff.at(-1) ?? 'unknown' // rightmost = closest trusted hop
}
```
(If Cloudflare is mandatory, also reject requests whose source is not a Cloudflare IP range.)

### HI-02: Direct `POST /api/auth/sign-up/email` bypasses the LGPD consent gate

**File:** `app/api/auth/[...all]/route.ts:4`, `proxy.ts:53-56`, `lib/actions/auth.ts:54-102`
**Issue:** The Better Auth catch-all is directly reachable, and the proxy only throttles
`/sign-in/email` and `/forget-password`. The LGPD-01/LGPD-02 consent capture (isAdult,
termsVersion/Accepted, privacyVersion/Accepted, telefone) lives **only** in the
`signupCustomer` Server Action — it is stamped *after* `signUpEmail` in a follow-up
`prisma.user.update`. A client that POSTs directly to `/api/auth/sign-up/email` creates a
fully valid customer `User` (defaultRole `customer`, `isAdult=false`, no terms/privacy
acceptance, no telefone) that becomes operable as soon as it is email-verified — silently
defeating the consent "hard block" the schema and action enforce. It is also unthrottled at
the boundary (account-creation + verification-email flood).
**Fix:** Treat consent as a server invariant, not a UI step. Either (a) disable Better
Auth's public `sign-up/email` route and create users exclusively through the action, or
(b) move the consent fields into the `signUpEmail` `body`/`user.additionalFields` so the row
cannot be created without them, and reject `isAdult !== true || !termsAccepted` inside a
Better Auth `before`/`databaseHooks.user.create` hook. Add `/sign-up/email` to the proxy
`sensitive` set.

## Medium

### ME-01: Audit IP/UA hashed with unsalted SHA-256 — reversible

**File:** `lib/audit/log.ts:53-55`, `app/api/me/delete/route.ts:31-38`
**Issue:** IP and User-Agent are stored as plain `sha256(value)`. The IPv4 space is ~4.3B
values and common UAs are a tiny set, so an attacker with DB read access can recover the
original IP/UA in seconds via an exhaustive hash table. The stated control (T-01-04-02 /
Pitfall #9: "PII never recoverable") is therefore not actually met — the hash is privacy
theater for low-entropy inputs.
**Fix:** Use a keyed HMAC with a server-side pepper so the mapping is not brute-forceable:
```ts
function hashPii(s: string): string {
  return crypto.createHmac('sha256', env.AUDIT_HASH_PEPPER).update(s).digest('hex')
}
```
Add `AUDIT_HASH_PEPPER` (>=32 chars) to `lib/env.ts` and route the delete-route hashing
through the same helper instead of inlining `createHash`.

### ME-02: Account-deletion confirmation is case-sensitive — blocks legitimate LGPD deletion

**File:** `lib/validation/lgpd.ts:13-15`, `app/api/me/delete/route.ts:27`
**Issue:** Stored emails are normalized to lowercase (Zod `.toLowerCase()` on signup), but
`DeleteAccountSchema` only `.trim()`s the typed `confirmacao`. The route then compares
`parsed.data.confirmacao !== session.user.email` case-sensitively. A user (50+ clientele,
mobile keyboards that auto-capitalize) who types `Joao@Gmail.com` will mismatch the stored
`joao@gmail.com` and be **unable to exercise their LGPD-05 deletion right**, with only the
opaque "email não confere" message.
**Fix:** Normalize the confirmation the same way as stored emails before comparing:
```ts
confirmacao: z.string().trim().toLowerCase().min(1, 'Digite seu email completo pra confirmar.'),
```
(`session.user.email` is already lowercase, so this makes the compare robust.)

### ME-03: Boundary rate-limit coverage gaps on directly-reachable auth endpoints

**File:** `proxy.ts:53-67`
**Issue:** Only `/sign-in/email` and `/forget-password` are throttled, and `/forget-password`
is throttled **only per-IP** at the boundary — the per-email anti-flood limit
(`rateLimitForgotEmail`, 3/15min) exists solely inside the `requestPasswordReset` Server
Action. A direct `POST /api/auth/forget-password` therefore bypasses the per-email cap and
lets an attacker send up to 10 reset emails / 60s to a *specific victim address* (targeted
email bombing). `/reset-password` and `/verify-email` (token submission) are also unthrottled,
permitting token brute-force attempts.
**Fix:** Enforce the per-email forgot limit at the boundary too (parse the email from the
body for `/forget-password`, or move that limiter into a Better Auth hook that runs for both
entry points), and add `/reset-password` and `/verify-email` to the throttled set keyed by IP.

## Low

### LO-01: `signinAdmin` establishes a customer session as a side effect of a "failed" login

**File:** `lib/actions/auth.ts:178-190`
**Issue:** `auth.api.signInEmail` runs with `headers: h`, so the `nextCookies` plugin sets a
valid session cookie *before* the `user.role !== 'admin'` check returns `INVALID_CREDENTIALS`.
A non-admin who submits valid credentials on `/admin/entrar` is told "Email ou senha não
conferem" yet ends up with a live customer session. No privilege escalation (role stays
customer), but it is a confusing, unaudited auth state.
**Fix:** After detecting a non-admin, revoke the just-created session (e.g.
`await auth.api.signOut({ headers: h })`) before returning the error, so the admin form never
leaves a logged-in state.

### LO-02: Post-signup consent stamp is non-transactional and outside try/catch

**File:** `lib/actions/auth.ts:91-102`
**Issue:** If `signUpEmail` succeeds but the follow-up `prisma.user.update` (telefone +
consent stamps) throws, the exception is unhandled (500 to the user) and the User row exists
without consent — a partial, non-compliant account. The create and the consent stamp are not
atomic.
**Fix:** Set the consent fields atomically with creation (see HI-02 fix via `additionalFields`
/ create hook), or wrap the post-create update in try/catch and compensate (delete the
orphaned row) on failure.

### LO-03: `dev-login.ts` production guard relies solely on `NODE_ENV`

**File:** `scripts/dev-login.ts:102`, `scripts/seed-admin.ts` (forge helpers)
**Issue:** `dev-login.ts` forges a signed session cookie for **any** user (including the
admin) and is gated only by `process.env.NODE_ENV === 'production'`. When run via `tsx` on a
host where `NODE_ENV` is unset/empty (common for ad-hoc scripts), the guard passes. Anyone
with shell access + `BETTER_AUTH_SECRET` could mint an admin session. It is a dev tool, but
the single-signal guard is thin.
**Fix:** Require an explicit opt-in (e.g. refuse unless `process.env.ALLOW_DEV_LOGIN === '1'`
**and** `NODE_ENV !== 'production'`), and exclude `scripts/dev-login.ts` from any production
image/build.

### LO-04: GET-based email verification token consumed by link prefetchers

**File:** `app/(public)/auth/confirmar-email/[token]/page.tsx:43`
**Issue:** Verification happens on a GET render that consumes the single-use token. WhatsApp/
email-client/antivirus link unfurlers that prefetch the URL will burn the token before the
human clicks, yielding a false "Esse link expirou". The 24h window + resend mitigate but do
not prevent it.
**Fix:** Make consumption an explicit user action — render a "Confirmar email" button that
POSTs to verify (per OWASP guidance for state-changing email links), or detect prefetch and
defer the mutation.

### LO-05: Empty `X-Forwarded-For` collapses all callers into one shared rate-limit bucket

**File:** `proxy.ts:57`, `lib/actions/auth.ts:45`
**Issue:** When XFF is absent, the IP resolves to the literal `'unknown'`, so every such
request shares a single bucket and can lock each other out (or, conversely, an attacker can
deliberately omit XFF to share/exhaust a known bucket). Mostly subsumed by HI-01's fix but
worth handling explicitly.
**Fix:** Once `CF-Connecting-IP` is the source (HI-01), `'unknown'` should be unreachable;
otherwise fail closed (reject) rather than bucketing disparate clients together.

## Info

### IN-01: Role read via `as` casts instead of typed `additionalFields`

**File:** `lib/actions/auth.ts:186`, `lib/auth/server.ts:53`
**Issue:** `result as { user?: { role?: string } }` and `(user as { role?: string }).role`
work around Better Auth's base user type omitting `additionalFields`. Functional, but the
unchecked casts will silently mask a future shape change (e.g. role renamed).
**Fix:** Use Better Auth's `$Infer`/inferred session type, or a small typed accessor, so the
role field is checked at compile time.

### IN-02: `emailFromToken` decodes the JWT payload without verifying the signature

**File:** `app/(public)/auth/confirmar-email/[token]/page.tsx:20-31`
**Issue:** The email claim is base64url-decoded from an unverified token. It is only used
best-effort to locate the user for the audit `actorId` **after** `verifyEmail` already
validated the token, so there is no trust boundary crossed — acceptable as written. Flagged
so a future change doesn't start trusting this value for authorization.
**Fix:** None required now; add a comment that the decoded claim must never gate access.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
