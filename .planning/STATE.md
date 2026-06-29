# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Sua mãe enxerga o lucro real de cada doce vendido (custo rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 3 de 11 executados (01-01/02/03 done; 01-04..01-11 planejados e verificados, prontos pra executar)
Status: gap plans prontos — /gsd-plan-phase 1 --gaps gerou 8 planos (01-04..01-11) cobrindo os 17 requisitos órfãos + 2 parciais; gsd-plan-checker PASSED (1 ciclo de revisão: corrigidos loop /admin/entrar, link verificação 24h, rate limit /api/auth/*). Próximo: /gsd-execute-phase 1 --gaps-only.
Last activity: 2026-06-29 — /gsd-execute-phase 1 (3 planos, 16/16 testes) → gaps_found → /gsd-plan-phase 1 --gaps (8 planos verificados, waves 2-6). Fase ainda NÃO completa.

Progress: [█░░░░░░░░░] ~13% (auth core + base técnica prontos; infra/LGPD/email/UI pendentes)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisões iniciais (registradas em PROJECT.md "Key Decisions" + research/SUMMARY.md):

- Stack travado: Next.js 16 (App Router) + Postgres 16 + **Prisma 7** (revisado de Drizzle em 2026-04-30) + Better Auth (adapter Prisma) + Resend + pg-boss + Caddy + Cloudflare Proxy
- Money em `numeric(19,4)` schema-wide; datas em `timestamptz` com TZ=America/Sao_Paulo
- Custo histórico imutável: lote denormaliza `marca_snapshot` + `custo_congelado` (FK pra `ingrediente_compra_id`)
- Saldo de pontos derivado por SUM em ledger imutável (sem coluna em `clientes`)
- Estoque com 2 colunas: `qtde_disponivel` + `qtde_reservada` (soft hold via SELECT FOR UPDATE)
- Email NUNCA dentro de transação SQL (pg-boss enfileira após COMMIT)
- v1 só retirada (`delivery_mode='PICKUP_ONLY'` enum desde já, UI esconde a opção)
- Hardening operacional pesado (Fase 7 da research) DEFERIDO para v1.x; LGPD baseline e bloqueadores técnicos permanecem em v1

### Pending Todos

Nenhum.

### Blockers/Concerns

- **UX testing presencial com a mãe** é gate obrigatório antes de fechar Phase 4 (research Pitfall 6.1)
- **Revisão jurídica leve** sobre Lei 5.768/71 (sorteios) antes de fechar Phase 5 (research Pitfall + SORT-08)
- **Decisões em aberto** ainda a calibrar antes de planos respectivos: ratio de pontos default (1pt=R$1?), janela de cancelamento default (24h?), MFA admin (email-code vs TOTP — NOTE: MFA está em SEC-01 deferido, mas se decidir mover pra v1, planejar em Phase 1)

## Deferred Items

Items acknowledged and carried forward (consolidados em ROADMAP.md "Deferred for v1.x"):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Operações | Backup com drill mensal automático (OPS-01) | Deferido para v1.x | 2026-04-29 (init) |
| Operações | Monitoring externo Better Stack + /api/health (OPS-02) | Deferido para v1.x | 2026-04-29 (init) |
| Operações | OPERATIONS.md pt-BR (OPS-03) | Deferido para v1.x | 2026-04-29 (init) |
| Operações | Bitwarden + dev secundário (OPS-04, bus factor) | Deferido para v1.x | 2026-04-29 (init) |
| Operações | Cloudflare granular WAF + Turnstile (OPS-05) | Deferido para v1.x | 2026-04-29 (init) |
| Operações | Status de backup visível (OPS-06) | Deferido para v1.x | 2026-04-29 (init) |
| Segurança | MFA admin (SEC-01) | Deferido para v1.x | 2026-04-29 (init) |
| Segurança | Linter ANVISA com alerta amarelo (SEC-02) | Deferido para v1.x | 2026-04-29 (init) |
| Segurança | Anonimização programada após 5 anos (SEC-03) | Deferido para v1.x | 2026-04-29 (init) |

## Session Continuity

Last session: 2026-04-30
Stopped at: Phase 1 plan-phase pausado pra revisão de stack — D-09 ORM swap (Drizzle→Prisma 7) aprovado, Cloudflare proxy mantido. Docs atualizados (PROJECT.md, AGENTS.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, CONTEXT.md, research/STACK+SUMMARY+ARCHITECTURE+PITFALLS). Pronto para retomar `/gsd-plan-phase 1` com decisão de research first vs skip.
Resume file: .planning/phase-1-foundation/01-CONTEXT.md (D-09 é a decisão mais recente)
