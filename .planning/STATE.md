# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Sua mãe enxerga o lucro real de cada doce vendido (custo rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 01-07 executado (wave 4) — 01-01/02/03/04/06/07/09 done (01-05 em execução paralela); 01-08/10/11 prontos
Status: 01-07 executado — shell visual completo: shadcn (preset radix-nova) + 10 componentes oficiais + paleta pink-bordô da UI-SPEC mapeada sobre os tokens shadcn (--primary #9D2D7A, --background #FFF6FB); root layout pt-BR (Fraunces, viewport, Toaster); header RSC com CTAs por sessão (D-01/D-02/D-04) + logout server action; footer global com DPO (D-03/LGPD-06); landing 3-variant + /termos (LGPD-02) + /privacidade (LGPD-03, operadores reais). D-03 garantido por route group: Header/Footer no app/(public)/layout.tsx, group (admin) irmão sem footer. LGPD-02/03/06 fechados. Checkpoint visual aprovado ("visual ok"). 44/46 testes (2 todo), tsc limpo. Próximo: /gsd-execute-phase 1 (01-08/10/11).
Last activity: 2026-06-29 — /gsd-execute-phase 1 plan 01-07 (2 tasks + checkpoint human-verify, 4 commits, 44/46 testes verdes; fix CSP dev unsafe-eval). Fase ainda NÃO completa.

Progress: [████░░░░░░] ~38% (auth core + email/audit + job harness + rate limit + admin bootstrap + design system/shell/LGPD-shell prontos; infra deploy + auth UI forms + LGPD export/delete pendentes)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 (01-04, 01-06, 01-07, 01-09) | 121 min | 30.3 min |

**Recent Trend:**
- Last 5 plans: 01-07 (99 min wall / ~45 min ativo, 2 tasks + checkpoint, 22 files), 01-09 (3 min, 1 task TDD, 2 files), 01-06 (9 min, 3 tasks TDD, 8 files), 01-04 (10 min, 3 tasks, 10 files)
- Trend: 01-07 inflado por espera de checkpoint visual humano (gate bloqueante)

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
- (01-09) seed-admin CLI forja uma sessão admin assinada (Session row + cookie HMAC base64 padrão, nome do cookie lido de `auth.$context` p/ `__Secure-` em prod) para autorizar `auth.api.setUserPassword`/`revokeUserSessions` — esses endpoints do admin-plugin rodam atrás de `adminMiddleware` e lançam UNAUTHORIZED sem sessão; o snippet verbatim da RESEARCH chamava-os sem headers
- (01-09) `seedAdmin()`/`resetAdmin()` exportados com override opcional de senha (default lê env) p/ testabilidade; `main()` só roda em execução direta (`import.meta.url === argv[1]`) p/ os testes importarem sem disparar seed
- (01-07) D-03 (footer ausente em /admin/*) resolvido por árvore de layouts: Header/Footer vivem em `app/(public)/layout.tsx` (route group), NÃO no root; o group `(admin)` é irmão com shell próprio sem footer. Landing e minha-conta movidas p/ `(public)` (URLs inalteradas). Padrão p/ Plans 08/10/11: novas surfaces públicas/cliente vivem sob `(public)` p/ herdar o shell
- (01-07) Tokens da UI-SPEC mapeados SOBRE o sistema shadcn (UI-SPEC "accent" #9D2D7A = shadcn `--primary`; "surface" = `--card`/`--popover`) — componentes oficiais herdam a marca sem patch; Phase 6 sobrescreve via CSS vars. Dark mode confirmado fora de escopo Phase 1 (light-only, reativa em Phase 6)
- (01-07) shadcn v3 (CLI nova): preset por nome (Nova = Lucide/Geist, baseColor neutral) + pacote unificado `radix-ui` — `--base-color`/style "new-york" da spec não existem mais; `npx` é interceptado pelo hook rtk (invocar binário por caminho absoluto). Componente `form` adiado p/ Plans 08/10 (no-op silencioso no registry radix-nova; precisa react-hook-form)
- (01-07) CSP `unsafe-eval` só em dev (`NODE_ENV!=production`) em `proxy.ts` — React dev mode exige eval(); produção continua estrita (nonce + strict-dynamic), T-01-07-01 intacto

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
Stopped at: Completed 01-07-PLAN.md (shell visual — shadcn + paleta pink-bordô + header/footer/toaster + landing + /termos + /privacidade; LGPD-02/03/06). Checkpoint visual aprovado. 44/46 testes verdes (2 todo), tsc limpo. Próximo plano: 01-08/10/11.
Resume file: None
