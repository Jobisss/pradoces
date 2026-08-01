# Phase 2: Motor Financeiro - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 24 new/modified files (grouped in 12 pattern families)
**Analogs found:** 10 / 12 families (2 families rely on RESEARCH.md code examples — no codebase analog exists yet)

Companion docs the planner MUST also consume: `02-CONTEXT.md` (D-01..D-11), `02-RESEARCH.md` (Patterns 1–7, schema shape, migration SQL, LOTE-08 test skeleton), `02-UI-SPEC.md` (UI contract for the admin screens — exists, 31K).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (modify: +9 models, +3 enums) | model | — | itself (header conventions, lines 1–12) + `AuditLog`/`Session` models | exact |
| `prisma/migrations/<ts>_motor_financeiro/migration.sql` (generated + custom SQL appended) | migration | — | `prisma/migrations/20260629133830_init/migration.sql` | role-match (generated part); custom trigger/CHECK SQL has NO analog → RESEARCH §Code Examples |
| `lib/auth/require-admin.ts` (new) | utility (auth guard) | request-response | `app/(admin)/admin/layout.tsx` (session+role check) + `lib/actions/auth.ts:189-193` | exact |
| `lib/validation/decimal.ts` (new, `zDecimalBRL`) | utility (validation) | transform | `lib/validation/auth.ts` (copy pt-BR literal pattern) + RESEARCH Pattern 2 (the Decimal transform itself) | role-match |
| `lib/validation/{ingredientes,compras,receitas,produtos,lotes}.ts` (new) | utility (validation) | transform | `lib/validation/auth.ts` | exact |
| `lib/actions/ingredientes.ts` (new) | server action | CRUD | `lib/actions/auth.ts` | exact |
| `lib/actions/compras.ts` (new) | server action | CRUD (append-only + guarded edit) | `lib/actions/auth.ts` | exact |
| `lib/actions/receitas.ts` (new) | server action | CRUD | `lib/actions/auth.ts` | exact |
| `lib/actions/produtos.ts` (new) | server action | CRUD + server-side cost lookup (PROD-09) | `lib/actions/auth.ts` | exact |
| `lib/actions/lotes.ts` (new) | server action | transactional create (nested) | `lib/actions/auth.ts` + RESEARCH Pattern 4 | role-match |
| `lib/actions/config.ts` (new, margem global) | server action | CRUD (singleton row) | `lib/actions/auth.ts` | exact |
| `lib/custo/corrente.ts`, `lib/custo/congelado.ts` (new) | service (server-only calc) | transform | `lib/audit/log.ts` (server lib module shape only) | partial — math itself has NO analog → RESEARCH Patterns 3/4 + §custo corrente example |
| `app/(admin)/admin/{ingredientes,receitas,produtos,lotes}/page.tsx` (new, lists) | RSC page | request-response (read) | `app/(admin)/admin/auditoria/page.tsx` | exact |
| `app/(admin)/admin/ingredientes/[id]/page.tsx` (histórico ING-08) | RSC page | request-response (read) | `app/(admin)/admin/auditoria/page.tsx` | exact |
| Simple client forms (ingrediente novo, `ajustes/`) | component (client form) | request-response | `app/(admin-auth)/admin/entrar/page.tsx` | exact |
| Complex client forms (`compras/nova`, receita form, `lotes/produzir`, produto form) | component (client form, RHF + useFieldArray) | request-response (multi-step / dynamic rows) | `app/(public)/cadastro/page.tsx` (multi-step, direct action call, a11y) | role-match — RHF itself is NEW (no analog) → RESEARCH Pattern 6 |
| `app/(admin)/admin/page.tsx` (modify: atalhos + ações pendentes de margem) | RSC page | request-response | itself (current placeholder) + `auditoria/page.tsx` for the data-fetching part | exact |
| `app/(admin)/admin/ajuda/page.tsx` (ANVISA, PROD-10) | RSC page (static) | — | `app/(public)/termos/page.tsx` (static content page) | role-match |
| `components/ui/{form,select,textarea,dialog,badge,popover,command,combobox,sheet}.tsx` | component (vendored shadcn) | — | `components/ui/button.tsx` etc. — generated via CLI, not hand-written | exact (tool-generated; `form` needs new-york-v4 URL workaround) |
| `tests/setup.ts` (modify) + `tests/conftest.ts#truncateAll` (modify) | test harness | — | themselves | exact |
| `tests/financeiro/fixtures.ts` (new) | test fixture | — | `tests/conftest.ts` (factory style, lines 64–96) | exact |
| `tests/financeiro/{compras,custo-corrente,custo-congelado,lotes,produtos}.test.ts` (new) | test | — | `tests/auth/admin-guard.test.ts` (DB integration) + `tests/auth/password-reset.test.ts` (action w/ mocked next/headers) | exact |
| `package.json` (add react-hook-form, @hookform/resolvers) | config | — | — (RESEARCH §Installation) | n/a |

## Pattern Assignments

### `lib/actions/*.ts` — every Phase 2 Server Action file (CRUD, request-response)

**Analog:** `lib/actions/auth.ts` (the ONLY Server Action file in the codebase — CONTEXT explicitly names it as the pattern to follow)

**File shape** (lines 1–10): `'use server'` directive, then imports:
```typescript
'use server'

import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth } from '@/lib/ratelimit/memory'
import { clientIp } from '@/lib/net/client-ip'
import { SignupSchema /* ... */ } from '@/lib/validation/auth'
```
Path alias is `@/` everywhere. One file per aggregate. Copy literals to module-top consts (`lib/actions/auth.ts:25-32` — e.g. `RATE_LIMIT_COPY`, `GENERIC_SERVER_ERROR`) so pt-BR copy stays consistent per file.

**Action state type** (lines 37–42) — reuse this exact shape for `useActionState` compatibility:
```typescript
export type AuthActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  message?: string
  ok?: boolean
}
```

**Client context helper** (lines 44–51) — Next 16 async headers; reuse for audit IP/UA:
```typescript
async function clientContext() {
  const h = await nextHeaders()
  const ip = clientIp(h)          // HI-01: never trust leftmost XFF
  const ua = h.get('user-agent') ?? undefined
  return { h, ip, ua }
}
```

**Mutation skeleton** (`signupCustomer`, lines 57–116) — the 7-step order every Phase 2 mutation copies, with ONE change: step between rate-limit and Zod becomes `await requireAdmin()` (Phase 2 actions are admin-only; layout does NOT protect actions — RESEARCH Pattern 1):
```typescript
export async function signupCustomer(_prev: unknown, formData: FormData): Promise<AuthActionState> {
  const { ip, ua } = await clientContext()                                   // 1. context
  const rl = await rateLimitAuth.consume(ip).catch(() => null)              // 2. rate limit (defense in depth)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  const parsed = SignupSchema.safeParse({ /* String(formData.get(...) ?? '') per field */ })  // 3. Zod
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try { /* 4. mutation */ } catch { return { error: GENERIC_SERVER_ERROR } } // generic, never leaks detail

  await logAudit({ actorType: 'customer', actorId: user.id, action: 'customer_signup', rawIp: ip, rawUa: ua })  // 5. audit

  redirect('/cadastro/verifique-seu-email')                                  // 6. redirect (or return {ok:true})
}
```
Phase 2 additions on top of this skeleton (no analog — from RESEARCH): `requireAdmin()` first line; `revalidatePath(...)` after mutation; `prisma.$transaction`/nested create for lote (RESEARCH Pattern 4); PROD-09 server-side cost lookup BEFORE saving produto; D-03 preventive `EXISTS lote_uso_ingredientes` check with friendly copy before letting the trigger fire (RESEARCH Pitfall 7).

**Non-form helper action** (`checkEmailExists`, lines 125–131) — plain-args async function exported from the same `'use server'` file, called directly from client via `useTransition`. This is the analog for the autocomplete suggestion actions (D-04 DISTINCT marcas/mercados) and margin-preview data fetches:
```typescript
export async function checkEmailExists(email: string): Promise<{ exists: boolean }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { exists: false }
  const user = await prisma.user.findUnique({ where: { email: normalized } })
  ...
}
```

---

### `lib/auth/require-admin.ts` (utility/auth guard)

**Analog:** role check exists in TWO places — copy the combination:

`app/(admin)/admin/layout.tsx:14-16` (session fetch, Next 16 async headers):
```typescript
const session = await auth.api.getSession({ headers: await nextHeaders() })
if (!session) redirect('/admin/entrar')
if (session.user.role !== 'admin') { /* 403 copy */ }
```

`lib/actions/auth.ts:189-193` (role narrowing without leaking):
```typescript
const user = (result as { user?: { id: string; role?: string } } | undefined)?.user
if (!user || user.role !== 'admin') {
  // Don't leak that the credentials were valid for a non-admin (anti-enum).
  return { error: INVALID_CREDENTIALS }
}
```
Target shape is RESEARCH Pattern 1 verbatim (throws `'UNAUTHORIZED'`; the calling action catches and returns a generic error). Import `auth` from `@/lib/auth/server`.

---

### `lib/validation/*.ts` (validation schemas)

**Analog:** `lib/validation/auth.ts`

**Structure** (lines 16–29): copy consts for pt-BR error literals + one exported PascalCase `*Schema` per action + `z.infer` type exports (lines 45–48):
```typescript
const EMAIL_INVALID = 'Esse email não parece certo. Confere o `@` e o `.com`.'
const OBRIGATORIO = 'Esse campo é obrigatório.'

export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email(EMAIL_INVALID),
  nome: z.string().trim().min(1, OBRIGATORIO),
  ...
})
export type SignupInput = z.infer<typeof SignupSchema>
```
Error messages are the LITERAL copy from 02-UI-SPEC (same doc-comment rationale as auth.ts lines 3–14). For money/quantity fields NEVER `z.number()` — use `zDecimalBRL` from `lib/validation/decimal.ts` (no analog; implement RESEARCH Pattern 2 verbatim: `z.string().trim().regex(/^\d{1,13}([.,]\d{1,4})?$/).transform(s => new Decimal(s.replace(',', '.')))`).

---

### `prisma/schema.prisma` (modify — 9 domain models)

**Analog:** the file itself. Conventions are documented in its header (lines 1–12) and must be repeated in new models:
- PK: `String @id @default(uuid()) @db.Uuid` (see `User`, line 33)
- snake_case via `@@map`/`@map` (every model)
- Timestamps: `DateTime @db.Timestamptz(6)` + `@default(now())` / `@updatedAt` pair (lines 51–52)
- Money: `Decimal @db.Decimal(19, 4)`; per-unit derived cost `@db.Decimal(19, 6)` (RESEARCH nota de precisão)
- Relation + index pattern (Session, lines 73–76):
```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
@@index([userId])
@@map("sessions")
```
Phase 2 uses `onDelete: Restrict` on `LoteUsoIngrediente.compra` (frozen-cost FK). Full recommended model shapes: RESEARCH §"Shape de schema recomendado" (Claude's Discretion — planner may refine, conventions may not change). Descending index analog: `@@index([ts(sort: Desc)])` (`AuditLog`, line 129) → `@@index([ingredienteId, dataCompra(sort: Desc)])`.

---

### `prisma/migrations/<ts>_motor_financeiro/migration.sql`

**Analog:** `prisma/migrations/20260629133830_init/migration.sql` for the generated portion (CreateEnum/CreateTable/CreateIndex/AddForeignKey layout, TIMESTAMPTZ(6), UUID columns, `ON DELETE CASCADE` FKs — lines 1–121).

**No analog** for the appended custom SQL (trigger `trg_compra_imutavel`, CHECKs LOTE-04, singleton CHECK `configuracoes.id = 1`) — copy verbatim from RESEARCH §Code Examples "Migration SQL custom". Workflow (RESEARCH Pattern 7): `prisma migrate dev --create-only` → append SQL → apply. **Never `prisma db push`** (would silently drop the trigger).

---

### `app/(admin)/admin/{ingredientes,receitas,produtos,lotes}/page.tsx` (RSC list pages)

**Analog:** `app/(admin)/admin/auditoria/page.tsx`

**Core pattern** (lines 42–75): async RSC, direct prisma query with explicit ordering, empty-state copy in "vizinha" voice, list rendering:
```typescript
export default async function AuditPage() {
  const events = await prisma.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 200 })
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      ...
      {events.length === 0 ? (
        <p className="text-base font-medium">Nenhum evento ainda</p> /* + helper copy */
      ) : (
        <ul className="divide-y divide-border">{events.map((e) => ( ... ))}</ul>
      )}
```
**Imports pattern** (lines 1–3): `date-fns` + `ptBR` locale + prisma:
```typescript
import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { prisma } from '@/lib/db/client'
```
Date label helper (lines 36–40) — reuse for compra/lote dates. Phase 2 deltas: queries MUST use explicit `include`/`select` for relations (anti N+1, RESEARCH Pitfall 9 — lists computing margem do 1 batch `DISTINCT ON` query, not per-row); lote filters (LOTE-07) compare against "hoje" derived in America/Sao_Paulo (Pitfall 10). No auth code needed in pages — `app/(admin)/admin/layout.tsx` gates all children.

---

### Simple client forms — ingrediente novo/editar, `ajustes/` (margem global)

**Analog:** `app/(admin-auth)/admin/entrar/page.tsx`

**Full pattern** (lines 1–57): `'use client'`, `useActionState(action, initialState)`, `<form action={formAction} noValidate>`, `role="alert"` error paragraph, Label+Input pairs, pending-disabled submit:
```typescript
const [state, formAction, pending] = useActionState(authActions.signinAdmin, initialState)
...
<form action={formAction} className="space-y-6" noValidate>
  {state.error && <p role="alert" className="text-sm text-muted-foreground">{state.error}</p>}
  <div className="space-y-1.5">
    <Label htmlFor="email">Email</Label>
    <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
  </div>
  <Button type="submit" size="lg" className="w-full" disabled={pending}>
    {pending ? 'Enviando...' : 'Entrar'}
  </Button>
</form>
```
Money inputs add `inputMode="decimal"` (RESEARCH Pitfall 4).

---

### Complex client forms — `compras/nova` (D-01), receita form (N ingredientes), `lotes/produzir` (D-05/06/07/08), produto form (PROD-08/09)

**Analog (partial):** `app/(public)/cadastro/page.tsx` — the richest client component in the codebase. Copy from it:

**Multi-step client state + direct action call via `useTransition`** (lines 39–58) — this is the analog for the "ida ao mercado" flow (fixed mercado+data header in client state; each "adicionar item" fires ONE persisting action):
```typescript
const [step, setStep] = useState<Step>('email')
const [checking, startCheck] = useTransition()
...
startCheck(async () => {
  const { exists } = await checkEmailExists(value)   // plain-args server action
  setStep(exists ? 'exists' : 'details')
})
```

**Field-level error rendering + a11y** (lines 30–37, 141–160): `FieldError` component, `aria-describedby`/`aria-invalid` wiring, helper text fallback — reuse for every Phase 2 field.

**Sticky mobile CTA** (lines 224–230) — long forms on mãe's phone:
```tsx
<div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
```

**No analog** for RHF + `zodResolver` + `useFieldArray` (react-hook-form is a NEW dependency) — follow RESEARCH Pattern 6 and 02-UI-SPEC; submit via `handleSubmit(async (data) => await serverAction(data))`. Decimal crosses the RSC→client boundary as `.toFixed()` string, client rebuilds `new Decimal(s)` (RESEARCH Pattern 2/Pitfall 3).

---

### `lib/custo/corrente.ts` / `lib/custo/congelado.ts` (server-only calc lib)

**Analog (shape only):** `lib/audit/log.ts` — single-purpose server lib module: doc-comment explaining the invariant it "absorbs", imports `prisma` from `@/lib/db/client`, exports typed async functions (lines 1–4, 26–57). The idea of a chokepoint helper that call sites cannot get wrong (logAudit absorbs PII hashing) is exactly the posture for `lib/custo/` (absorbs Decimal arithmetic — nothing outside it does money math).

**No analog** for the actual math — implement from RESEARCH: §"Custo corrente de receita" example (`import 'server-only'`, `include: {itens: {include: {ingrediente: true}}}`, Σ via Decimal), Pattern 3 (`DISTINCT ON` via `$queryRaw` tagged template) and Pattern 4 (snapshot computation). Note: `$queryRaw` has zero uses in the codebase today — Pattern 3 is the first; only tagged templates, `Prisma.raw` only with the `'marca'|'mercado'` allowlist (Pattern 5).

---

### Audit calls (cross-file: every mutating action)

**Analog:** `lib/audit/log.ts` (whole file) + call sites `lib/actions/auth.ts:107-113, 195-201`.

Signature to copy (log.ts lines 26–41): `logAudit({ actorType: 'admin', actorId, action, entityType?, entityId?, metadata?, rawIp?, rawUa? })`. Phase 2 actions `compra_registrada`, `lote_criado`, `preco_alterado` need NO migration (`action` is a free String — log.ts doc lines 21–24). For `preco_alterado`, put before/after values in `metadata` (RESEARCH §Security). The auditoria viewer's `ACTION_COPY` map (`app/(admin)/admin/auditoria/page.tsx:11-19`) must gain the 3 new pt-BR phrases.

---

### `tests/financeiro/*` + harness updates

**Analog 1 — DB integration test:** `tests/auth/admin-guard.test.ts` (lines 1–9): plain vitest + real prisma + conftest fixtures, `beforeEach(truncateAll)`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db/client'
import { truncateAll, createTestUser, signInAsCustomer } from '../conftest'

describe('...', () => {
  beforeEach(async () => { await truncateAll() })
```
Use this shape for `compras.test.ts` (trigger/ING-03), `custo-corrente.test.ts`, `custo-congelado.test.ts` (LOTE-08 skeleton in RESEARCH §Code Examples — write BEFORE the lote flow), `lotes.test.ts` (CHECK LOTE-04).

**Analog 2 — Server Action test with mocked Next runtime:** `tests/auth/password-reset.test.ts` (lines 1–11) — the "padrão 01-08" CONTEXT mandates; needed for `produtos.test.ts` (PROD-09 with requireAdmin) and any action-level test:
```typescript
const ctx = vi.hoisted(() => ({ ip: '203.0.113.50' }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ctx.ip, 'user-agent': 'vitest-reset' }),
  cookies: async () => ({ set() {}, get: () => undefined, getAll: () => [], delete() {} }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
```
Plus the `form()` FormData helper (lines 32–36) and per-test randomized IP (line 41) to keep the in-process rate limiter from bleeding across tests. To exercise `requireAdmin` inside an action: mint an admin session with `createTestUser({role:'admin'})` + `signInAsAdmin` (conftest lines 112–121) and return its `cookie` from the mocked `headers()`.

**Fixtures:** `tests/financeiro/fixtures.ts` copies the factory style of `tests/conftest.ts:64-85` (`createTestUser` — optional-args object, sensible defaults, returns minimal shape): `criarIngrediente`, `registrarCompra`, `criarReceita`, `criarProduto`, `produzirLote`.

**Harness (MODIFY, children-first — Pitfall 5):** `tests/setup.ts:19-27` and `tests/conftest.ts#truncateAll` (lines 87–96) both hold the same `prisma.$transaction([...deleteMany])` list. Prepend the 9 new models BEFORE the Phase 1 entries, in FK order: `loteUsoIngrediente, lote, produtoKitItem, produto, receitaIngrediente, receita, ingredienteCompra, ingrediente, configuracao`. Decimal assertions: compare `.toFixed(n)` strings, never `toBe(number)` (Pitfall 8).

---

### `app/(admin)/admin/page.tsx` (modify — atalhos + ações pendentes de margem)

**Analog:** the current file itself (lines 8–31: max-w container, `font-display` h1, `<nav>` of Links) — extend, don't replace. The margem-pendente list is computed on-read with the batch query pattern (RESEARCH Open Question 2 recommendation: no new table, no pg-boss job); data-fetching mirrors `auditoria/page.tsx`. Layout details per 02-UI-SPEC.

## Shared Patterns

### Authorization (V4 — core of the phase)
**Source:** new `lib/auth/require-admin.ts` (built from `app/(admin)/admin/layout.tsx:14-16` + `lib/actions/auth.ts:189-193`, shape in RESEARCH Pattern 1)
**Apply to:** FIRST line of every exported mutation in `lib/actions/{ingredientes,compras,receitas,produtos,lotes,config}.ts`. Pages are covered by the existing layout gate — actions are NOT.

### Rate limiting (defense in depth)
**Source:** `lib/actions/auth.ts:62-63`
```typescript
const rl = await rateLimitAuth.consume(ip).catch(() => null)
if (rl === null) return { error: RATE_LIMIT_COPY }
```
**Apply to:** admin mutations (same shared `RateLimiterMemory` instances — see `lib/ratelimit/`).

### Error handling / copy
**Source:** `lib/actions/auth.ts:25-32` (module-top pt-BR literals; generic server error) + RESEARCH Pitfall 7 (trigger errors: preventive `EXISTS` check with friendly copy, `catch` matching `/imutavel/` as last defense).
**Apply to:** all actions. Never surface raw Postgres/Prisma errors to the mãe.

### Money & Decimal discipline
**Source:** `lib/validation/decimal.ts` (new — RESEARCH Pattern 2) + `lib/custo/` (new).
**Apply to:** every monetary/quantity field (schemas), every calculation (lib/custo only), every RSC→client boundary (`.toFixed(4)`/`.toFixed(6)` strings, reconstruct with `new Decimal()` client-side).

### Audit
**Source:** `lib/audit/log.ts` — `logAudit(...)` after every successful mutation with `rawIp`/`rawUa` from `clientContext()`.
**Apply to:** compras (compra_registrada), lotes (lote_criado), produtos price change (preco_alterado, metadata before/after).

### Imports & aliases
`@/` path alias throughout (tsconfig); `prisma` singleton only from `@/lib/db/client` (never new PrismaClient — see its doc lines 4–17 for the Prisma 7 driver-adapter rationale).

## No Analog Found

Files/patterns with no close match in the codebase (planner uses RESEARCH.md sections instead):

| File / Pattern | Role | Data Flow | Fallback Source |
|----------------|------|-----------|-----------------|
| Custom SQL (trigger `trg_compra_imutavel`, CHECKs, singleton) | migration | — | RESEARCH §Code Examples "Migration SQL custom" (verbatim) |
| `lib/custo/*` Decimal arithmetic + `DISTINCT ON` `$queryRaw` | service | transform | RESEARCH Patterns 3/4/5 + §"Custo corrente de receita" |
| RHF + `useFieldArray` + `zodResolver` forms | component | request-response | RESEARCH Pattern 6 + 02-UI-SPEC; install per §Installation (form component from new-york-v4 URL — radix-nova `form` is a verified empty stub) |
| `revalidatePath` after mutation | server action | — | `node_modules/next/dist/docs/` (Phase 1 auth actions redirect instead; Phase 2 CRUD needs revalidate) |

## Metadata

**Analog search scope:** `lib/` (actions, audit, auth, db, validation), `app/(admin)`, `app/(admin-auth)`, `app/(public)`, `prisma/`, `tests/`, `components/`
**Files scanned:** ~30 listed, 14 read in full (auth.ts, log.ts, layout.tsx, auditoria/page.tsx, client.ts, validation/auth.ts, schema.prisma, init migration, entrar/page.tsx, cadastro/page.tsx, admin home, setup.ts, conftest.ts, password-reset.test.ts, admin-guard.test.ts)
**Pattern extraction date:** 2026-07-03
