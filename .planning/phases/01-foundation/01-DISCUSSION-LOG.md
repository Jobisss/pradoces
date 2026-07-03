# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Não usar como input para planning, research ou execution agents.
> Decisões canônicas estão em `01-CONTEXT.md`. Este log preserva opções apresentadas e seleções pra retrospectiva.

**Date:** 2026-04-30
**Phase:** 01-foundation
**Mode:** discuss (default)
**Areas selected by user:** Página inicial / em Phase 1, Bootstrap admin (1º acesso da mãe)
**Areas not selected (Claude's discretion):** Conteúdo dos Termos & Privacidade v1, Audit log scope

---

## Gray Area Selection (turn 1)

**Question:** Quais áreas você quer discutir para Phase 1 (Foundation)?

**Options apresentadas:**
1. ☐ Bootstrap admin (1º acesso da mãe) — CLI seed via env / UI primeiro setup / magic-link bootstrap
2. ☐ Página inicial / em Phase 1 (sem catálogo) — splash / redirect / landing institucional
3. ☐ Conteúdo dos Termos & Privacidade v1 — MD versionado / template / shell placeholder
4. ☐ Audit log — escopo do schema em Phase 1 — genérico vs mínimo

**User selection:** "Página inicial / em Phase 1 (sem catálogo)" + "Bootstrap admin (1º acesso da mãe)"

---

## Área 1: Página inicial `/` em Phase 1

### Q1.1 — Visitor não-logado em `/`

**Question:** Quando alguém sem login abre o site (`https://docesvalentina.com.br/`) em Phase 1 — antes do catálogo existir — o que aparece?

**Options:**
1. ☐ Landing simples + 2 CTAs (Recommended) — hero "Em breve, reserva..." + 2 botões (Criar / Entrar)
2. ☐ Redirect direto pra `/entrar`
3. ☐ Pre-launch institucional + wa.me — história + CTA WhatsApp da mãe
4. ☐ Splash 'em breve' sem auth visível — captura email pra avisar

**User selected:** Landing simples + 2 CTAs (Recommended)

→ **D-01** em CONTEXT.md

### Q1.2 — Cliente já logado em `/`

**Question:** E quando o cliente já está logado e abre `/` (ou clica no wordmark 'Doces Valentina' no header)?

**Options:**
1. ☐ Mesma landing, mas com 'Minha conta' + 'Sair' (Recommended)
2. ☐ Redirect automático pra `/minha-conta/meus-dados`
3. ☐ Landing igual a visitor + botão 'Minha conta' no header

**User selected:** Mesma landing, mas com 'Minha conta' + 'Sair' (Recommended)

→ **D-02** em CONTEXT.md

### Q1.3 — Footer global (LGPD-06)

**Question:** Footer global em Phase 1 (LGPD-06 pede DPO visível em rodapé). Como aplica?

**Options:**
1. ☐ Footer fino global em todas as surfaces (Recommended) — Doces Valentina · Termos · Privacidade · DPO email
2. ☐ Footer só em surfaces públicas + cliente — não em /minha-conta/*
3. ☐ Sem footer; DPO inline em /minha-conta + /privacidade

**User selected:** Footer fino global em todas as surfaces (Recommended) — exclui apenas `/admin/*`

→ **D-03** em CONTEXT.md

### Q1.4 — Mãe (admin logada) abrindo `/`

**Question:** Sua mãe abre `/` no celular dela enquanto já está logada como admin (sessão admin ativa). O que ela vê?

**Options:**
1. ☐ Landing pública + atalho 'Ir pro painel' no header (Recommended)
2. ☐ Redirect automático pra `/admin`
3. ☐ Pergunta 1ª vez: 'Você quer ver como cliente ou ir pro painel?'

**User selected:** Landing pública + atalho 'Ir pro painel' no header (Recommended)

→ **D-04** em CONTEXT.md

---

## Área 2: Bootstrap admin (1º acesso da mãe)

### Q2.1 — Como mãe ganha primeiro acesso

**Question:** Como sua mãe ganha o primeiro acesso ao `/admin/entrar`? É a primeira vez — ela ainda não tem conta.

**Options:**
1. ☐ CLI seed via env vars (Recommended) — `pnpm seed:admin` lê `.env`, hasheia argon2id, audit_log
2. ☐ Magic-link bootstrap (rota só-quando-zero-admins) — `/admin/setup-inicial` ativa enquanto count(admins)=0
3. ☐ Admin hardcoded em migration — INSERT no SQL com hash, force_password_reset
4. ☐ UI 'primeiro setup' guarded por flag — `BOOTSTRAP_MODE=true`

**User selected:** CLI seed via env vars (Recommended)

→ **D-05** em CONTEXT.md

### Q2.2 — Modelo de roles

**Question:** Sua mãe é admin. Ela pode/precisa ter também uma conta de cliente (pra testar como cliente vê o site, fazer reservas-teste)?

**Options:**
1. ☐ Conta única com role admin (Recommended) — enum admin|customer; admin não tem /minha-conta
2. ☐ Dual-role na mesma conta — tabela user_roles M:N
3. ☐ Sessões totalmente separadas (admin vs cliente) — 2 sistemas paralelos

**User selected:** Conta única com role admin (Recommended)

→ **D-06** em CONTEXT.md

### Q2.3 — Lockout admin / recovery

**Question:** Mãe esquece a senha E o email dela tá fora do ar (ou Resend caiu, ou ela trocou de celular). Como ela recupera acesso ao `/admin`?

**Options:**
1. ☐ CLI break-glass (você roda no VPS) (Recommended) — `pnpm seed:admin --reset`
2. ☐ Reset por email igual ao cliente — mesmo `/esqueci-minha-senha`
3. ☐ Rota dedicada `/admin/esqueci-senha` (separada)
4. ☐ Sem auto-recovery — dev recupera sob demanda manualmente

**User selected:** CLI break-glass (você roda no VPS) (Recommended)

→ **D-07** em CONTEXT.md

### Q2.4 — Email proativo em login admin

**Question:** Cada vez que entra um login admin (mamãe ou um atacante hipotético) o audit_log já registra (AUTH-11). Mamãe também recebe email avisando 'alguém entrou no painel admin agora'?

**Options:**
1. ☐ Email só quando IP/UA é novo (Recommended) — heurística de hash truncado
2. ☐ Email em todo login admin
3. ☐ Sem email, só audit_log
4. ☐ Email só em logins fora do horário comum (3am-6am)

**User selected:** Sem email, só audit_log

→ **D-08** em CONTEXT.md

---

## Claude's Discretion (areas não-selecionadas)

Conforme workflow padrão, áreas que o usuário não selecionou ficam para o researcher/planner decidirem com base em pitfalls e research. CONTEXT.md §Claude's Discretion documenta a posição inicial:

- **Conteúdo de Termos & Privacidade v1**: Phase 1 entrega shell + placeholder pt-BR; revisão jurídica leve fica em v1.x.
- **Audit log granularidade e schema**: schema genérico desde Phase 1 (`actor_type, actor_id, action, entity_type, entity_id, metadata jsonb, ip_hash, ua_hash, ts`); UI Phase 1 lista todos os eventos sem filtro.
- **Rate limit backend**: in-memory single-instance per-IP em /api/auth/* (sem Redis, sem DB-backed); migra em v1.x se necessário.

---

## Deferred Ideas

Capturadas em CONTEXT.md `<deferred>`:

- Email-on-novo-IP em login admin — v1.x se virar problema
- Dual-role na mesma conta — v2 se ganhar admin secundário
- UI 'primeiro setup' guarded por flag — irrelevante pra single-tenant
- Email-reset admin compartilhado com cliente — v1.x se CLI virar atrito

---

## Resumo

- **8 decisões locked** (D-01 a D-08) cobrindo página `/` (4) + bootstrap admin (4)
- **3 áreas em Claude's Discretion** com posição inicial documentada
- **4 ideias deferred** capturadas com rationale
- **0 todos folded** (não havia todos pendentes em STATE.md)
- **Nenhum scope creep** detectado durante discussão

*Discussion log generated: 2026-04-30*
