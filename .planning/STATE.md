# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Sua mãe enxerga o lucro real de cada doce vendido (custo rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 01-06 executado (wave 3) — 01-01/02/03/04/06 done (01-05 em execução paralela); 01-07..01-11 prontos
Status: 01-06 executado — pg-boss boot harness via instrumentation.ts (INFRA-11, schema 'pgboss'), rate limit em memória (rateLimitAuth 10/60s + rateLimitForgotEmail 3/15min) e throttle no boundary /api/auth/* do proxy.ts (11º POST sensível → 429, INFRA-04/SC4). 36/38 testes (2 todo), tsc limpo. Próximo: /gsd-execute-phase 1 (01-07..01-11).
Last activity: 2026-06-29 — /gsd-execute-phase 1 plan 01-06 (3 tasks TDD, 6 commits, 36/38 testes verdes). Fase ainda NÃO completa.

Progress: [███░░░░░░░] ~27% (auth core + email/audit + job harness + rate limit prontos; infra deploy/LGPD/UI pendentes)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 (01-04, 01-06) | 19 min | 9.5 min |

**Recent Trend:**
- Last 5 plans: 01-06 (9 min, 3 tasks TDD, 8 files), 01-04 (10 min, 3 tasks, 10 files)
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
- (01-04) `logAudit` absorve o hashing de IP/UA — call sites passam raw, helper sha256; plaintext nunca chega no audit_log (Pitfall #9)
- (01-04) Callbacks de email são fire-and-forget (`void sendXxx`) pra não bloquear a Server Action (T-01-04-04); Phase 4 move pra pg-boss
- (01-04) `emailVerification.expiresIn = 24h` alinha o backend ao copy do email (default Better Auth era 1h) — AUTH-04
- (01-06) pg-boss roda em schema dedicado `pgboss` (tables auto-criadas no `boss.start()` não poluem `public`; migrations Prisma ignoram) — INFRA-11
- (01-06) `instrumentation.register()` guarda em `NEXT_RUNTIME==='nodejs'` (pg-boss precisa de pool Postgres, não roda no Edge); `boss.start()` idempotente
- (01-06) Rate limit aplicado no BOUNDARY (proxy.ts), não só nas Server Actions — o catch-all do Better Auth é diretamente alcançável; sem isso seria bypass de brute-force (INFRA-04/SC4). Mesmo `RateLimiterMemory` in-process é compartilhado com as Server Actions do Plan 08 (defesa em profundidade)
- (01-06) `RateLimiterMemory` (rate-limiter-flexible) em vez de `@upstash/ratelimit` (Upstash não tem modo memory, exige Redis); reset por processo aceito p/ v1 single-VPS
- (01-06) pg-boss@12 usa export nomeado `{ PgBoss }` (sem default) — corrigido o snippet verbatim da RESEARCH que era de major anterior (pego pelo tsc)

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

Last session: 2026-06-29
Stopped at: Completed 01-06-PLAN.md (pg-boss boot harness INFRA-11 + rate limit boundary INFRA-04). 36/38 testes verdes (2 todo), tsc limpo. Próximo plano: 01-07.
Resume file: None
