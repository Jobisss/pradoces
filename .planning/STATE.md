# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Sua mãe enxerga o lucro real de cada doce vendido (custo rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 7 (Foundation)
Plan: 01-11 executado (wave 5) — 01-01/02/03/04/06/07/08/09/11 done (01-05 deploy em execução paralela; 01-10 login UI a executar em seguida)
Status: 01-11 executado — baseline LGPD funcional (LGPD-04/05/AUTH-09). lib/lgpd/export.ts (exportUserData select whitelist, sem password/token), anonymize.ts (anonimização por UPDATE: placeholder @anon.invalid, name/telefone limpos, deletedAt/anonymizedAt; deleteMany accounts+sessions na MESMA TX — Pitfall #8; logAudit customer_account_deleted fora da TX). Rotas GET /api/me/export (401/attachment/no-store, sempre session.user.id — anti-IDOR T-01-11-01) e POST /api/me/delete (gate typedEmail===session.user.email, 401/400, redirect /?msg=conta-excluida). Páginas /minha-conta/meus-dados e /minha-conta/excluir (typed-email gate sem dialog, form nativo POST) sob (public). 9 testes novos; suíte 70/72 (2 todo), tsc limpo. DESBLOQUEIO: criado scripts/dev-login.ts (npm run dev:login) — helper DEV-ONLY que forja sessão assinada — porque /entrar (Plan 10) e Resend (Plan 04 setup) ainda não existem; o cadastro JÁ persiste o user (verificado no banco), só não dava pra logar/confirmar email. Checkpoint human-verify: usuário autorizou continuação ("vai executando aí"). Próximo: executar 01-10 (login/reset/auditoria — entrega /entrar).
Last activity: 2026-06-30 — /gsd-execute-phase 1 plan 01-11 (2 tasks TDD/auto + checkpoint, 4 commits, 70/72 testes verdes; +helper dev-login p/ desbloquear verificação). Fase ainda NÃO completa (faltam 01-05 deploy e 01-10 login UI).

Progress: [██████░░░░] ~55% (auth core + email/audit + job harness + rate limit + admin bootstrap + design system/shell + auth Server Actions/cadastro UI + LGPD export/delete prontos; infra deploy + login/reset/auditoria UI pendentes)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5 (01-04, 01-06, 01-07, 01-08, 01-09) | 154 min | 30.8 min |

**Recent Trend:**
- Last 5 plans: 01-08 (~33 min ativo, wall-clock inflado por checkpoint human-verify; 2 tasks + checkpoint, 11 files), 01-07 (99 min wall / ~45 min ativo, 2 tasks + checkpoint, 22 files), 01-09 (3 min, 1 task TDD, 2 files), 01-06 (9 min, 3 tasks TDD, 8 files), 01-04 (10 min, 3 tasks, 10 files)
- Trend: planos com checkpoint humano (01-07, 01-08) inflam o wall-clock; tempo ativo permanece ~30-45 min

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
- (01-08) Endpoint forgot-password do Better Auth v1.6 é `auth.api.requestPasswordReset({ body: { email, redirectTo } })` — NÃO `forgetPassword` (a nota de interface do plano estava desatualizada; pego pelo tsc). `verifyEmail` retorna só `{ status }`, então o actorId do audit `customer_email_verified` é derivado do claim `email` do token JWT (best-effort, cai pra null sem quebrar)
- (01-08) Consentimento LGPD (+18/termos) validado com `z.boolean().refine(v===true)` (não `z.literal`) — checkbox desmarcado é HARD BLOCK antes de qualquer INSERT (LGPD-01/02); a action mapeia `'on'`/ausente → boolean real
- (01-08) Server Actions testáveis no runtime node: testes mockam `next/headers` (headers + cookies) e `next/navigation` (redirect); IP do contexto é mutável por teste p/ a asserção de rate limit. Padrão p/ Plans 10/Phase 4
- (01-08) Auth pages sob `app/(public)/` (herdam shell D-03, URLs inalteradas); rate limit nas actions é defesa-em-profundidade (limite primário no proxy/Plan 06, mesmas instâncias in-process)

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

Last session: 2026-06-30
Stopped at: Completed 01-08-PLAN.md (auth Server Actions + cadastro inteligente — 6 actions reais, Zod, anti-enum, rate-limit defesa-em-profundidade, LGPD consent, audit; cadastro email-first 2 passos + AUTH-03 + confirmar-email landing). Checkpoint human-verify aprovado ("cadastro ok"; confirmação via token mintado localmente — Resend pendente, user_setup Plan 04). 61/63 testes verdes (2 todo), tsc limpo. Próximo plano: 01-10/11.
Resume file: None
Setup pendente (não bloqueia código): verificar domínio docesvalentina.com.br no Resend (user_setup do Plan 04) para entrega real de email de confirmação/reset.
