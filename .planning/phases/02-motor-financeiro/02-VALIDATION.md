---
phase: 2
slug: motor-financeiro
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
updated: 2026-07-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by gsd-planner (2026-07-03) from 02-RESEARCH.md §Validation Architecture + plan set 02-01..02-11.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (environment node, Postgres real via Prisma 7 driver adapter) |
| **Config file** | `vitest.config.ts` (fileParallelism: false — DB único; NÃO paralelizar) |
| **Quick run command** | `rtk npx vitest run tests/financeiro --reporter=dot` |
| **Full suite command** | `rtk npm test` |
| **Estimated runtime** | ~30–60 s (suite completa) |

⚠️ **Test DB == dev DB** (memória do projeto): rodar a suite trunca as tabelas. Não manter dados manuais no dev DB durante a execução da fase.

---

## Sampling Rate

- **After every task commit:** Run `rtk npx vitest run tests/financeiro --reporter=dot`
- **After every plan wave:** Run `rtk npm test` (73/75 da Phase 1 continuam verdes)
- **Before `/gsd-verify-work`:** Full suite green + LOTE-08 passing + `rtk next build` clean
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ING-04/07, LOTE-04 | T-02-01/02/03 | SQL custom presente na migration | grep gate | `grep -c trg_compra_imutavel prisma/migrations/*motor_financeiro/migration.sql` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | (migration aplicada) | — | schema vivo == migrations | CLI | `prisma migrate status` + `rtk npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | ING-07, LOTE-04, D-03 | T-02-01/02/03 | trigger/CHECK bloqueiam no PG vivo | integration | `rtk npx vitest run tests/financeiro/schema.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-02-01..03 | 02 | 1 | PROD-10 | T-02-04 | registry oficial only | grep + tsc | `test -s components/ui/form.tsx` + `rtk npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 2 | (parser dinheiro) | T-02-08 | nunca Number()/parseFloat | unit | `rtk npx vitest run tests/financeiro/decimal.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-03-02 | 03 | 2 | ING-05, REC-05, LOTE-03 | T-02-07 | $queryRaw tagged only | tsc + grep | `grep -rc queryRawUnsafe lib/` == 0 | ✅ | ⬜ pending |
| 02-03-03 | 03 | 2 | REC-05, PROD-08, D-11, A1 | — | — | unit/integration | `rtk npx vitest run tests/financeiro/custo-corrente.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-04-01/02 | 04 | 3 | ING-01/02/03/06, D-01..04 | T-02-06/07/09 | requireAdmin + canonicalize allowlist | tsc + grep | grep gates no plano | ✅ | ⬜ pending |
| 02-04-03 | 04 | 3 | ING-03/04/05/07 | T-02-06 | EoP customer rejeitado | integration | `rtk npx vitest run tests/financeiro/compras.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-05-01 | 05 | 3 | REC-01..05 | T-02-06/11 | safeParse server + EoP | integration | `rtk npx vitest run tests/financeiro/receitas.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-05-02/03 | 05 | 3 | REC-05 (UI) | — | — | tsc + grep | `rtk npx tsc --noEmit` + copy greps | ✅ | ⬜ pending |
| 02-06-01 | 06 | 3 | PROD-01/02/08/09, D-10/11 | T-02-13/14/15 | bloqueio server-side | tsc + grep | grep gates no plano | ✅ | ⬜ pending |
| 02-06-02 | 06 | 3 | PROD-09 (O teste EoP da fase) | T-02-06/13 | customer não muta nada | integration | `rtk npx vitest run tests/financeiro/produtos.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-07-01 | 07 | 3 | **LOTE-08**, LOTE-01/02/03, D-05/06/07 | T-02-13/01/16 | snapshot recomputado server-side | **integration — MANDATÓRIO** | `rtk npx vitest run tests/financeiro/custo-congelado.test.ts` | ❌ W0 (RED first) | ⬜ pending |
| 02-07-02 | 07 | 3 | LOTE-04/07, Pitfall 10 | — | — | integration | `rtk npx vitest run tests/financeiro/lotes.test.ts` | ❌ W0 (criado na task) | ⬜ pending |
| 02-08-01..03 | 08 | 4 | ING-01/02/06/08 (UI) | T-02-17/18/19 | preview client é cortesia | tsc + copy greps + suite | comandos nos planos | ✅ | ⬜ pending |
| 02-09-01..03 | 09 | 4 | PROD-08/09 (UI), D-09/10/11 | T-02-13/18 | disabled é cortesia declarada | tsc + copy greps + suite | comandos nos planos | ✅ | ⬜ pending |
| 02-10-01/02 | 10 | 4 | LOTE-01/07 (UI), D-05..08 | T-02-13/18 | payload sem custo | tsc + copy greps + suite | comandos nos planos | ✅ | ⬜ pending |
| 02-11-01/02 | 11 | 5 | PROD-08 (home), audit copy | T-02-18/20 | metadata como texto | grep + full gate | `rtk npm test` + `rtk next build` | ✅ | ⬜ pending |
| 02-11-03 | 11 | 5 | ciclo completo (SC 1–5 roadmap) | — | — | **manual (checkpoint)** | roteiro de 12 passos no plano | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/setup.ts` + `tests/conftest.ts` — deleteMany dos 9 models novos, children-first (plano 02-01 Task 3)
- [ ] `tests/financeiro/schema.test.ts` — trigger/CHECK smoke (plano 02-01 Task 3)
- [ ] `tests/financeiro/fixtures.ts` — factories criarIngrediente/registrarCompra/criarReceita/criarProduto/produzirLote (plano 02-03 Task 3)
- [ ] `tests/financeiro/custo-congelado.test.ts` — LOTE-08 escrito ANTES da action de lote (plano 02-07 Task 1, RED→GREEN)
- [ ] Framework: nenhum install necessário (vitest + mocks next/headers já padronizados no 01-08)

Todos os arquivos MISSING são criados pela própria task que os exige (marcados "criado na task") — nenhum gap de sampling: nenhuma sequência de 3 tasks sem verify automatizado.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ciclo completo mobile (fluxos, copy, alertas visuais, derivação ao vivo, margem reativa) | SC 1–5 do roadmap Phase 2 | Verificação visual/interativa em viewport real | Roteiro de 12 passos no checkpoint do plano 02-11 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (cada arquivo é criado pela task que o exige)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-07-03
