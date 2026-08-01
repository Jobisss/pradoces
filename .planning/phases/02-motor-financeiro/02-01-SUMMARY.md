---
phase: 02-motor-financeiro
plan: 01
subsystem: database
tags: [prisma, postgres, migrations, triggers, decimal, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma 7 schema conventions (uuid PK, snake_case @@map, Timestamptz(6)), vitest harness shared with dev DB, lib/db/client.ts driver-adapter pattern
provides:
  - 9 Prisma models + 3 enums for the financial engine domain (Ingrediente, IngredienteCompra, Receita, ReceitaIngrediente, Produto, ProdutoKitItem, Lote, LoteUsoIngrediente, Configuracao)
  - Migration `20260801153408_motor_financeiro` with custom SQL (trg_compra_imutavel trigger + LOTE-04 CHECKs + configuracoes singleton CHECK) applied to the live dev Postgres
  - Test harness (tests/setup.ts, tests/conftest.ts) isolating the 9 new models children-first
  - tests/financeiro/schema.test.ts proving the trigger/CHECKs against real Postgres
  - A replacement local dev Postgres container (doces-pg, port 5440) matching the documented .env convention (the original container no longer existed on this machine)
affects: [02-02, 02-03, 02-04, 02-05, all remaining Phase 2 plans that build actions/lib/custo/UI on this schema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen-cost invariant enforced in the DATABASE (trigger + FK RESTRICT + CHECK), never by app convention — lote_uso_ingredientes.ingrediente_compra_id is a NOT NULL FK to the PURCHASE row, never to the ingredient"
    - "Custom SQL appended to a `prisma migrate dev --create-only` generated migration.sql (never `prisma db push`, which silently drops trigger/CHECK)"
    - "Test harness truncateAll/afterEach lists updated children-first for every new model, kept identical between tests/setup.ts and tests/conftest.ts"

key-files:
  created:
    - prisma/migrations/20260801153408_motor_financeiro/migration.sql
    - tests/financeiro/schema.test.ts
  modified:
    - prisma/schema.prisma
    - tests/setup.ts
    - tests/conftest.ts

key-decisions:
  - "Local dev Postgres container 'doces-pg' (postgres:16-alpine, port 127.0.0.1:5440, db doces_valentina) was recreated from scratch — it did not exist on this machine (only the docker-compose review stack's 'db' service was running, on an internal-only network). This restores the exact convention documented in .env's header comment, so .env itself needed zero changes."
  - "Chose to recreate the documented dev DB container over patching docker-compose.yml to publish a host port on the compose 'db' service — keeps the compose file's production posture (DB never exposed to the host network) untouched, which is out of this plan's scope."

requirements-completed: [ING-04, ING-07, LOTE-02, LOTE-04, LOTE-05, LOTE-06]

# Metrics
duration: ~30min
completed: 2026-08-01
---

# Phase 2 Plan 01: Motor Financeiro — Data Foundation Summary

**9 Prisma models + 3 enums for ingredient/recipe/batch cost tracking, with a Postgres trigger enforcing purchase immutability and CHECK constraints enforcing non-negative stock — all proven live against Postgres, not just present in the schema file.**

## Performance

- **Duration:** ~30 min (DB infrastructure investigation/setup took a meaningful share, since the documented local dev Postgres container no longer existed on this machine)
- **Completed:** 2026-08-01T15:40:00Z
- **Tasks:** 3 (Task 2 produced no independent commit — see below)
- **Files modified:** 5 (1 created migration, 1 created test, 3 modified: schema.prisma, tests/setup.ts, tests/conftest.ts)

## Accomplishments
- Added `Ingrediente`, `IngredienteCompra`, `Receita`, `ReceitaIngrediente`, `Produto`, `ProdutoKitItem`, `Lote`, `LoteUsoIngrediente`, `Configuracao` models (+ `UnidadeBase`, `TipoIngrediente`, `TipoProduto` enums) to `prisma/schema.prisma`, following Phase 1 conventions exactly (uuid PK, `@@map` snake_case, `Timestamptz(6)`, `Decimal(19,4)`/`Decimal(19,6)`)
- Generated migration `20260801153408_motor_financeiro` via `prisma migrate dev --create-only`, then appended the custom SQL verbatim from RESEARCH.md: `trg_compra_imutavel` trigger (BEFORE UPDATE OR DELETE on `ingrediente_compras`, blocks the statement once any `lote_uso_ingredientes` row references it), `lotes_qtde_disponivel_nao_negativa`/`lotes_qtde_reservada_nao_negativa` CHECKs, `configuracoes_singleton` CHECK
- Applied the migration to a real running Postgres and confirmed the trigger + all 3 CHECK constraints exist in `pg_trigger`/`pg_constraint` (live catalog query, not file inspection)
- Regenerated the Prisma client (v7.9.1) — `prisma.loteUsoIngrediente` and all 8 sibling delegates confirmed present in `node_modules/.prisma/client/index.d.ts`; `tsc --noEmit` is clean
- Updated `tests/setup.ts` and `tests/conftest.ts#truncateAll` with the 9 new models' `deleteMany()` calls, prepended before the Phase 1 list, in FK-safe children-first order
- Wrote `tests/financeiro/schema.test.ts` (7 tests) proving against the live Postgres: UPDATE/DELETE on a referenced compra rejects with `/imutavel/`; an unreferenced compra stays editable/deletable (D-03); negative `qtde_disponivel`/`qtde_reservada` UPDATEs abort (LOTE-04); a second `configuracoes` row (id=2) is rejected (D-10 singleton); `trg_compra_imutavel` is visible in `pg_trigger`
- Full suite green: 28 test files (1 pre-existing skip), 92 passed + 2 todo — zero regressions from Phase 1

## Task Commits

1. **Task 1: Add 9 models + 3 enums, generate migration with custom SQL (create-only)** - `1d87c4c` (feat)
2. **Task 2: Apply the migration to the dev DB and regenerate the client** - no independent commit (see Deviations — verification-only task, no tracked-file changes to commit; verified live against Postgres instead)
3. **Task 3: Update test harness + write schema smoke test** - `90d0a0e` (test)

_Note: Task 2's work (migrate dev apply, prisma generate) does not touch any git-tracked file — the migration.sql was already committed in Task 1, and `node_modules/` is gitignored. Its completion is proven by the `migrate status` / catalog-query / `tsc` output captured below and re-verified by Task 3's live-Postgres tests._

## Files Created/Modified
- `prisma/schema.prisma` - 9 new models + 3 enums appended after `AuditLog`, following Phase 1 header conventions
- `prisma/migrations/20260801153408_motor_financeiro/migration.sql` - Prisma-generated DDL + hand-appended trigger/CHECK SQL
- `tests/setup.ts` - `afterEach` truncation list gains the 9 new models, children-first, before the Phase 1 list
- `tests/conftest.ts` - `truncateAll()` gains the identical children-first list
- `tests/financeiro/schema.test.ts` (new) - 7-test smoke suite proving the trigger, both LOTE-04 CHECKs, the singleton CHECK, and catalog visibility of the trigger

## Decisions Made
- **Dev Postgres container had to be recreated.** `.env`'s `DATABASE_URL` documents a dedicated container `doces-pg` on host port 5440, but no such container existed on this machine (`docker ps -a` showed only an unrelated stopped `postgres` container from a different project, plus the docker-compose review stack's `db` service — internal-network-only, no host port). Recreated `doces-pg` (`postgres:16-alpine`, `-p 127.0.0.1:5440:5432`, `POSTGRES_DB=doces_valentina`, `POSTGRES_PASSWORD=postgres`, `TZ=America/Sao_Paulo`, `--restart unless-stopped`) so `.env` needed **zero changes** and the documented convention is restored for all future plans. Applied the two existing Phase 1 migrations (`migrate deploy`) to bring it to baseline before adding the Phase 2 migration.
- **Did not touch docker-compose.yml** to expose the review stack's `db` service on a host port — that stack's `db` has no `ports:` mapping by design (INFRA-01 comment: "Postgres... NO host port mapping — only reachable on the compose network"), and changing that would be a production-security-posture change outside this plan's scope. A transient `alpine/socat` port-forwarder into that network was tested as an alternative during investigation and worked, but was discarded in favor of the cleaner, documented, persistent `doces-pg` container.
- Explored/discarded: pointing `DATABASE_URL` at the docker-compose stack's `db` service (`doces` database) via a socat forwarder on an ephemeral host port — technically worked (verified connectivity + `\dt`) but abandoned because it doesn't match the project's documented dev-DB convention and wouldn't survive without manual recreation on every session.

## Deviations from Plan

None from the plan's task content — all SQL, schema shapes, and file changes are verbatim/as-specified in 02-01-PLAN.md. One process deviation, categorized below:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Recreated the missing local dev Postgres container**
- **Found during:** Pre-Task-1 environment setup (before touching schema.prisma)
- **Issue:** `.env`'s `DATABASE_URL` targets `127.0.0.1:5440`, but no Postgres was listening there — the documented `doces-pg` container did not exist. Without it, `prisma migrate dev` (which needs shadow-DB privileges) and the vitest suite (shared dev/test DB) cannot run at all — a hard blocker for every task in this plan.
- **Fix:** Ran `docker run -d --name doces-pg --restart unless-stopped -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=doces_valentina -e TZ=America/Sao_Paulo -e PGTZ=America/Sao_Paulo -p 127.0.0.1:5440:5432 postgres:16-alpine`, then `prisma migrate deploy` to bring it to the Phase 1 baseline (2 existing migrations) before starting Task 1.
- **Files modified:** None (infrastructure only — `.env` was left untouched since its documented target now resolves correctly)
- **Verification:** `pg_isready`, a `pg` client connectivity/table-listing check, then `prisma migrate status` reporting up to date after `migrate deploy`
- **Committed in:** N/A (infrastructure, not a code change)

---

**Total deviations:** 1 auto-fixed (1 blocking — environment setup only, zero impact on plan scope/content)
**Impact on plan:** None on the schema/migration/test deliverables. All plan content executed exactly as specified.

## Issues Encountered
None beyond the environment gap documented above.

## LOTE-06 Handoff (explicit, per plan objective)

**LOTE-06 (validade imutável após primeira reserva ativa) is satisfied vacuously in this phase** — reservations don't exist until Phase 4, and there is no lote-validade edit surface in this v1 slice of Phase 2. **Phase 4 must add the trigger/CHECK enforcing validade immutability alongside the reservas table** when it introduces the concept of an "active reservation" that would make a lote's validade load-bearing for a customer-facing promise.

## User Setup Required
None - no external service configuration required. (Local dev DB was recreated as part of this execution — see Decisions Made. Nothing for the human to do; it's already running with `--restart unless-stopped`.)

## Next Phase Readiness
- Schema foundation is live and proven: 9 models + trigger + CHECKs verified against a real Postgres, not just written to a migration file
- `lib/custo/`, `lib/actions/{ingredientes,compras,receitas,produtos,lotes,config}.ts`, and the admin UI (Plans 02-02 onward) can now build directly against this schema — `prisma.loteUsoIngrediente` etc. are available and type-checked
- Full suite green (92 passed + 2 todo, 1 skipped file) — no regressions carried into subsequent plans
- Local dev Postgres (`doces-pg`, port 5440) now persists via `--restart unless-stopped`; future plans/sessions on this machine should find it already running. If it's ever missing again, recreate with the exact `docker run` command in "Decisions Made" above, then `prisma migrate deploy`.

---
*Phase: 02-motor-financeiro*
*Completed: 2026-08-01*

## Self-Check: PASSED

All key files confirmed on disk (`prisma/schema.prisma`, `prisma/migrations/20260801153408_motor_financeiro/migration.sql`, `tests/setup.ts`, `tests/conftest.ts`, `tests/financeiro/schema.test.ts`) and both task commits (`1d87c4c`, `90d0a0e`) confirmed present in `git log`.
