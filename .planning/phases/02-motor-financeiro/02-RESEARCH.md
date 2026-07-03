# Phase 2: Motor Financeiro - Research

**Researched:** 2026-07-03
**Domain:** Domain modeling financeiro (event-sourcing parcial + custo congelado) sobre Prisma 7 / Postgres 16 / Next.js 16 App Router
**Confidence:** HIGH (verificações feitas diretamente contra `node_modules` instalado, CLI Prisma 7.8 real, registry shadcn ao vivo e npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Registro de compras
- **D-01:** Fluxo "ida ao mercado": mãe escolhe mercado + data uma vez e adiciona vários itens em sequência (ingrediente, marca, qtde, preço → "adicionar outro"). Cada item persiste como UMA compra individual imutável (`ingrediente_compras`) — ING-04 intacto; o agrupamento é só UX.
- **D-02:** Quantidade informada como **qtde × tamanho da embalagem** (ex: 2 × 395g) + preço unitário. Sistema grava o total na unidade-base do ingrediente e deriva R$/unidade-base (ING-03). SEM tabela de apresentações/embalagens reutilizáveis na v1.
- **D-03:** Correção de erro: compra é **editável/excluível enquanto nenhum lote a referencia**; após o primeiro lote referenciar, o trigger (ING-07) a torna imutável. Sem fluxo de estorno na v1.
- **D-04:** Mercado e marca são **texto com autocomplete que aprende** (sugestões via DISTINCT dos valores já usados) + normalização leve (trim, caixa consistente) ao salvar. Sem tabelas formais de marca/mercado. Protege a análise por marca da Fase 7 contra duplicatas sujas ('Moça'/'moça'/'MOÇA').

#### Produção de lote
- **D-05:** Ao produzir, o sistema **pré-seleciona a última compra** de cada ingrediente da receita (ING-05); a mãe **pode trocar** a compra/marca de qualquer item antes de confirmar (ex: usou lata antiga da despensa). 1 toque no caso comum, fidelidade quando importa.
- **D-06:** Custo por unidade do lote usa o **rendimento real** informado (custo total ÷ unidades que saíram), não o rendimento padrão da receita. A receita mantém o rendimento padrão como referência/sugestão.
- **D-07:** Quantidades do lote derivam da receita via **multiplicador** (1× / 1,5× / 2× — campo numérico livre) que escala todas as quantidades. Sem ajuste fino por ingrediente individual na v1.
- **D-08:** Validade: receita guarda **"dura X dias"** como padrão; ao registrar o lote o sistema sugere a data (data de produção + X dias) e a mãe pode ajustar. Data explícita sempre visível (precisa bater com a etiqueta impressa — pitfall 1.5).

#### Margem e alertas
- **D-09:** Margem exibida no formulário de produto (PROD-08) = preço vs **custo corrente da receita** (última compra de cada ingrediente). Disponível mesmo sem lote produzido; reflete "se eu produzir hoje". Lucro histórico real por lote fica pros relatórios (Fase 7).
- **D-10:** Margem mínima: **configuração global (default 30%) com override opcional por produto**. Tela simples de ajustes no admin p/ o global.
- **D-11:** Kit: custo = **soma dos custos correntes dos componentes**; linha vermelha (PROD-08) e bloqueio preço<custo (PROD-09) valem para kit igual a produto unitário.

### Claude's Discretion
Áreas onde a usuária não respondeu (AFK) — planner decide, com recomendação registrada:
- **Alerta quando preço de ingrediente sobe e derruba margem de produto existente**: recomendado item na lista de "ações pendentes" da home admin ("Brigadeiro: margem caiu pra 22%") — versão mínima/embrião do ADM-01 da Fase 7. Alternativa mínima aceitável: linha vermelha só ao abrir o produto.
- **Navegação do admin** (4 áreas novas: Ingredientes, Receitas, Produtos, Lotes): organização da sidebar/mobile, atalho "registrar produção" e "registrar compras" com 1 toque da home admin. Mobile-first (mãe usa celular durante produção — 01-CONTEXT specifics). Detalhamento fica pro UI-SPEC (`/gsd-ui-phase 2` — workflow.ui_phase habilitado).
- Detalhes técnicos: shape exato do schema Prisma, validações Zod, componentes shadcn adicionais (form/react-hook-form foi adiado no 01-07 — Phase 2 provavelmente precisa), estrutura de Server Actions (seguir padrão de `lib/actions/auth.ts` do Plan 08).

### Deferred Ideas (OUT OF SCOPE)
- **Cadastro de apresentações/embalagens reutilizáveis** ("lata 395g" como entidade) — rejeitado na v1 (D-02); reavaliar se digitação repetida virar atrito.
- **Fluxo de estorno/compensação de compra** — rejeitado na v1 (D-03); edição pré-lote cobre o caso real.
- **Tabelas formais de marca/mercado com tela de gestão** — rejeitado na v1 (D-04); autocomplete + normalização cobre.
- **Ajuste fino de quantidade por ingrediente na produção** — fora da v1 (D-07); multiplicador cobre.
- **Linter ANVISA no campo de descrição** — já deferido v1.x (SEC-02).

**Specific ideas (verbatim):**
- Fluxo de compra espelha como a mãe pensa no mercado: "2 latas de 395g a R$5,80" — nunca pedir conversão de cabeça pra gramas.
- Custo congelado precisa contar a verdade até quando ela usa item antigo da despensa — por isso a compra pré-selecionada é editável (D-05).
- Copy pt-BR voz "vizinha" (padrão do projeto); admin usa linguagem da mãe ("produzi hoje", "fui ao mercado"), não jargão ("registrar evento de aquisição").
- Aviso ANVISA (PROD-10) é página de ajuda com lista de palavras a evitar — NÃO é linter no campo de descrição (SEC-02 deferido v1.x).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ING-01 | Cadastro de ingrediente (nome + unidade-base g/ml/un) | Schema §Ingrediente; enum `UnidadeBase`; Server Action CRUD pattern |
| ING-02 | Registro de compra (ingrediente + mercado + marca + qtde + preço + data) | Schema §IngredienteCompra; fluxo "ida ao mercado" (D-01); form RHF |
| ING-03 | Sistema deriva R$/unidade-base | Derivação server-side com decimal.js; coluna `custo_por_unidade_base numeric(19,6)` |
| ING-04 | Compras append-only (event sourcing parcial) | Trigger Postgres (§Code Examples) + D-03 (mutável até 1º lote referenciar) |
| ING-05 | Preço corrente = última compra | Query `DISTINCT ON` via `$queryRaw` (§Code Examples); índice `(ingrediente_id, data_compra DESC)` |
| ING-06 | Embalagens como ingrediente `tipo='EMBALAGEM'` | Enum `TipoIngrediente` no mesmo model — zero tabela extra |
| ING-07 | Trigger `BEFORE UPDATE` bloqueia compra referenciada por lote | Migration SQL custom via `prisma migrate dev --create-only` (verificado no CLI 7.8) |
| ING-08 | Histórico cronológico de compras por ingrediente | RSC list page ordenada por `data_compra DESC`; `include` explícito (anti N+1) |
| REC-01 | Receita ligada a produto unitário ou kit | Relação 1:1 `Produto.receitaId` (nullable — kit não tem receita própria, D-11) |
| REC-02 | Receita lista ingredientes × qtde por lote-padrão | `ReceitaIngrediente` (join table com qtde Decimal) |
| REC-03 | Rendimento (X unidades por lote) | `rendimento_padrao int` no model Receita |
| REC-04 | Custo de gás/energia por lote (R$ manual, opcional) | `custo_gas numeric(19,4) NULL` |
| REC-05 | Custo total e custo/unidade calculados automaticamente | Função `custoCorrenteReceita()` server-side (§Architecture Patterns) |
| LOTE-01 | Registro de lote (produto + receita + rendimento real + validade) | Form de produção (D-05/D-06/D-07/D-08); transação atômica com nested create |
| LOTE-02 | `lote_uso_ingredientes` FK NOT NULL `ingrediente_compra_id` | Schema §LoteUsoIngrediente — FK para compra, NUNCA para ingrediente (Pitfall 5.5) |
| LOTE-03 | Congela `marca_snapshot` + `custo_congelado` em colunas tipadas | Colunas `marca_snapshot text` + `custo_unitario_congelado numeric(19,6)` + `custo_congelado numeric(19,4)` |
| LOTE-04 | `qtde_disponivel` + `qtde_reservada` com CHECK ≥ 0 | Migration SQL custom `ALTER TABLE ... ADD CONSTRAINT CHECK` |
| LOTE-05 | Lote vencido some da vitrine (cron Phase 5) | Phase 2 entrega apenas coluna `validade date` + filtro "vencidos" (LOTE-07) que o cron usará |
| LOTE-06 | Validade imutável após primeira reserva ativa | Reservas só existem na Phase 4 — ver §Open Questions #1 (enforcement app-level agora, trigger na Phase 4) |
| LOTE-07 | Filtros: vigentes, vencidos, esgotados | Queries derivadas: `validade >= hoje(BRT)`, `validade < hoje`, `qtde_disponivel = 0` |
| LOTE-08 | Teste de regressão: custo congelado sobrevive a mudança de preço | Teste vitest obrigatório (§Validation Architecture, §Code Examples) |
| PROD-01 | Produto: nome + descrição + categoria + tipo (UNITARIO\|KIT) + preço | Schema §Produto; enum `TipoProduto` |
| PROD-02 | Produto vincula a receita (define custo) | `Produto.receitaId @unique` (nullable p/ KIT) |
| PROD-08 | Alerta visual (linha vermelha) se margem < 30% configurável | Client component com decimal.js; threshold de `Configuracao.margemMinimaPadrao` c/ override por produto (D-10) |
| PROD-09 | Bloqueia salvar se preço < custo absoluto | Validação SERVER-SIDE na action (não só Zod — precisa lookup de custo no DB) |
| PROD-10 | Página de ajuda com aviso ANVISA | Página estática admin com lista de palavras (RDC 727/2022); NÃO é linter (SEC-02 deferido) |
</phase_requirements>

## Summary

Phase 2 é 90% **modelagem de domínio + Server Actions admin** sobre infraestrutura que a Phase 1 já entregou e validou: Prisma 7.8 com driver adapter pg, migrations SQL versionadas, padrão de Server Action com Zod + rate limit + audit, shell admin com role-gate, e suite vitest 73/75 verde contra Postgres real. Não há biblioteca nova de peso — as únicas instalações são `react-hook-form` + `@hookform/resolvers` (forms complexos do admin) e ~6 componentes shadcn adicionais. Todo o resto (decimal.js, zod 4, date-fns, Prisma Decimal) já está instalado.

O coração técnico da fase é o **custo congelado enforçado no schema, não em convenção** (Pitfall 5.5): `lote_uso_ingredientes.ingrediente_compra_id` é FK NOT NULL para a **compra** (nunca para o ingrediente), colunas `marca_snapshot`/`custo_congelado` materializam o snapshot, um trigger Postgres `BEFORE UPDATE OR DELETE` torna a compra imutável a partir do primeiro lote que a referencia (D-03 permite edição antes disso), e o teste de regressão LOTE-08 prova o invariante. Tudo isso entra via `prisma migrate dev --create-only` + SQL manual — fluxo verificado no CLI Prisma 7.8 instalado.

Os riscos reais são de precisão e fronteira: (a) `Prisma.Decimal` NÃO atravessa a fronteira RSC→Client Component (não é serializável — converter para string com `.toFixed()`); (b) inputs de dinheiro pt-BR usam vírgula ("5,80") e jamais podem passar por `Number()`/`z.number()` (float); (c) o registry shadcn `radix-nova` tem o componente `form` como **stub vazio** (verificado ao vivo — 104 bytes, sem files) — instalar da URL do style `new-york-v4`; (d) rodar vitest **apaga o banco de dev** (DATABASE_URL compartilhado — memória do projeto).

**Primary recommendation:** modelar os 9 models novos numa única migration com SQL custom (trigger + CHECKs), centralizar TODA aritmética de custo em `lib/custo/` (server-only, decimal.js), criar helper `requireAdmin()` consumido por toda Server Action da fase (layouts NÃO protegem actions), e escrever o teste LOTE-08 antes do fluxo de produção de lote.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cálculo de custo (corrente e congelado) | API/Backend (Server Actions + lib server-only) | — | Precisão Decimal + fonte de verdade = linhas de compra no DB; cliente nunca manda custo computado |
| Congelamento/imutabilidade de compra | Database (trigger + FK + CHECK) | Backend (mensagem amigável no catch) | Invariante deve sobreviver a bug de app — enforce no schema (Pitfall 5.5) |
| Derivação R$/unidade-base (ING-03) | API/Backend | Database (colunas derivadas armazenadas) | Calculado 1× na escrita com decimal.js; armazenado para leitura barata |
| Margem em tempo real no form (PROD-08) | Browser/Client (decimal.js client-side) | Backend (custo corrente vem serializado do server) | UX reativa enquanto digita; server passa custo como string |
| Bloqueio preço < custo (PROD-09) | API/Backend (validação na action) | Browser (feedback imediato, não confiável) | Client-side é cortesia; o bloqueio real é server-side com lookup de custo |
| Autocomplete marca/mercado (D-04) | API/Backend (query DISTINCT) | Browser (shadcn Combobox) | Sugestões vêm do DB; UI é composição popover+command |
| Autorização admin | API/Backend (`requireAdmin()` em cada action) | Frontend Server (layout role-gate p/ páginas) | Server Actions são endpoints públicos — layout não as protege |
| Filtros de lote (LOTE-07) | API/Backend (queries RSC) | Database (índices) | Comparação de validade com data BRT é server-side |
| Audit (preco_alterado, lote_criado, compra_registrada) | API/Backend (`logAudit` existente) | Database (audit_log genérico da Phase 1) | Schema genérico já suporta — zero migration |

## Standard Stack

### Core (já instalado — verificado em package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client + prisma | 7.8.0 (npm latest: 7.8.0 `[VERIFIED: npm registry]`) | ORM + Migrate; Decimal nativo | Locked D-09; driver adapter pg já configurado em `lib/db/client.ts` |
| decimal.js | 10.6.0 | Aritmética monetária app-side (client E server) | Locked (STACK.md); `Prisma.Decimal` é API-compatível `[VERIFIED: node_modules/@prisma/client-runtime-utils]` |
| zod | 4.4.3 | Validação de toda Server Action | Padrão Phase 1 (`lib/validation/`) |
| date-fns | 4.1.0 | Datas pt-BR (sugestão de validade D-08) | Já instalado |
| shadcn (CLI) | 4.12.0 | Componentes admin adicionais | Padrão Phase 1, style `radix-nova` em components.json |

### Novo nesta fase (instalar)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.80.0 `[VERIFIED: npm view 2026-07-03]` | Forms complexos admin (receita com array de ingredientes, lote com linhas de compra) | `useFieldArray` para linhas dinâmicas; forms simples continuam `useActionState` puro |
| @hookform/resolvers | 5.4.0 `[VERIFIED: npm view 2026-07-03]` | Bridge Zod⇄RHF | Depende só de `@standard-schema/utils` — Zod 4 implementa Standard Schema, compatível `[VERIFIED: npm peerDeps]` |

### Componentes shadcn a adicionar (verificados no registry radix-nova ao vivo, 2026-07-03)
| Componente | Status registry radix-nova | Ação |
|------------|---------------------------|------|
| `select`, `textarea`, `dialog`, `badge`, `popover`, `command`, `combobox`, `sheet` | ✓ reais (1.3K–11K bytes) `[VERIFIED: ui.shadcn.com/r/styles/radix-nova/*.json]` | `shadcn add` normal (invocar binário por caminho absoluto — hook rtk intercepta `npx`, learning 01-07) |
| `form` | ✗ **STUB VAZIO** (104 bytes, sem `files`) `[VERIFIED: fetch do registry]` | Adicionar da URL do style new-york-v4: `.../r/styles/new-york-v4/form.json` (4.4K, deps: radix-ui unificado + RHF + resolvers — compatível com `radix-ui@1.6` já instalado) `[VERIFIED: fetch]` |

**Installation:**
```bash
rtk npm install react-hook-form @hookform/resolvers
# form component (workaround do stub radix-nova — verificado):
node node_modules/shadcn/dist/index.js add https://ui.shadcn.com/r/styles/new-york-v4/form.json
node node_modules/shadcn/dist/index.js add select textarea dialog badge combobox sheet
```
(`combobox` já puxa `popover`+`command` como registryDependencies.)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RHF + useFieldArray | useActionState + FormData arrays manuais | Viável p/ forms simples; arrays dinâmicos (receita N ingredientes, lote N linhas) ficam dolorosos e sem validação inline — STACK.md já previu RHF p/ "Phase 2-3" |
| Trigger Postgres p/ imutabilidade | Convenção "nunca chamar update" no app | REJEITADO — success criterion 1 exige trigger; convenção não sobrevive a bug (Pitfall 5.5) |
| Colunas derivadas armazenadas (custo_por_unidade_base) | Calcular on-read sempre | Armazenar = leitura barata + histórico auditável; recálculo on-read reabre a porta pro bug de custo corrente vazar p/ histórico |
| Tabela Configuracao single-row tipada | Key-value genérico | Single-row com CHECK (id=1) é type-safe no Prisma e Phase 4+ só adiciona colunas |

## Architecture Patterns

### System Architecture Diagram

```
[Mãe no celular — admin]
        │
        ▼
app/(admin)/admin/{ingredientes,compras,receitas,produtos,lotes,ajustes}
  RSC pages (listas, históricos — include/select explícito, anti N+1)
  Client forms (RHF + zod + decimal.js p/ preview de margem)
        │  (Decimal atravessa como STRING serializada)
        ▼
lib/actions/{ingredientes,compras,receitas,produtos,lotes,config}.ts  ('use server')
  1. requireAdmin()  ← NOVO helper: session + role check DENTRO da action
  2. Zod parse (zDecimalBRL: aceita "5,80", nunca Number())
  3. lógica em lib/custo/* (decimal.js, server-only)
  4. prisma.$transaction / nested create (lote atômico)
  5. logAudit (compra_registrada | lote_criado | preco_alterado)
  6. revalidatePath
        │
        ▼
PrismaClient (driver adapter pg) ──── prisma/migrations/*.sql
        │                                  ├─ CREATE TRIGGER trg_compra_imutavel  (ING-07)
        ▼                                  ├─ CHECK qtde_disponivel ≥ 0, qtde_reservada ≥ 0  (LOTE-04)
Postgres 16                                └─ CHECK configuracoes.id = 1
  ingredientes ─< ingrediente_compras ─< lote_uso_ingredientes >─ lotes >─ produtos
                        ▲ trigger bloqueia UPDATE/DELETE se referenciada     │
  receitas ─< receita_ingredientes                              produto_kit_items (M:N produto↔produto)
  configuracoes (margem global)
```

Fluxo primário (produzir lote): mãe escolhe receita → server pré-carrega última compra por ingrediente (`DISTINCT ON`) → form permite trocar compra por linha (D-05) e escala por multiplicador (D-07) → submit → action recomputa TUDO server-side a partir das compras FK'adas (nunca confia em custo vindo do client) → nested create Lote + LoteUsoIngrediente numa transação → audit + revalidate.

### Recommended Project Structure
```
app/(admin)/admin/
├── ingredientes/          # lista + novo/editar + [id]/ (histórico de compras — ING-08)
├── compras/nova/          # fluxo "ida ao mercado" (D-01)
├── receitas/              # lista + form com useFieldArray
├── produtos/              # lista + form com margem em tempo real (PROD-08/09)
├── lotes/                 # lista com filtros (LOTE-07) + produzir/
├── ajustes/               # margem global (D-10)
└── ajuda/                 # aviso ANVISA (PROD-10)
lib/
├── actions/               # 1 arquivo por agregado (padrão lib/actions/auth.ts)
├── custo/                 # TODA aritmética de custo — server-only, decimal.js
│   ├── corrente.ts        # custoCorrenteReceita, custoCorrenteKit (D-09/D-11)
│   └── congelado.ts       # computeLoteSnapshot (D-06)
├── validation/            # schemas Zod + zDecimalBRL helper
└── auth/require-admin.ts  # requireAdmin() p/ Server Actions
```

### Pattern 1: Server Action admin-only (requireAdmin)
**What:** TODA mutação da Phase 2 é admin-only — a primeira vez no projeto. O layout `(admin)` protege PÁGINAS, não actions: Server Actions são endpoints POST públicos e a autorização deve acontecer DENTRO da action `[CITED: node_modules/next/dist/docs/01-app/02-guides/data-security.md]`.
**When to use:** Primeira linha de toda action de `lib/actions/{ingredientes,compras,receitas,produtos,lotes,config}.ts`.
**Example:**
```typescript
// lib/auth/require-admin.ts — novo helper (padrão derivado de app/(admin)/admin/layout.tsx)
import { headers } from 'next/headers'
import { auth } from '@/lib/auth/server'

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user as { id: string; role?: string } | undefined
  if (!user || user.role !== 'admin') {
    throw new Error('UNAUTHORIZED') // action retorna erro genérico; nunca vaza detalhe
  }
  return user
}
```

### Pattern 2: Dinheiro pt-BR — input, validação e travessia de fronteira
**What:** Input aceita vírgula ("5,80"); validação via string→Decimal (NUNCA `z.number()`/`Number()`); `Prisma.Decimal` não é serializável para Client Components (props precisam ser serializáveis `[CITED: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md §serializable]`) — converter com `.toFixed()`/`.toString()` na fronteira.
**Example:**
```typescript
// lib/validation/decimal.ts
import { z } from 'zod'
import Decimal from 'decimal.js'

export const zDecimalBRL = z
  .string()
  .trim()
  .regex(/^\d{1,13}([.,]\d{1,4})?$/, 'Valor inválido')
  .transform((s) => new Decimal(s.replace(',', '.')))
// Prisma aceita string | Decimal p/ colunas Decimal
// [VERIFIED: JsInputValue em node_modules/@prisma/client/runtime/client.d.ts inclui string e DecimalJsLike]

// RSC → Client: <ProdutoForm custoCorrente={custo.toFixed(4)} />
// Client: const custo = new Decimal(props.custoCorrente)
```

### Pattern 3: Última compra por ingrediente (ING-05 / D-05) — 1 round-trip
**What:** `DISTINCT ON` do Postgres via `$queryRaw` tagged template (auto-parametrizado). Evita N+1 e evita o `distinct` do Prisma (que é aplicado in-memory).
**Example:**
```typescript
// Source: padrão Postgres DISTINCT ON (postgresql.org/docs/16/sql-select.html#SQL-DISTINCT)
const ultimas = await prisma.$queryRaw<UltimaCompraRow[]>`
  SELECT DISTINCT ON (ingrediente_id)
         id, ingrediente_id, marca, custo_por_unidade_base, data_compra
  FROM ingrediente_compras
  WHERE ingrediente_id = ANY(${ingredienteIds}::uuid[])
  ORDER BY ingrediente_id, data_compra DESC, created_at DESC
`
// NOTA: $queryRaw devolve numeric como Prisma.Decimal e uuid como string.
```

### Pattern 4: Produção de lote atômica com snapshot server-side
**What:** Recomputar custo DENTRO da transação a partir das linhas de compra FK'adas — o client manda apenas `{ingredienteCompraId, qtdeUsada}`, nunca custos. Nested create garante atomicidade Lote + usos.
**Example:**
```typescript
const lote = await prisma.lote.create({
  data: {
    produtoId, receitaId, multiplicador, rendimentoReal, validade,
    qtdeDisponivel: rendimentoReal, qtdeReservada: 0,
    custoGasCongelado: receita.custoGas ?? new Decimal(0), // snapshot! receita é mutável
    custoTotalCongelado: totalCalc.toFixed(4),
    custoPorUnidadeCongelado: totalCalc.div(rendimentoReal).toFixed(6), // D-06: rendimento REAL
    usos: {
      create: linhas.map((l) => ({
        ingredienteCompraId: l.compra.id,          // LOTE-02: FK pra COMPRA
        qtdeUsada: l.qtdeUsada.toFixed(3),
        marcaSnapshot: l.compra.marca,             // LOTE-03
        custoUnitarioCongelado: l.compra.custoPorUnidadeBase.toFixed(6),
        custoCongelado: l.qtdeUsada.mul(l.compra.custoPorUnidadeBase).toFixed(4),
      })),
    },
  },
})
await logAudit({ actorType: 'admin', actorId, action: 'lote_criado', entityType: 'lote', entityId: lote.id })
```

### Pattern 5: Autocomplete que aprende (D-04)
**What:** Sugestões via DISTINCT dos valores já usados; ao salvar, match case-insensitive contra valores existentes reutiliza a grafia canônica já armazenada (primeira grafia vence) — protege a análise por marca da Fase 7.
**Example:**
```typescript
// lib/actions/compras.ts — normalização leve na escrita
function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}
async function canonicalize(campo: 'marca' | 'mercado', valor: string) {
  const v = normalizeLabel(valor)
  const [existing] = await prisma.$queryRaw<{ v: string }[]>`
    SELECT DISTINCT ${Prisma.raw(campo)} AS v FROM ingrediente_compras
    WHERE lower(${Prisma.raw(campo)}) = lower(${v}) LIMIT 1`
  return existing?.v ?? v   // reusa grafia existente ('Moça' vence 'moça')
}
// ⚠️ Prisma.raw só com identificador de allowlist ('marca'|'mercado') — nunca input do user.
```

### Pattern 6: Forms
- **Forms complexos** (receita com N ingredientes, lote com N linhas, produto com preview de margem): RHF + `zodResolver`/`standardSchemaResolver` + `useFieldArray`, submit via `handleSubmit(async (data) => await serverAction(data))` `[CITED: node_modules/next/dist/docs/01-app/02-guides/forms.md + react-hook-form.com/docs/usefieldarray]`.
- **Forms simples** (ingrediente: nome + unidade + tipo; ajustes): `useActionState` + `<form action=...>` — padrão Phase 1, zero dep client.
- **Fluxo "ida ao mercado" (D-01):** header fixo (mercado + data) em estado client; cada "adicionar item" dispara UMA Server Action que persiste UMA compra imediatamente (não acumular batch no client — mãe está no celular no mercado; fechar a aba não pode perder itens). Lista dos itens já salvos cresce abaixo do form.

### Pattern 7: Migration com SQL custom (trigger + CHECK)
Fluxo verificado no CLI instalado (`prisma migrate dev --create-only` existe no Prisma 7.8 `[VERIFIED: node node_modules/prisma/build/index.js migrate dev --help]`):
1. Editar `prisma/schema.prisma` (models novos)
2. `rtk npm run db:migrate:dev -- --create-only --name motor_financeiro` (gera SQL sem aplicar)
3. Anexar SQL custom ao fim do `migration.sql` gerado (trigger + CHECKs — ver §Code Examples)
4. `rtk npm run db:migrate:dev` (aplica)

**NUNCA usar `prisma db push`** — ele diffa direto do schema e não executa o SQL custom das migrations; o trigger sumiria silenciosamente em um reset.

### Anti-Patterns to Avoid
- **FK para `ingredientes` em `lote_uso_ingredientes`:** o bug exato do Pitfall 5.5. A FK é para `ingrediente_compras`. (Se quiser `ingrediente_id` denormalizado p/ relatório, ele é REDUNDANTE e derivável via join — não adicionar na v1.)
- **`Number(decimal)` / aritmética `+`/`*` em JS com dinheiro:** perde precisão. Toda conta via decimal.js/`Prisma.Decimal`.
- **Passar `Prisma.Decimal` como prop de Client Component:** runtime error de serialização. Sempre `.toFixed()`/`.toString()` na fronteira.
- **Confiar em custo/margem calculados no client:** preview client-side é UX; a action recomputa e é quem bloqueia (PROD-09).
- **Acessar relação fora de `include`/`select`:** N+1 (Pitfall 4.3). Listas de receitas/lotes carregam relações explicitamente na query.
- **Validade como `timestamptz`:** semanticamente é DATA de etiqueta (Pitfall 2.2 + D-08). Usar `@db.Date` e comparar com a data corrente em America/Sao_Paulo.
- **`$queryRawUnsafe` ou interpolação de string:** só `$queryRaw` tagged template (auto-parametrizado). `Prisma.raw` apenas com identificadores de allowlist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aritmética decimal | Float math + arredondamento manual | decimal.js / Prisma.Decimal | INFRA-09 locked; float destrói margem (Pitfall 2.1) |
| Imutabilidade de compra | Flag `locked` checada no app | Trigger Postgres + FK RESTRICT | Sobrevive a bug de app, script manual e Prisma Studio |
| Estoque não-negativo | `if (qtde < 0) throw` no app | `CHECK (qtde >= 0)` no schema | Transação aborta mesmo com race/bug (LOTE-04) |
| Arrays dinâmicos em form | useState de arrays + índices manuais | RHF `useFieldArray` | Focus management, validação por linha, remoção sem bug de índice |
| Autocomplete UI | Input + dropdown custom | shadcn `combobox` (popover+command) | A11y (keyboard, aria) grátis; verificado no registry radix-nova |
| Datas pt-BR | Template strings de data | date-fns v4 + `Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'})` | INFRA-10; timezone bug em validade é risco de alimento (Pitfall 2.2) |
| Última-compra-por-grupo | Loop com N queries | `DISTINCT ON` via `$queryRaw` | 1 round-trip, index-friendly, Postgres-nativo |

**Key insight:** o domínio inteiro é "contabilidade de confeitaria" — a categoria de bug que destrói o produto é silenciosa (centavos errados, histórico reescrito). Por isso os invariantes moram no Postgres (trigger, CHECK, FK) e a aritmética mora numa única lib server-side testável, não espalhada em componentes.

## Common Pitfalls

### Pitfall 1: Custo congelado que descongela (Pitfall 5.5 da research global)
**What goes wrong:** custo do lote referencia o ingrediente (preço corrente) em vez da compra específica; relatório histórico muda retroativamente.
**Why it happens:** atalho de modelagem (`ingrediente_id` é "mais simples") ou recomputar custo on-read.
**How to avoid:** FK NOT NULL `ingrediente_compra_id` + colunas snapshot tipadas + trigger + teste LOTE-08. Custo de lote NUNCA é recalculado após o INSERT.
**Warning signs:** qualquer código que leia custo de lote fazendo join até `ingredientes`/última compra em vez de ler as colunas congeladas.

### Pitfall 2: Receita mutável vaza para o histórico
**What goes wrong:** receita é editável (qtde, gás, rendimento). Se o lote deriva qualquer valor da receita on-read, editar a receita reescreve o custo de lotes antigos — mesma classe de bug do Pitfall 1, porta lateral.
**How to avoid:** o lote congela TUDO que entra no custo: `qtde_usada` por linha (já escalada pelo multiplicador), `custo_gas_congelado`, `rendimento_real`. Depois do INSERT, o lote não lê a receita para nada financeiro.
**Warning signs:** cálculo de custo de lote que recebe `receita` como parâmetro.

### Pitfall 3: `Prisma.Decimal` na fronteira RSC→Client
**What goes wrong:** `Error: Only plain objects can be passed to Client Components` (ou serialização silenciosamente errada) ao passar custo como prop.
**How to avoid:** DTO na fronteira: `.toFixed(4)` (dinheiro) / `.toFixed(6)` (custo unitário) → string; client reconstrói `new Decimal(s)`. Vale também para retorno de Server Action consumido pelo client.
**Warning signs:** tipo de prop `Decimal` em componente `'use client'`; `JSON.stringify` de rows Prisma com colunas Decimal.

### Pitfall 4: Vírgula decimal pt-BR
**What goes wrong:** mãe digita "5,80"; `Number("5,80")` → `NaN`; `parseFloat` → `5`. Compra gravada com preço errado.
**How to avoid:** `zDecimalBRL` (string → replace vírgula → Decimal) em TODO campo monetário/quantidade; inputs com `inputMode="decimal"`.
**Warning signs:** `z.number()`, `parseFloat`, `+valor` em qualquer schema/action da fase.

### Pitfall 5: Vitest apaga o banco de dev
**What goes wrong:** test DB == dev DB (mesmo `DATABASE_URL` — memória do projeto). `tests/setup.ts` roda `deleteMany` afterEach: rodar a suite durante desenvolvimento com dados de exercício da mãe/dev apaga tudo.
**How to avoid:** (a) atualizar `tests/setup.ts` E `tests/conftest.ts#truncateAll` com os models novos **children-first**: `loteUsoIngrediente → lote → produtoKitItem → produto → receitaIngrediente → receita → ingredienteCompra → ingrediente → configuracao` antes dos da Phase 1; (b) avisar no plano que executor não deve manter dados manuais no dev DB. Esquecer um model novo no setup = vazamento de rows entre testes com falhas intermitentes por FK.
**Warning signs:** teste falhando com violação de FK no teardown; dados sumindo do Prisma Studio após `npm test`.

### Pitfall 6: shadcn `form` é stub no style radix-nova
**What goes wrong:** `shadcn add form` completa "com sucesso" sem criar arquivo nenhum (verificado: o JSON do registry tem 104 bytes e zero files) — repetição do no-op do Plan 01-07.
**How to avoid:** adicionar pela URL completa do style new-york-v4 (§Installation) OU vendorar o `form.tsx` (4.4K, importa do pacote unificado `radix-ui` — compatível com o instalado).
**Warning signs:** `components/ui/form.tsx` inexistente após o add.

### Pitfall 7: Trigger com mensagem crua estourando na UI
**What goes wrong:** editar compra referenciada lança erro Postgres (`RAISE EXCEPTION`) que o Prisma repassa; sem tratamento, a mãe vê stacktrace/erro genérico assustador.
**How to avoid:** UX primeiro — a action de editar/excluir compra checa `EXISTS lote_uso_ingredientes` ANTES e retorna copy amigável ("Essa compra já foi usada num lote, não dá mais pra mudar"); o trigger fica como última linha de defesa. UI esconde botões de editar/excluir quando referenciada.
**Warning signs:** teste de edição de compra referenciada mostrando mensagem em inglês/técnica.

### Pitfall 8: Comparar Decimal com `===` / `toBe` nos testes
**What goes wrong:** `expect(lote.custo).toBe(10)` falha ou passa por coincidência — Decimal é objeto.
**How to avoid:** comparar strings canônicas: `expect(row.custo.toFixed(4)).toBe('10.0000')` ou `expect(a.equals(b)).toBe(true)`.

### Pitfall 9: Margem calculada em N+1 na lista de produtos
**What goes wrong:** lista de produtos exibindo margem corrente dispara (última compra × ingredientes) por produto → explosão de queries (Pitfall 4.3/1.4).
**How to avoid:** na lista, computar custo corrente em batch: 1 query `DISTINCT ON` para todas as últimas compras + 1 query de receitas com `include: { itens: true }`; compor em memória. Página de detalhe pode ser mais simples.
**Warning signs:** log de dev (`log: ['query']` já ativo) mostrando a mesma query repetida por produto.

### Pitfall 10: Validade e "vencido" com data UTC
**What goes wrong:** filtro `validade < new Date()` compara com instante UTC; lote some/aparece no dia errado (Pitfall 2.2 — risco de alimento).
**How to avoid:** `validade` é `@db.Date`; "hoje" derivado explicitamente em America/Sao_Paulo (`TZ` já setado no app + render `Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'})`). Success: filtros LOTE-07 têm teste com TZ.

## Code Examples

### Migration SQL custom (ING-07 + LOTE-04 + Config singleton)
```sql
-- Anexar ao migration.sql gerado por `prisma migrate dev --create-only`
-- Source: postgresql.org/docs/16/plpgsql-trigger.html (padrão BEFORE trigger)

-- ING-07 / D-03: compra vira imutável a partir do 1º lote que a referencia.
CREATE OR REPLACE FUNCTION bloquear_compra_referenciada() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM lote_uso_ingredientes WHERE ingrediente_compra_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'compra % imutavel: referenciada por lote (custo congelado)', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compra_imutavel
  BEFORE UPDATE OR DELETE ON "ingrediente_compras"
  FOR EACH ROW EXECUTE FUNCTION bloquear_compra_referenciada();
-- (DELETE referenciado também é bloqueado pela FK RESTRICT de lote_uso_ingredientes;
--  o trigger cobre UPDATE e dá erro determinístico p/ DELETE.)

-- LOTE-04: estoque nunca negativo (defesa contra race da Phase 4 também)
ALTER TABLE "lotes" ADD CONSTRAINT lotes_qtde_disponivel_nao_negativa CHECK (qtde_disponivel >= 0);
ALTER TABLE "lotes" ADD CONSTRAINT lotes_qtde_reservada_nao_negativa  CHECK (qtde_reservada  >= 0);

-- Config single-row (D-10)
ALTER TABLE "configuracoes" ADD CONSTRAINT configuracoes_singleton CHECK (id = 1);
```

### Shape de schema recomendado (planner refina — Claude's Discretion)
```prisma
// Convenções Phase 1 mantidas: uuid PK, @@map snake_case, Timestamptz(6)
enum UnidadeBase { g  ml  un }
enum TipoIngrediente { INGREDIENTE  EMBALAGEM }   // ING-06
enum TipoProduto { UNITARIO  KIT }                 // PROD-01

model Ingrediente {
  id          String          @id @default(uuid()) @db.Uuid
  nome        String          @unique
  unidadeBase UnidadeBase     @map("unidade_base")
  tipo        TipoIngrediente @default(INGREDIENTE)
  // + timestamps; relações: compras[], receitaItens[]
  @@map("ingredientes")
}

model IngredienteCompra {
  id                  String   @id @default(uuid()) @db.Uuid
  ingredienteId       String   @db.Uuid @map("ingrediente_id")
  dataCompra          DateTime @db.Date @map("data_compra")           // ING-02
  mercado             String                                           // D-04 texto canônico
  marca               String                                           // D-04
  qtdeEmbalagens      Decimal  @db.Decimal(10, 3) @map("qtde_embalagens")      // D-02: "2"
  tamanhoEmbalagem    Decimal  @db.Decimal(12, 3) @map("tamanho_embalagem")    // D-02: "395" (na unidade-base)
  precoPorEmbalagem   Decimal  @db.Decimal(19, 4) @map("preco_por_embalagem")  // D-02: "5,80"
  qtdeTotalBase       Decimal  @db.Decimal(14, 3) @map("qtde_total_base")      // derivada: 790 g
  precoTotal          Decimal  @db.Decimal(19, 4) @map("preco_total")          // derivada: 11,60
  custoPorUnidadeBase Decimal  @db.Decimal(19, 6) @map("custo_por_unidade_base") // ING-03: 0,014684
  // trigger torna a linha imutável quando referenciada (ING-07/D-03)
  usos LoteUsoIngrediente[]
  @@index([ingredienteId, dataCompra(sort: Desc)])   // ING-05/ING-08
  @@map("ingrediente_compras")
}

model Receita {
  id               String   @id @default(uuid()) @db.Uuid
  nome             String
  rendimentoPadrao Int      @map("rendimento_padrao")     // REC-03
  custoGas         Decimal? @db.Decimal(19, 4) @map("custo_gas")  // REC-04
  validadeDias     Int?     @map("validade_dias")          // D-08
  itens   ReceitaIngrediente[]
  produto Produto?
  @@map("receitas")
}

model ReceitaIngrediente {
  receitaId     String  @db.Uuid @map("receita_id")
  ingredienteId String  @db.Uuid @map("ingrediente_id")
  qtde          Decimal @db.Decimal(14, 3)                 // REC-02, na unidade-base
  @@id([receitaId, ingredienteId])
  @@map("receita_ingredientes")
}

model Produto {
  id                   String      @id @default(uuid()) @db.Uuid
  nome                 String
  descricao            String
  categoria            String                                // texto livre v1 (ver Assumptions A4)
  tipo                 TipoProduto
  precoVenda           Decimal     @db.Decimal(19, 4) @map("preco_venda")
  margemMinimaOverride Decimal?    @db.Decimal(5, 2) @map("margem_minima_override") // D-10
  receitaId            String?     @unique @db.Uuid @map("receita_id")  // null p/ KIT (D-11)
  kitItens ProdutoKitItem[] @relation("kit")
  emKits   ProdutoKitItem[] @relation("componente")
  lotes    Lote[]
  @@map("produtos")
}

model ProdutoKitItem {
  kitId        String @db.Uuid @map("kit_id")
  componenteId String @db.Uuid @map("componente_id")
  qtde         Int
  // app-level: componente.tipo === UNITARIO (CHECK não referencia outra row)
  @@id([kitId, componenteId])
  @@map("produto_kit_items")
}

model Lote {
  id                       String   @id @default(uuid()) @db.Uuid
  produtoId                String   @db.Uuid @map("produto_id")
  receitaId                String   @db.Uuid @map("receita_id")
  multiplicador            Decimal  @db.Decimal(6, 2)              // D-07
  rendimentoReal           Int      @map("rendimento_real")        // D-06
  produzidoEm              DateTime @db.Timestamptz(6) @map("produzido_em")
  validade                 DateTime @db.Date                       // D-08 / Pitfall 2.2
  qtdeDisponivel           Int      @map("qtde_disponivel")        // LOTE-04 (CHECK via SQL)
  qtdeReservada            Int      @default(0) @map("qtde_reservada")
  custoGasCongelado        Decimal  @db.Decimal(19, 4) @map("custo_gas_congelado")   // snapshot (Pitfall 2)
  custoTotalCongelado      Decimal  @db.Decimal(19, 4) @map("custo_total_congelado")
  custoPorUnidadeCongelado Decimal  @db.Decimal(19, 6) @map("custo_por_unidade_congelado")
  usos LoteUsoIngrediente[]
  @@index([validade])
  @@map("lotes")
}

model LoteUsoIngrediente {
  id                     String  @id @default(uuid()) @db.Uuid
  loteId                 String  @db.Uuid @map("lote_id")
  ingredienteCompraId    String  @db.Uuid @map("ingrediente_compra_id") // LOTE-02: NOT NULL, FK RESTRICT
  qtdeUsada              Decimal @db.Decimal(14, 3) @map("qtde_usada")
  marcaSnapshot          String  @map("marca_snapshot")                  // LOTE-03
  custoUnitarioCongelado Decimal @db.Decimal(19, 6) @map("custo_unitario_congelado")
  custoCongelado         Decimal @db.Decimal(19, 4) @map("custo_congelado")
  compra IngredienteCompra @relation(fields: [ingredienteCompraId], references: [id], onDelete: Restrict)
  @@index([ingredienteCompraId])
  @@map("lote_uso_ingredientes")
}

model Configuracao {
  id                 Int     @id @default(1)
  margemMinimaPadrao Decimal @default(30) @db.Decimal(5, 2) @map("margem_minima_padrao") // D-10
  @@map("configuracoes")
}
```
Nota de precisão: totais monetários em `numeric(19,4)` (INFRA-09); custos POR unidade-base derivados em `numeric(19,6)` — R$/g pode ser 0,0023 e 4 casas acumulam erro `[CITED: .planning/research/PITFALLS.md §2.1 e §5.5 (unit_cost_snapshot numeric(19,6))]`.

### Teste de regressão LOTE-08 (esqueleto — success criterion 5)
```typescript
// tests/financeiro/custo-congelado.test.ts
it('LOTE-08: custo congelado sobrevive a mudança de preço corrente', async () => {
  const ing = await criarIngrediente({ nome: 'Leite condensado', unidadeBase: 'g' })
  const compraA = await registrarCompra({ ingredienteId: ing.id, marca: 'Moça',
    qtdeEmbalagens: '1', tamanhoEmbalagem: '395', precoPorEmbalagem: '3,95' }) // R$0,01/g
  const receita = await criarReceita({ itens: [{ ingredienteId: ing.id, qtde: '395' }], rendimentoPadrao: 20 })
  const lote = await produzirLote({ receitaId: receita.id, rendimentoReal: 20, ... })

  // preço corrente muda: nova compra mais cara
  await registrarCompra({ ingredienteId: ing.id, marca: 'Italac', precoPorEmbalagem: '7,90', ... })

  const rows = await prisma.loteUsoIngrediente.findMany({ where: { loteId: lote.id } })
  expect(rows[0].custoUnitarioCongelado.toFixed(6)).toBe('0.010000')  // NÃO mudou
  expect(rows[0].marcaSnapshot).toBe('Moça')

  // e o schema enforça: UPDATE na compra referenciada é bloqueado pelo trigger
  await expect(
    prisma.ingredienteCompra.update({ where: { id: compraA.id }, data: { precoPorEmbalagem: '9.99' } }),
  ).rejects.toThrow(/imutavel/)

  // D-03: compra NÃO referenciada continua editável
})
```

### Custo corrente de receita (D-09 / REC-05) — server-only
```typescript
// lib/custo/corrente.ts
import 'server-only'
export async function custoCorrenteReceita(receitaId: string): Promise<{
  total: Decimal; porUnidade: Decimal; faltamCompras: string[]  // ingredientes sem compra ainda
}> {
  const receita = await prisma.receita.findUniqueOrThrow({
    where: { id: receitaId },
    include: { itens: { include: { ingrediente: true } } },  // anti N+1
  })
  const ultimas = /* Pattern 3: DISTINCT ON com ids dos ingredientes */
  // total = Σ(item.qtde × ultima.custoPorUnidadeBase) + (custoGas ?? 0)  — tudo Decimal
  // porUnidade = total ÷ rendimentoPadrao (custo corrente usa rendimento PADRÃO — D-09;
  //              rendimento REAL só entra no custo congelado do lote — D-06)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma com Rust query engine + `url` no datasource | Prisma 7: TS puro, driver adapter (`@prisma/adapter-pg`), url em `prisma.config.ts` | Prisma 7 (2026) | Já absorvido na Phase 1 — `lib/db/client.ts` é o padrão a seguir |
| `middleware.ts` / APIs síncronas | `proxy.ts` + `await headers()/cookies()` | Next 16 | Já absorvido — `clientContext()` de `lib/actions/auth.ts` |
| zodResolver only (Zod 3) | `@hookform/resolvers` 5.x via Standard Schema (Zod 4 nativo) | resolvers v5 | Instalar 5.4.0; funciona com zod 4.4 já instalado |
| shadcn styles `new-york`/`default` | CLI v3+ presets (`radix-nova` neste projeto) com pacote unificado `radix-ui` | shadcn 3/4 (2025-26) | `form` é stub no radix-nova — workaround verificado (§Standard Stack) |
| `poolOptions.forks.singleFork` (vitest) | `fileParallelism: false` | Vitest 4 | Já configurado — não mexer |

**Deprecated/outdated:**
- `prisma db push` para este projeto: incompatível com migrations que carregam SQL custom (trigger/CHECK).
- `z.number()` para dinheiro: sempre string→Decimal.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Margem = (preço − custo) ÷ preço × 100 (margem sobre preço de venda, não markup sobre custo) | Patterns/custo | `[ASSUMED]` Threshold de 30% dispara em pontos diferentes; ex.: custo 7, preço 10 → margem 30% (ok) vs markup 42,9%. Confirmar com a usuária ou fixar no plano como definição documentada na UI ("de cada R$10, R$3 ficam com você") |
| A2 | "Última compra" (ING-05/D-05) ordena por `data_compra DESC` com desempate por `created_at DESC` (backfill de compra antiga não vira "corrente") | Pattern 3 | `[ASSUMED]` Se a intenção for "última registrada", troca-se a ordenação — impacto baixo, 1 linha |
| A3 | Canonicalização de marca/mercado: match case-insensitive reutiliza a grafia já armazenada (primeira grafia vence) | Pattern 5 | `[ASSUMED]` D-04 pede "caixa consistente" sem definir regra; alternativa é Title Case forçado (quebra 'OMO') |
| A4 | `categoria` de produto é texto livre com autocomplete (mesmo padrão D-04), sem enum/tabela na v1 | Schema | `[ASSUMED]` REQUIREMENTS não define lista; Phase 3 (CAT-04) filtra por ela — texto livre com autocomplete canônico é suficiente e migra fácil |
| A5 | `qtde_embalagens` aceita fração (Decimal, ex. "0,5 kg a granel"), não Int | Schema | `[ASSUMED]` Custo baixo de aceitar Decimal; se Int, granel exige embalagem=1×qtde |
| A6 | Phase 2 NÃO adiciona coluna `ativo` em produtos (PROD-06 é Phase 3); vitrine não existe ainda, nada quebra | Schema | `[ASSUMED]` Se planner preferir forward-compat, adicionar `ativo boolean default false` agora custa 1 coluna |

## Open Questions

1. **LOTE-06 (validade imutável após primeira reserva ativa) — enforcement adiantado ou adiado?**
   - What we know: reservas só existem na Phase 4; um trigger que consulte `reservas` não compila hoje. O requirement está mapeado para Phase 2.
   - What's unclear: se o roadmap espera mecanismo concreto agora.
   - Recommendation: Phase 2 satisfaz vacuamente (não há reservas → validade sempre editável está correto) e entrega a action de edição de validade já estruturada com um ponto único de guard (`podeEditarValidade(lote)` retornando `true` hoje); Phase 4 adiciona o trigger/check junto com a tabela de reservas. Registrar isso no PLAN como handoff explícito para a Phase 4.

2. **Alerta de margem derrubada por compra nova (Claude's Discretion do CONTEXT):**
   - What we know: recomendação do CONTEXT é item em "ações pendentes" da home admin; alternativa mínima é linha vermelha só ao abrir o produto.
   - Recommendation: implementar a versão computada-on-read na home admin (query batch de margens correntes < threshold — sem tabela nova, sem job): custo O(1 página) e é o embrião natural do ADM-01. Evitar tabela de notificações/job pg-boss nesta fase (scope creep).

3. **Trigger error → mensagem amigável:** Prisma 7 repassa o RAISE como erro genérico de query. O plano deve padronizar: checagem `EXISTS` preventiva na action (UX) + catch com match em `imutavel` (defesa). Nenhum bloqueio — só disciplina de implementação.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next 16 (≥20.9) | ✓ | v24.14.0 `[VERIFIED: node --version]` | — |
| Postgres local + DATABASE_URL | migrations, testes | ✓ | 16 (suite Phase 1 verde 73/75 contra ele) | — |
| Prisma CLI | migration custom | ✓ | 7.8.0, `--create-only` confirmado `[VERIFIED: CLI help]` | — |
| vitest | LOTE-08 e demais testes | ✓ | 4.1.9 | — |
| shadcn CLI | componentes novos | ✓ | 4.12.0 (dep local) — invocar por caminho absoluto (hook rtk intercepta `npx`) | vendorar componente manualmente |
| react-hook-form | forms admin | ✗ (instalar) | npm latest 7.80.0 | `useActionState` puro (pior DX p/ arrays) |
| @hookform/resolvers | bridge Zod | ✗ (instalar) | npm latest 5.4.0 | validação manual no submit |
| Acesso à internet p/ registry shadcn | add form/combobox | ✓ (verificado neste research) | — | copiar form.tsx do registry fetch já feito |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** react-hook-form + resolvers (instalação trivial via npm — primeiro task do plano).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (environment node, DB real via Prisma) |
| Config file | `vitest.config.ts` (fileParallelism: false — DB único; NÃO paralelizar) |
| Quick run command | `rtk npx vitest run tests/financeiro --reporter=dot` |
| Full suite command | `rtk npm test` |

⚠️ **Test DB == dev DB** (MEMORY do projeto): a suite trunca as tabelas afterEach. Todo `deleteMany` dos models novos entra em `tests/setup.ts` e `tests/conftest.ts#truncateAll` **children-first**: `loteUsoIngrediente, lote, produtoKitItem, produto, receitaIngrediente, receita, ingredienteCompra, ingrediente, configuracao` (antes dos da Phase 1).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ING-03 | 2×395g a R$5,80 → qtde_total 790g, custo/g exato (Decimal) | unit/integration | `rtk npx vitest run tests/financeiro/compras.test.ts` | ❌ Wave 0 |
| ING-04/ING-07/D-03 | UPDATE/DELETE de compra referenciada bloqueado; não-referenciada editável | integration (trigger real) | idem | ❌ Wave 0 |
| ING-05 | última compra por data (desempate created_at) | integration | idem | ❌ Wave 0 |
| ING-06 | embalagem cadastra com tipo=EMBALAGEM no mesmo fluxo | integration | idem | ❌ Wave 0 |
| REC-05 | custo total e por unidade da receita (com e sem gás) — casos com dízima (1/3 × 3) | unit sobre lib/custo | `rtk npx vitest run tests/financeiro/custo-corrente.test.ts` | ❌ Wave 0 |
| LOTE-01..03 | produzir lote grava usos com FK compra + marca_snapshot + custo_congelado | integration | `rtk npx vitest run tests/financeiro/lotes.test.ts` | ❌ Wave 0 |
| LOTE-04 | UPDATE que negativa qtde aborta (CHECK) | integration | idem | ❌ Wave 0 |
| LOTE-07 | filtros vigente/vencido/esgotado com data BRT | integration | idem | ❌ Wave 0 |
| **LOTE-08** | **regressão: preço corrente muda → custo congelado intacto** (success criterion 5) | **integration — MANDATÓRIO** | `rtk npx vitest run tests/financeiro/custo-congelado.test.ts` | ❌ Wave 0 |
| PROD-08/D-10/D-11 | margem corrente (unitário e kit) vs threshold global/override | unit sobre lib/custo | idem custo-corrente | ❌ Wave 0 |
| PROD-09 | action de produto rejeita preço < custo (server-side, com requireAdmin mockado) | integration (padrão 01-08: mock next/headers) | `rtk npx vitest run tests/financeiro/produtos.test.ts` | ❌ Wave 0 |
| ING-08, LOTE-05(schema), PROD-01/02, PROD-10, REC-01..04 | páginas/CRUD simples | integration leve + manual (UI via /gsd-ui-phase) | suites acima | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `rtk npx vitest run tests/financeiro --reporter=dot`
- **Per wave merge:** `rtk npm test` (suite completa — 73/75 da Phase 1 deve continuar verde)
- **Phase gate:** suite completa verde + LOTE-08 passando antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/setup.ts` + `tests/conftest.ts` — deleteMany dos 9 models novos, children-first (Pitfall 5)
- [ ] `tests/financeiro/fixtures.ts` — factories: `criarIngrediente`, `registrarCompra`, `criarReceita`, `criarProduto`, `produzirLote` (reutilizam as Server Actions ou o Prisma direto + lib/custo)
- [ ] `tests/financeiro/custo-congelado.test.ts` — LOTE-08 (escrever ANTES do fluxo de lote)
- [ ] Framework: nenhum install necessário (vitest + mocks de `next/headers`/`next/navigation` já padronizados no 01-08)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (nada novo) | Better Auth da Phase 1 inalterado |
| V3 Session Management | no | idem |
| V4 Access Control | **yes — núcleo da fase** | `requireAdmin()` DENTRO de cada Server Action (layout não protege actions `[CITED: Next data-security.md]`); páginas seguem role-gate do layout `(admin)` |
| V5 Input Validation | yes | Zod 4 em toda action; `zDecimalBRL` p/ dinheiro; IDs validados como uuid |
| V6 Cryptography | no (nada novo) | hashPii/logAudit existentes |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server Action de mutação invocada por cliente autenticado não-admin | Elevation of Privilege | `requireAdmin()` primeira linha de toda action; teste com sessão customer esperando erro |
| SQL injection via `$queryRaw` (DISTINCT ON, autocomplete) | Tampering | Só tagged templates (auto-parametrizado); `Prisma.raw` apenas com allowlist literal (`'marca'\|'mercado'`); NUNCA `$queryRawUnsafe` |
| Custo/margem forjados pelo client (bypass PROD-09) | Tampering | Server recomputa custo dentro da action/transação a partir das rows FK'adas; client só manda IDs + quantidades |
| Reescrita de histórico financeiro (por bug ou acesso direto) | Tampering/Repudiation | Trigger + FK RESTRICT + CHECK no schema; audit `preco_alterado`/`lote_criado`/`compra_registrada` via `logAudit` (metadata com valores antes/depois p/ preço) |
| Enumeração/abuso de actions admin | DoS | Rate limit in-process existente (rate-limiter-flexible) já cobre boundary; actions admin podem reusar consume como defesa em profundidade (padrão 01-08) |
| PII em log de query (`log: ['query']` em dev) | Information Disclosure | Fase não introduz PII nova (dados de ingrediente/preço); manter pino redact p/ qualquer log de action |

## Project Constraints (from CLAUDE.md)

- **rtk prefix obrigatório** em todos os comandos bash (inclusive em cadeias `&&`): `rtk git ...`, `rtk npm ...`, `rtk npx vitest ...`. Exceção prática verificada: o hook rtk intercepta `npx prisma`/`npx shadcn` com wrapper próprio — para flags não suportadas pelo wrapper, invocar o binário por caminho (`node node_modules/prisma/build/index.js ...`), learning do 01-07.
- **Next.js 16 ≠ training data**: ler `node_modules/next/dist/docs/` antes de propor APIs (proxy.ts, async headers/cookies, revalidateTag com cacheLife).
- **Prisma 7 ≠ v6**: Rust engine removido; url em `prisma.config.ts`; driver adapter em `lib/db/client.ts`; `$queryRaw` p/ features Postgres-only.
- **Locked**: money `numeric(19,4)`, datas `timestamptz` + `TZ=America/Sao_Paulo`, custo congelado por `ingrediente_compra_id`, Better Auth, pg-boss, sem Redis.
- **Sempre commitar `.planning/`** (`commit_docs: true`).
- Ler `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` antes de sugerir trabalho (feito neste research).

## Sources

### Primary (HIGH confidence — verificado nesta sessão)
- `node_modules/prisma/build/index.js migrate dev --help` — flag `--create-only` existe no Prisma 7.8 instalado
- `node_modules/@prisma/client/runtime/client.d.ts` — `JsInputValue` aceita string/DecimalJsLike p/ colunas Decimal; `node_modules/@prisma/client-runtime-utils/dist/index.d.ts` — classe `Decimal` completa (toFixed, toDecimalPlaces, mul, etc.)
- `node_modules/.prisma/client/index.d.ts` — `distinct`, `groupBy`, `$queryRaw`, `$transaction` presentes no client gerado
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — props de Client Components devem ser serializáveis; `.../02-guides/data-security.md`, `forms.md` — autorização dentro de Server Actions, padrão de forms
- `ui.shadcn.com/r/styles/radix-nova/*.json` (fetch ao vivo 2026-07-03) — `form` é stub vazio; `select/textarea/dialog/badge/popover/command/combobox/sheet` reais; `new-york-v4/form.json` completo (deps: radix-ui, RHF, resolvers, zod)
- `npm view` (2026-07-03): react-hook-form 7.80.0, @hookform/resolvers 5.4.0 (deps: @standard-schema/utils), prisma 7.80.0→7.8.0 local ok, decimal.js 10.6.0
- Codebase: `prisma/schema.prisma`, `lib/db/client.ts`, `lib/actions/auth.ts`, `lib/audit/log.ts`, `tests/setup.ts`, `tests/conftest.ts`, `vitest.config.ts`, `components.json`, migrations Phase 1

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` §2.1, §2.2, §4.3, §5.5, §1.4, §1.5 — pitfalls canônicos da fase (locked)
- `.planning/research/STACK.md` — decimal.js/RHF/Prisma racionais (locked, revisado 2026-04-30)
- postgresql.org/docs/16 — plpgsql triggers, CHECK constraints, DISTINCT ON (padrões estáveis do PG, não re-verificados nesta sessão)
- react-hook-form.com/docs/usefieldarray — API estável em toda a série 7.x

### Tertiary (LOW confidence / assumed)
- Definição exata de "margem" (A1) e regras de canonicalização de caixa (A3) — decisões de produto, não fatos técnicos; ver Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tudo verificado contra node_modules instalado, npm registry e registry shadcn ao vivo
- Architecture: HIGH — padrões derivados de código Phase 1 real e existente; schema é recomendação (Claude's Discretion explícita no CONTEXT)
- Pitfalls: HIGH — combinam pitfalls canônicos locked da research global com verificações desta sessão (form stub, Decimal serialization, test DB)
- Assumptions (A1–A6): decisões de produto flagadas — não bloqueiam planning, mas A1 (definição de margem) merece confirmação

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (stack pinado em package.json; único item volátil é o registry shadcn)
