# Phase 1: Foundation - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Infraestrutura defensável (Docker Compose + Cloudflare proxy + UFW + rate limit) na VPS única, schema-base com `numeric(19,4)` + `timestamptz` (`TZ=America/Sao_Paulo`), auth completa (cliente: cadastro inteligente email-first, OWASP reset, sessões; admin único da mãe), LGPD baseline (export JSON, anonimização, +18, termos/privacidade versionados, DPO no rodapé), audit_log mínimo, e Resend + svix prontos para Phase 4 usar.

Phase 1 NÃO entrega: catálogo, produtos, ingredientes, lotes, reservas, pontos, sorteios, sazonalidade, relatórios, painéis admin de domínio. Só o que assenta a fundação.

</domain>

<decisions>
## Implementation Decisions

### Página inicial `/` em Phase 1 (sem catálogo)

- **D-01:** Visitante não-logado em `/` vê **landing simples + 2 CTAs**. Hero curto: "Em breve: reserva os doces caseiros da Valentina" + brand wordmark Fraunces (UI-SPEC §Typography) + 2 parágrafos institucionais (1-2 frases cada, voz "vizinha" per UI-SPEC §Brand & Voice Guardrails) + 2 botões: **"Criar minha conta"** (primary, accent `#9D2D7A`, leva a `/cadastro`) + **"Entrar"** (secondary, surface+border, leva a `/entrar`). Quando Phase 3 chegar, esse `/` vira a vitrine.

- **D-02:** Cliente já logado em `/` vê a **mesma landing visualmente, com CTAs trocados**: "Minha conta" (primary, leva a `/minha-conta/meus-dados`) + "Sair" (secondary, `POST /api/auth/sair`). O hero/copy continua igual — não vira app-shell. Estado `?logged-in?` resolvido por Server Component lendo a sessão; sem flicker.

- **D-03:** **Footer fino global** em todas as surfaces públicas + cliente (`/`, `/cadastro`, `/entrar`, `/esqueci-minha-senha`, `/redefinir-senha/[token]`, `/auth/confirmar-email/[token]`, `/minha-conta/*`, `/termos`, `/privacidade`). Conteúdo: `Doces Valentina · [Termos] · [Privacidade] · Dúvidas sobre seus dados? dpo@docesvalentina.com.br`. 1 linha em mobile (wrap natural), 2 linhas em ≥md. Footer **NÃO aparece** no `/admin/*` (admin shell tem layout próprio com sidebar — UI-SPEC §Mobile-First Layout Contract).

- **D-04:** Mãe logada (sessão admin) abrindo `/` vê a **landing pública igual ao visitante**, mas o header troca o CTA do canto direito para **"Painel admin"** (primary, leva a `/admin`) + **"Sair"** (secondary). Comportamento intencional: permite a ela testar como cliente vê o site sem precisar deslogar.

### Bootstrap e operação do admin único

- **D-05:** Primeiro acesso admin via **CLI seed**. Script `pnpm seed:admin` (a ser criado em Phase 1) lê `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` do `.env` da VPS, valida (email format, senha ≥8 chars), hasheia argon2id (parâmetros OWASP per AUTH-06), insere em `users` com `role='admin'` e `email_verified_at=NOW()` (admin pula verificação de email do fluxo de cadastro), grava em audit_log com `action='admin_seed_via_cli'`. Sem rota web, sem dependency em Resend pra bootstrap. Mãe recebe a senha pessoalmente do dev e troca depois pelo fluxo de reset normal.

- **D-06:** **Conta única com role enum** em `users`. Coluna `role` (enum `admin | customer`, default `customer`, NOT NULL). 1 usuário = 1 role. Admin (mãe) não tem `/minha-conta/*` — middleware redireciona pra `/admin` se `role='admin'` acessar `/minha-conta/*`. Cliente não tem `/admin/*` — middleware retorna 403 com copy "Essa parte é só pra administradora..." (UI-SPEC §Error/fallback copy). Para a mãe testar como cliente, ela cria conta secundária com email pessoal dela (email diferente do admin).

- **D-07:** Reset de senha admin via **CLI break-glass**, NÃO via web. Mesmo script `pnpm seed:admin --reset` aceita flag `--reset` que: encontra usuário com `role='admin'` (deve haver exatamente 1 — falha se 0 ou >1), hasheia nova senha do `.env` (`ADMIN_RESET_PASSWORD`), atualiza, revoga todas as sessões ativas do admin, grava em audit_log com `action='admin_password_reset_via_cli'`. `/admin` **não tem rota web de reset** — mam liga, dev acessa SSH e roda. Sem dependency em Resend pra recovery, sem janela de ataque por enumeração.

- **D-08:** Sem **email proativo** em login admin. Cada login admin grava em `audit_log` com `action='admin_login'` + IP + user-agent (per AUTH-11), mas **não dispara email**. Mam vê o histórico em `/admin/auditoria` (UI-SPEC §Surface Inventory). Reduz ruído (mam loga várias vezes ao dia em celular/tablet); se virar problema de segurança em v1.x, adicionar email-on-novo-IP via heurística do hash truncado depois.

### Claude's Discretion

Áreas não-selecionadas pela usuária para discussão — researcher e planner decidem com base em pitfalls/research:

- **Conteúdo de Termos & Privacidade v1**: Phase 1 entrega o **shell estrutural** das rotas `/termos` e `/privacidade` (UI-SPEC §Surface Inventory) com **conteúdo placeholder pt-BR baseado em template padrão** (LGPD-03 já lista os operadores reais — Resend EUA, Cloudflare, hospedagem — esses precisam estar corretos no placeholder pra cumprir a lei). `terms_version` e `privacy_version` no schema `users` (LGPD-02) ficam como `'v1.0-shell'`. Revisão jurídica leve fica como item v1.x antes do launch público real (research/PITFALLS.md ref). O fluxo de cadastro **não bloqueia** por causa do placeholder — checkbox + versionamento funcionam normalmente.

- **Audit log granularidade e schema**: Schema **genérico desde Phase 1** pra evitar migration em Phase 2. Tabela `audit_log` com colunas `(id bigserial, actor_type text NOT NULL, actor_id uuid, action text NOT NULL, entity_type text, entity_id text, metadata jsonb, ip_hash text, ua_hash text, ts timestamptz NOT NULL DEFAULT now())`. Phase 1 popula apenas `action IN ('admin_login', 'admin_seed_via_cli', 'admin_password_reset_via_cli', 'customer_account_deleted')`. UI `/admin/auditoria` em Phase 1 lista **todos os eventos** (não filtra) ordenados desc por `ts`, com formato copy `{quando} — {quem} — {ação}` per UI-SPEC §Admin copy. Phase 2+ popula `action='preco_alterado'`, `action='lote_criado'`, `action='reserva_confirmada'` etc. sem migration.

- **Rate limit backend**: in-memory single-instance (single VPS, single Next.js container — sobrevive a deploy mas não a restart, é aceitável pra v1). Per-IP em `/api/auth/*` (10 req/min sliding window) e per-email em `/api/auth/esqueci-senha` (3 req/15min). Implementação via library leve (`@upstash/ratelimit` em modo memory ou similar — researcher decide). Quando crescer, migra pra DB-backed sem Redis (PROJECT.md travou "sem Redis").

- **Página `/` raiz para sessão admin com cookie cliente**: edge-case improvável (mãe nunca terá conta cliente com mesmo browser). Comportamento: prevalece cookie/sessão mais recente; sem dialog. Se ambos cookies presentes (race), middleware lê admin primeiro.

</decisions>

<specifics>
## Specific Ideas

- "A página inicial em Phase 1 funciona como **placeholder narrativo** — não vai ficar assim pra sempre. Phase 3 substitui por vitrine. Hero curto, sem prometer prazo." — derivado da decisão D-01.
- "Mãe vai usar quase tudo no celular durante produção. Header tem que ter atalho 'Painel admin' a 1 clique de qualquer surface, não escondido em menu." — D-04, alinhado com PROJECT.md §Operação.
- "Senha inicial da mãe é entregue pessoalmente pelo dev — não rola via email. Quando ela trocar pelo fluxo de reset, aí Resend entra em jogo." — D-05.
- "Audit log em Phase 1 visualmente é 'tabela do que aconteceu'. Mãe não vai entender termos como 'IP' ou 'user-agent' — esses ficam em metadata escondido (clicável pra expandir em row); a linha visível usa copy descritivo ('você entrou no painel', 'cliente excluiu conta')." — derivado de UI-SPEC §Admin copy + D-08.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these antes de pesquisar ou planejar.**

### Visão de produto e escopo
- `.planning/PROJECT.md` — Vision, core value, constraints, key decisions, requisitos validated/active/out-of-scope
- `.planning/REQUIREMENTS.md` §INFRA + §AUTH + §LGPD — 29 REQ-IDs do escopo de Phase 1, defaults configuráveis, mapeamento de traceability
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria (5 critérios), depends-on (nothing — primeira fase)

### Design contract (LOCKED — UI executor segue 1:1)
- `.planning/phase-1-foundation/01-UI-SPEC.md` — **canonical para todo UI de Phase 1**: 14 surfaces (4 públicas pós-cadastro, 2 LGPD, 2 termos, 6 admin), paleta pink-bordô (`#9D2D7A` accent / `#FFF6FB` background / `#ED91DB` accent-soft), Geist Sans+Mono+Fraunces, copy literais pt-BR (auth + LGPD + admin + erros), spacing 8pt, AA mínimo, touch 44px, sem hover-only, sticky CTA em forms longos, autocomplete attrs locked, sonner toast position. Status: approved 2026-04-30 com 1 FLAG não-bloqueante em Visuals.

### Stack research (LOCKED — não relitigar sem nova /gsd-discuss-phase)
- `.planning/research/SUMMARY.md` — sintese das 4 dimensões, decisões travadas
- `.planning/research/STACK.md` — Next.js 16 + React 19 + Drizzle + postgres.js + Better Auth + argon2id + Resend + pg-boss + Caddy + Cloudflare proxy + shadcn/ui + Radix + lucide + sonner + decimal.js + pino + @t3-oss/env-nextjs
- `.planning/research/ARCHITECTURE.md` — App Router structure, instrumentation.ts, middleware patterns, Server Actions allowedOrigins, CSP
- `.planning/research/FEATURES.md` §7.2 — a11y rules (16px floor, AA/AAA contrast, 44px touch, no hover-only, no color-only status), voz exemplar pt-BR
- `.planning/research/PITFALLS.md` — pitfalls relevantes Phase 1 (numeric vs float, argon2id params, OWASP reset, Cloudflare proxy + Caddy cert strategy, UFW + CF IP allowlist, rate limit sem Redis, pino redact PII, instrumentation.ts boot pg-boss, env validation no build)

### Plataforma e versão
- `node_modules/next/dist/docs/` — **Next.js 16 tem mudanças que quebram com training data dos LLMs** (AGENTS.md raiz e CLAUDE.md raiz alertam). Researcher e planner consultam ANTES de propor APIs do Next.

### Estado atual
- `.planning/STATE.md` — current focus, accumulated context, blockers/concerns, deferred items (OPS-01..06, SEC-01..03 são v1.x, NÃO em Phase 1)

### Sem específicos para Phase 1 (não há ADRs separados ainda)
Phase 1 é a primeira fase do projeto; não há decisões de outras fases pra carregar. PROJECT.md "Key Decisions" é a única fonte de decisões prévias e já foi consumido na análise.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/layout.tsx` — scaffold default Next.js 16 com Geist Sans + Geist Mono já wired (UI-SPEC §Design System mantém). Layout root vai precisar reorganização: header global (wordmark Fraunces + CTAs condicionais por sessão) + `{children}` + footer global (D-03). Admin layout em `app/(admin)/layout.tsx` separado, sem footer.
- `app/globals.css` — Tailwind v4 com PostCSS plugin já wired. UI-SPEC §Color define todas as CSS vars (`--color-background`, `--color-accent`, etc.) — vão entrar aqui via shadcn `init` + override manual.
- `next.config.ts` — `reactCompiler: true` já configurado (atende INFRA-12 sem mudança).
- `package.json` — base Next 16.2.4 + React 19.2.4 + TypeScript 5 + Tailwind 4 + `babel-plugin-react-compiler@1.0.0` instalados. Faltam: Drizzle, postgres.js, Better Auth, argon2 (lib argon2id), Resend SDK, pg-boss, decimal.js, pino, @t3-oss/env-nextjs, svix, date-fns, shadcn registry components, sonner, Fraunces font.

### Established Patterns
- **Scaffold default não-substituído**: `app/page.tsx` ainda é o template Vercel ("Deploy Now" + "Documentation" + Vercel logo). Phase 1 substitui por landing D-01.
- **AGENTS.md raiz alerta sobre Next 16 ter mudanças que quebram com training data** — todo planner/executor deve ler `node_modules/next/dist/docs/` antes de propor uso de APIs (`headers()`, middleware, Server Actions, `instrumentation.ts`, route handlers).
- **shadcn ainda não inicializado** (UI-SPEC `shadcn_initialized: false`). Executor de Phase 1 roda `npx shadcn init` cedo, com preset new-york + neutral baseColor + override manual das CSS vars per UI-SPEC §Color.

### Integration Points
- `app/layout.tsx`: header global + footer global (D-03) + provider de sonner toast.
- `middleware.ts` (criar): proteção de `/admin/*` (role='admin') + redirect de `/minha-conta/*` se role='admin' (D-06) + `allowedOrigins` para Server Actions (INFRA-05).
- `instrumentation.ts` (criar): boot pg-boss workers (INFRA-11). Phase 1 ainda não tem worker de domínio mas instrumentation precisa estar pronto pra Phase 4 plugar email.
- `lib/auth.ts` (criar): Better Auth config — adapter Drizzle, sessões DB, argon2id, role flag, +18 + terms_version + privacy_version no schema users.
- `lib/db/schema/` (criar): tabelas iniciais — `users`, `sessions`, `verification_tokens`, `password_reset_tokens`, `audit_log`. Tudo `numeric(19,4)` para money (Phase 1 ainda não tem money column, mas o tipo já é convenção schema-wide), `timestamptz` para dates.
- `scripts/seed-admin.ts` (criar): CLI seed/reset (D-05, D-07). Lê `.env`, hasheia argon2id, insere/atualiza, escreve audit_log.
- `app/api/auth/[...path]/route.ts` (criar): Better Auth handler.

</code_context>

<deferred>
## Deferred Ideas

Ideias que apareceram durante a discussão mas pertencem a outras fases ou v1.x:

- **Email-on-novo-IP em login admin** (D-08 alternativa rejeitada): heurística de hash truncado de IP+UA detectando dispositivo novo e disparando email "Novo dispositivo entrou no painel". Adicionar em v1.x se virar problema de segurança real. Complexidade não justifica em v1 com 1 admin.
- **Dual-role na mesma conta** (D-06 alternativa rejeitada): admin + cliente coexistindo no mesmo user. Re-avaliar se v2 ganhar admin secundário (multiplos admins ou ajudantes — parte de OPS-04 deferido).
- **UI 'primeiro setup' guarded por flag** (D-05 alternativa rejeitada): self-service bootstrap. Útil se projeto virar template/produto distribuível; irrelevante pra single-tenant da Doces Valentina.
- **Email-reset admin compartilhado com cliente** (D-07 alternativa rejeitada): reset web pro admin via mesmo fluxo OWASP. Pode ser adicionado em v1.x se CLI ficar atrito; por ora controle manual via dev é mais seguro.

### Reviewed Todos (não folded)

Nenhum — não há todos pendentes em STATE.md (`Pending Todos: Nenhum`).

### Out-of-scope discussion

Nenhuma sugestão de feature nova surgiu durante a discussão (todas as áreas focaram em "como" implementar o que já está em REQUIREMENTS.md / ROADMAP.md / UI-SPEC.md). Scope guardrail manteve a discussão dentro do domínio.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-30*
*Mode: discuss (default)*
