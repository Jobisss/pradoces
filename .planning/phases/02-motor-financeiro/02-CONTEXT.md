# Phase 2: Motor Financeiro - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A mãe cadastra ingredientes (com embalagens unificadas como `tipo='EMBALAGEM'`), registra compras imutáveis (event sourcing parcial), monta receitas com rendimento e custo de gás, cadastra produtos básicos (unitário ou kit), e produz lotes que **congelam** o custo do momento (rastreado até a compra+marca específica via FK `ingrediente_compra_id`), com alerta visual quando margem < 30% (configurável) e bloqueio se preço < custo.

Requirements: ING-01..08, REC-01..05, LOTE-01..08, PROD-01, PROD-02, PROD-08, PROD-09, PROD-10.

Phase 2 NÃO entrega: fotos/alergênicos/ativação de produto (PROD-03..07 → Phase 3), vitrine pública, reservas, pontos, relatórios agregados (Phase 7). LOTE-05 (cron de lote vencido) tem o cron em Phase 5 — Phase 2 só garante o schema/filtros que o suportam.

</domain>

<decisions>
## Implementation Decisions

### Registro de compras
- **D-01:** Fluxo "ida ao mercado": mãe escolhe mercado + data uma vez e adiciona vários itens em sequência (ingrediente, marca, qtde, preço → "adicionar outro"). Cada item persiste como UMA compra individual imutável (`ingrediente_compras`) — ING-04 intacto; o agrupamento é só UX.
- **D-02:** Quantidade informada como **qtde × tamanho da embalagem** (ex: 2 × 395g) + preço unitário. Sistema grava o total na unidade-base do ingrediente e deriva R$/unidade-base (ING-03). SEM tabela de apresentações/embalagens reutilizáveis na v1.
- **D-03:** Correção de erro: compra é **editável/excluível enquanto nenhum lote a referencia**; após o primeiro lote referenciar, o trigger (ING-07) a torna imutável. Sem fluxo de estorno na v1.
- **D-04:** Mercado e marca são **texto com autocomplete que aprende** (sugestões via DISTINCT dos valores já usados) + normalização leve (trim, caixa consistente) ao salvar. Sem tabelas formais de marca/mercado. Protege a análise por marca da Fase 7 contra duplicatas sujas ('Moça'/'moça'/'MOÇA').

### Produção de lote
- **D-05:** Ao produzir, o sistema **pré-seleciona a última compra** de cada ingrediente da receita (ING-05); a mãe **pode trocar** a compra/marca de qualquer item antes de confirmar (ex: usou lata antiga da despensa). 1 toque no caso comum, fidelidade quando importa.
- **D-06:** Custo por unidade do lote usa o **rendimento real** informado (custo total ÷ unidades que saíram), não o rendimento padrão da receita. A receita mantém o rendimento padrão como referência/sugestão.
- **D-07:** Quantidades do lote derivam da receita via **multiplicador** (1× / 1,5× / 2× — campo numérico livre) que escala todas as quantidades. Sem ajuste fino por ingrediente individual na v1.
- **D-08:** Validade: receita guarda **"dura X dias"** como padrão; ao registrar o lote o sistema sugere a data (data de produção + X dias) e a mãe pode ajustar. Data explícita sempre visível (precisa bater com a etiqueta impressa — pitfall 1.5).

### Margem e alertas
- **D-09:** Margem exibida no formulário de produto (PROD-08) = preço vs **custo corrente da receita** (última compra de cada ingrediente). Disponível mesmo sem lote produzido; reflete "se eu produzir hoje". Lucro histórico real por lote fica pros relatórios (Fase 7).
- **D-10:** Margem mínima: **configuração global (default 30%) com override opcional por produto**. Tela simples de ajustes no admin p/ o global.
- **D-11:** Kit: custo = **soma dos custos correntes dos componentes**; linha vermelha (PROD-08) e bloqueio preço<custo (PROD-09) valem para kit igual a produto unitário.

### Claude's Discretion
Áreas onde a usuária não respondeu (AFK) — planner decide, com recomendação registrada:
- **Alerta quando preço de ingrediente sobe e derruba margem de produto existente**: recomendado item na lista de "ações pendentes" da home admin ("Brigadeiro: margem caiu pra 22%") — versão mínima/embrião do ADM-01 da Fase 7. Alternativa mínima aceitável: linha vermelha só ao abrir o produto.
- **Navegação do admin** (4 áreas novas: Ingredientes, Receitas, Produtos, Lotes): organização da sidebar/mobile, atalho "registrar produção" e "registrar compras" com 1 toque da home admin. Mobile-first (mãe usa celular durante produção — 01-CONTEXT specifics). Detalhamento fica pro UI-SPEC (`/gsd-ui-phase 2` — workflow.ui_phase habilitado).
- Detalhes técnicos: shape exato do schema Prisma, validações Zod, componentes shadcn adicionais (form/react-hook-form foi adiado no 01-07 — Phase 2 provavelmente precisa), estrutura de Server Actions (seguir padrão de `lib/actions/auth.ts` do Plan 08).

</decisions>

<specifics>
## Specific Ideas

- Fluxo de compra espelha como a mãe pensa no mercado: "2 latas de 395g a R$5,80" — nunca pedir conversão de cabeça pra gramas.
- Custo congelado precisa contar a verdade até quando ela usa item antigo da despensa — por isso a compra pré-selecionada é editável (D-05).
- Copy pt-BR voz "vizinha" (padrão do projeto); admin usa linguagem da mãe ("produzi hoje", "fui ao mercado"), não jargão ("registrar evento de aquisição").
- Aviso ANVISA (PROD-10) é página de ajuda com lista de palavras a evitar — NÃO é linter no campo de descrição (SEC-02 deferido v1.x).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents (gsd-phase-researcher, gsd-planner) MUST read these antes de pesquisar ou planejar.**

### Escopo e requisitos
- `.planning/PROJECT.md` — core value (lucro real por produto), key decisions, out-of-scope
- `.planning/REQUIREMENTS.md` §Ingredientes/§Receitas/§Lotes/§Produtos — ING-01..08, REC-01..05, LOTE-01..08, PROD-01/02/08/09/10 com defaults configuráveis
- `.planning/ROADMAP.md` §Phase 2 — goal, 5 success criteria (inclui teste de regressão LOTE-08), pitfalls associados

### Decisões herdadas
- `.planning/phases/01-foundation/01-CONTEXT.md` — decisões Phase 1 (admin único, audit genérico com `action='preco_alterado'`/`'lote_criado'` previstos, Prisma 7 locked)
- `.planning/STATE.md` §Accumulated Context — decisões acumuladas (rate limit, route groups `(public)`/`(admin)`, padrão de testes de Server Actions do 01-08, REBRAND Luizinha Confeitaria)
- `.planning/BRAND.md` — paleta/tom Luizinha Confeitaria (aplicada em `app/globals.css`)

### Research (locked)
- `.planning/research/PITFALLS.md` — 2.1 (float vs numeric — já mitigado), 5.5 (custo congelado: FK pra compra + trigger + teste de regressão), 1.4/4.3 (N+1: `include`/`select` explícito desde já), 1.5 (validade exibida = etiqueta)
- `.planning/research/ARCHITECTURE.md` — App Router, Server Actions patterns
- `.planning/research/STACK.md` — decimal.js p/ money no app layer, Prisma `@db.Decimal(19,4)`

### Plataforma
- `node_modules/next/dist/docs/` — Next.js 16 breaking changes (ler antes de propor APIs)
- Prisma 7 docs oficiais + `node_modules/@prisma/client/` — breaking changes vs v6 (Rust engine removido); triggers/CHECK via migration SQL custom + `prisma.$queryRaw`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prisma/schema.prisma` — models auth (User, Session, Account, Verification, AuditLog) + convenções: `Decimal @db.Decimal(19,4)`, `DateTime @db.Timestamptz`. Phase 2 adiciona os models de domínio.
- `lib/actions/auth.ts` (9.1K) — padrão de Server Actions: Zod, rate limit defesa-em-profundidade, audit, mensagens genéricas. Testes mockam `next/headers`/`next/navigation` (padrão do 01-08).
- `lib/audit/log.ts` — `logAudit` com hashing HMAC de IP/UA embutido; Phase 2 popula `action='preco_alterado'`, `'lote_criado'`, `'compra_registrada'` sem migration (schema genérico da Phase 1).
- `lib/db/client.ts` — PrismaClient singleton; `lib/validation/` — helpers Zod.
- `components/ui/` — button, card, input, label, table, checkbox, alert, skeleton, sonner (shadcn v3). **Falta `form`** (adiado no 01-07 por precisar react-hook-form — Phase 2 forms complexos provavelmente o exigem; instalar react-hook-form + @hookform/resolvers).
- `app/(admin)/admin/` — shell admin com layout guardado por role + viewer de auditoria como referência de lista RSC.
- deps já instaladas: `decimal.js@10.6`, `zod@4`, `date-fns@4`, `@prisma/client@7.8` + `@prisma/adapter-pg`.

### Established Patterns
- Route groups: superfícies admin sob `app/(admin)/admin/*` (sem footer), guardadas por layout role-gate; login admin em grupo irmão não-guardado.
- Migrations SQL custom no fluxo Prisma Migrate p/ triggers (ING-07) e CHECKs (LOTE-04 ≥ 0) — mesmo padrão usado na Phase 1.
- Testes: vitest, DB compartilhado com dev (setup trunca tabelas — CUIDADO: `tests/setup.ts` precisa ganhar os deleteMany dos novos models, children first).
- Suite atual 73/75 verde; tsc limpo.

### Integration Points
- `prisma/schema.prisma` + `prisma/migrations/` — novos models: Ingrediente, IngredienteCompra (append-only + trigger), Receita, ReceitaIngrediente, Produto, ProdutoKitItem (M:N), Lote, LoteUsoIngrediente (FK compra + marca_snapshot + custo_congelado), Config (margem global).
- `app/(admin)/admin/` — novas rotas: ingredientes, compras, receitas, produtos, lotes + ajustes (margem global).
- `lib/audit/log.ts` — novas actions de domínio.
- `tests/setup.ts` — append deleteMany dos novos models (children first).
- LOTE-08: teste de regressão obrigatório (success criterion 5 do roadmap).

</code_context>

<deferred>
## Deferred Ideas

- **Cadastro de apresentações/embalagens reutilizáveis** ("lata 395g" como entidade) — rejeitado na v1 (D-02); reavaliar se digitação repetida virar atrito.
- **Fluxo de estorno/compensação de compra** — rejeitado na v1 (D-03); edição pré-lote cobre o caso real.
- **Tabelas formais de marca/mercado com tela de gestão** — rejeitado na v1 (D-04); autocomplete + normalização cobre.
- **Ajuste fino de quantidade por ingrediente na produção** — fora da v1 (D-07); multiplicador cobre.
- **Linter ANVISA no campo de descrição** — já deferido v1.x (SEC-02).

### Reviewed Todos (não folded)
Nenhum — `todo.match-phase 2` retornou 0 matches.

</deferred>

---

*Phase: 02-motor-financeiro*
*Context gathered: 2026-07-03*
*Mode: discuss (default) — 2 áreas finais resolvidas por discretion (usuária AFK)*
