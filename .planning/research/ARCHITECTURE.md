# Architecture Research — Doces Valentina

**Domain:** SaaS de catálogo + reserva + gestão de produção (BOM com event-sourcing parcial)
**Researched:** 2026-04-29
**Confidence:** HIGH (data model derivado diretamente do PROJECT.md; padrões Next.js 16 verificados em `node_modules/next/dist/docs/`)

---

## 1. System Overview

Monolito Next.js 16 (App Router) + Postgres em VPS único. Sem microsserviços, sem serverless, sem fila distribuída. **Toda a lógica de domínio mora em uma camada de services chamada por Server Actions.**

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CLIENTE (mobile)        ADMIN (tablet/celular)     │
│                          │                          │                 │
│                          ▼                          ▼                 │
├──────────────────────────────────────────────────────────────────────┤
│                    Next.js 16 App Router                             │
│  app/(public)/...        app/(admin)/...        app/api/webhooks/... │
│  page.tsx → RSC          page.tsx → RSC         route.ts (Resend)    │
│      │                       │                      │                 │
│      ▼                       ▼                      ▼                 │
├──────────────────────────────────────────────────────────────────────┤
│                       Server Actions ('use server')                  │
│   reservas.ts | lotes.ts | pontos.ts | sorteios.ts | resgates.ts     │
│                              │                                        │
│                              ▼                                        │
├──────────────────────────────────────────────────────────────────────┤
│                       Domain Services (lib/services/)                │
│   ReservaService | LoteService | PontosLedger | SorteioService       │
│   PrecificacaoService | CustoCongelador | CampanhaResolver           │
│                              │                                        │
│                              ▼                                        │
├──────────────────────────────────────────────────────────────────────┤
│              Repositories (lib/db/) — Drizzle/Prisma queries         │
│                              │                                        │
│                              ▼                                        │
├──────────────────────────────────────────────────────────────────────┤
│   PostgreSQL 16 (Docker na VPS)                                      │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│   │ ingredi- │ │ receitas │ │  lotes   │ │ reservas │               │
│   │  entes   │ │          │ │          │ │          │               │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│   │ pontos_  │ │ sorteios │ │ campa-   │ │  audit_  │               │
│   │transacoes│ │          │ │  nhas    │ │   log    │               │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
├──────────────────────────────────────────────────────────────────────┤
│   Background workers (mesmo processo Node, via node-cron)            │
│   • Sorteio expirado (a cada 5 min)                                  │
│   • Lotes vencidos (a cada hora)                                     │
│   • Backup pg_dump → R2 (1×/dia)                                     │
├──────────────────────────────────────────────────────────────────────┤
│   Externos: Resend (email) | Cloudflare R2 (backup + fotos v2)       │
└──────────────────────────────────────────────────────────────────────┘
```

### Por que essa estrutura

- **VPS único + Postgres** elimina serverless cold-starts e custos imprevisíveis. Trade-off explícito: sem auto-scale, mas o público é bairro, não Brasil.
- **Server Actions como fronteira** é a forma idiomática do Next.js 16 (verificado em `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`). Toda action chama um service — actions não fazem SQL diretamente.
- **Services puros** (sem dependência de `next/*`) são testáveis sem rodar o server e reutilizáveis por route handlers, cron jobs e seeds.
- **node-cron no mesmo processo** é o caminho de menor fricção em VPS único. Inngest self-hosted seria overkill para 3 jobs.

---

## 2. Modelo de Dados (núcleo do sistema)

### 2.1 Diagrama de entidades

```
                            ┌──────────────────┐
                            │   ingredientes   │  (conceito: "Açúcar refinado")
                            │   id, nome,      │
                            │   unidade_base,  │
                            │   tipo (insumo|  │
                            │     embalagem)   │
                            └────────┬─────────┘
                                     │ 1
                                     │
                                     │ N
                            ┌────────▼─────────┐
                            │  ingrediente_    │  (evento de compra — IMUTÁVEL)
                            │     compras      │
                            │  id, ing_id,     │
                            │  data, mercado,  │
                            │  marca, qtde,    │
                            │  preco_total,    │
                            │  custo_unit_base │  ← derivado: preco/qtde
                            │  qtde_restante   │  ← decremental, mas não FIFO
                            └────────┬─────────┘
                                     │ 1
                                     │
                                     │ N
                            ┌────────▼─────────┐         ┌───────────────────┐
                            │  lote_uso_       │ N    1  │      lotes        │
                            │  ingredientes    ├────────►│  id, receita_id,  │
                            │  lote_id,        │         │  data_producao,   │
                            │  ing_compra_id,  │         │  validade,        │
                            │  qtde_usada,     │         │  rendimento_real, │
                            │  custo_congelado │         │  custo_gas,       │
                            │  marca_snapshot  │  ← log  │  custo_total,     │  ← computed após criação
                            │  preco_unit_snap │  ← log  │  custo_unitario,  │  ← computed
                            └──────────────────┘         │  qtde_disponivel, │
                                                         │  produto_id       │
                            ┌──────────────────┐         └────────┬──────────┘
                            │     receitas     │ 1            N  │
                            │  id, produto_id, ◄─────────────────┘
                            │  rendimento_pad, │
                            │  custo_gas_pad   │
                            └────────┬─────────┘
                                     │ 1
                                     │
                                     │ N
                            ┌────────▼─────────┐
                            │  receita_        │
                            │  ingredientes    │
                            │  receita_id,     │
                            │  ingrediente_id, │
                            │  qtde            │
                            └──────────────────┘

   ┌──────────────────┐  N    M  ┌──────────────────┐
   │     produtos     │◄────────►│  kit_produto_    │  (composição: produto unitário OU kit)
   │  id, nome, tipo  │          │     itens        │
   │  (UNITARIO|KIT), │          │  kit_id,         │
   │  preco_venda,    │          │  produto_filho_id│
   │  campanha_id?,   │          │  qtde            │
   │  categoria_id    │          └──────────────────┘
   └────────┬─────────┘
            │ 1
            │ N
   ┌────────▼─────────┐    1   N  ┌──────────────────┐
   │  produto_fotos   │           │     reservas     │
   │  id, produto_id, │           │  id, cliente_id, │
   │  url, ordem      │           │  status,         │
   └──────────────────┘           │  delivery_mode,  │  ← já vem com isso desde v1
                                  │  total_centavos, │
                                  │  pontos_a_creditar│
                                  │  criada_em,      │
                                  │  confirmada_em?, │
                                  │  cancelada_em?   │
                                  └────────┬─────────┘
                                           │ 1
                                           │ N
                                  ┌────────▼─────────┐
                                  │  reserva_itens   │
                                  │  id, reserva_id, │
                                  │  lote_id,        │  ← amarrado ao lote
                                  │  produto_id,     │
                                  │  qtde,           │
                                  │  preco_unit      │  ← snapshot
                                  └──────────────────┘

   ┌──────────────────┐
   │    clientes      │ 1 ──► N pontos_transacoes (ledger imutável)
   │  id, email, nome,│      ┌──────────────────────┐
   │  telefone, hash, │      │  pontos_transacoes   │
   │  termos_aceitos  │      │  id, cliente_id,     │
   └──────────────────┘      │  delta (+/-),        │  ← + por confirmação, - por sorteio/resgate
                             │  motivo (enum),      │  ← RESERVA_CONFIRMADA, SORTEIO_INSCRICAO,
                             │  ref_tipo, ref_id,   │     RESGATE, AJUSTE_MANUAL
                             │  saldo_apos,         │  ← redundância p/ debug; nunca recalcular
                             │  criada_em           │
                             └──────────────────────┘

   ┌──────────────────┐    1   N  ┌──────────────────┐
   │    sorteios      │──────────►│  sorteio_        │
   │  id, titulo,     │           │  inscricoes      │
   │  premio_desc,    │           │  cliente_id,     │
   │  custo_pontos,   │           │  sorteio_id,     │
   │  prazo_fim,      │           │  pontos_         │
   │  status (ABERTO| │           │  transacao_id    │
   │   FECHADO|       │           └──────────────────┘
   │   SORTEADO),     │
   │  vencedor_id?    │  ← FK para sorteio_inscricoes
   └──────────────────┘

   ┌──────────────────────┐
   │  catalogo_resgate    │  (referencia produto OU define item próprio)
   │  id, produto_id?,    │
   │  nome_custom?,       │
   │  custo_pontos,       │
   │  ativo               │
   └──────────────────────┘

   ┌──────────────────┐    1   N  ┌──────────────────┐
   │    campanhas     │──────────►│ produto_campanha │  (M:N produtos↔campanhas)
   │  id, nome, slug, │           └──────────────────┘
   │  inicio, fim,    │
   │  banner_url,     │
   │  paleta_json     │  ← {primary, secondary, accent, bg}
   │  ativa_auto      │  ← bool: aparece sozinha na janela
   └──────────────────┘

   ┌──────────────────┐
   │   audit_log      │  (tudo que admin faz)
   │  id, ator_id,    │
   │  acao (enum),    │
   │  ref_tipo,       │
   │  ref_id,         │
   │  payload_json,   │
   │  criada_em       │
   └──────────────────┘
```

### 2.2 Decisões-chave do data model (com trade-offs)

#### Decisão D1: Compras como eventos imutáveis (event sourcing parcial)

**O que:** `ingrediente_compras` é append-only. Cada compra é uma linha, nunca alterada. `qtde_restante` é o único campo mutável (decrementa quando lote consome).

**Por quê:** Custo histórico precisa rastrear a marca exata usada em cada lote produzido — se sobrescrevêssemos a compra, perderíamos a história.

**Trade-off:** Tabela cresce indefinidamente. Mas: 1 compra ≈ 1 linha; mãe compra ~50 ingredientes/mês × 12 = 600 linhas/ano. Irrelevante.

**Alternativa rejeitada:** Atualizar preço corrente direto em `ingredientes`. Perderia histórico — viola requisito explícito do PROJECT.md.

#### Decisão D2: Lote congela custo via DENORMALIZAÇÃO em `lote_uso_ingredientes`

**O que:** Quando lote é criado, cada uso copia `custo_unit_base` e `marca` da compra para `lote_uso_ingredientes` como `custo_congelado` e `marca_snapshot`. Sem JSON blob — colunas tipadas.

**Por quê:**
- Snapshot preserva valor histórico mesmo se compra original for corrigida (raro mas possível: erro de digitação).
- Análise por marca fica `SELECT marca_snapshot, AVG(...) FROM lote_uso_ingredientes JOIN lotes ...` — query simples, indexável.
- FK para `ingrediente_compra_id` MANTIDA para rastreio (não é só snapshot solto).

**Trade-off:** Dado replicado. Mas isso é o **ponto** — o lote é uma fotografia. Ganhamos integridade histórica e queries diretas.

**Alternativa rejeitada:** JSON blob `snapshot_json` em `lotes`. Perderíamos índice em marca, perderíamos JOIN. Pior.

**Alternativa rejeitada:** Calcular tudo on-the-fly via FK para compra. Quebra se compra for corrigida; perde análise por marca quando ingrediente é renomeado.

#### Decisão D3: Embalagem é `ingrediente.tipo = 'EMBALAGEM'`

**O que:** Forminha, caixa, fita, sacola entram na MESMA tabela `ingredientes`, com flag `tipo`.

**Por quê:** PROJECT.md define isso explicitamente. Reduz UI a um único formulário.

**Implicação:** `unidade_base` para embalagem é `unidade` (não `g` ou `ml`). Validar no schema.

#### Decisão D4: Sub-receitas — NÃO ter na v1

**O que:** Se "calda de açúcar" é usada em 3 doces, a calda NÃO é uma receita-pai com 3 receitas-filhas. Cada produto duplica os ingredientes da calda na própria receita.

**Por quê:**
- Mãe pensa em "ingredientes que vão no brigadeiro", não em "sub-componentes". Mental model wins.
- Sub-receitas exigem grafo + cálculo recursivo de custo + UI de árvore. Complexidade enorme para 1 caso de uso.
- Duplicação custa segundos/mês em data entry, mas zera complexidade.

**Quando reconsiderar:** Se a mãe começar a manter >5 receitas com sub-componente comum E reclamar disso.

**Trade-off:** Duplicação de dados de receita. Aceito.

#### Decisão D5: `produtos.tipo` enum (UNITARIO|KIT) com tabela única

**O que:** Brigadeiro e "Cesta de Páscoa" estão na mesma tabela `produtos`. Diferença é só `tipo` e a presença/ausência de linhas em `kit_produto_itens`.

**Por quê:** Listagem unificada na vitrine. Reserva trata produto como produto. Receita só existe para `UNITARIO` (kit não tem receita — é composição).

**Trade-off:** Schema permite combinações inválidas (kit com receita). Validar em service layer + constraint condicional Postgres se quiser garantia.

#### Decisão D6: `pontos_transacoes` como ledger imutável; saldo derivado

**O que:** Não existe coluna `saldo_pontos` em `clientes`. Saldo = `SUM(delta) WHERE cliente_id = X`. Cache em view materializada se virar gargalo (improvável).

**Por quê:**
- Auditável: explica cada ponto.
- Anti-bug: impossível dessincronizar saldo de movimentações.
- Reverter sorteio = inserir transação inversa, não editar.
- `saldo_apos` é redundância para debug, nunca usada como fonte de verdade.

**Trade-off:** SUM em cada exibição de saldo. Index em `cliente_id` + tabela cresce devagar (1 transação ≈ 1 reserva confirmada) → trivial.

#### Decisão D7: `delivery_mode` desde v1

**O que:** Coluna `reservas.delivery_mode` enum (`RETIRADA`, `ENTREGA`) com default `RETIRADA`. UI esconde a opção `ENTREGA` na v1.

**Por quê:** PROJECT.md ordena explicitamente. Migrar schema depois é bem mais doloroso que carregar uma coluna não usada.

#### Decisão D8: Reserva consome lote específico (não produto abstrato)

**O que:** `reserva_itens.lote_id` é NOT NULL. Cliente reserva "Brigadeiro lote 16/04", não "Brigadeiro".

**Por quê:**
- Permite ao cliente ver validade.
- Permite a baixa atômica em `lotes.qtde_disponivel`.
- Suporta "vence em 2 dias, último lote" sem ambiguidade.

**Trade-off:** Se mãe quer "vender brigadeiro" e o cliente não escolhe lote, sistema escolhe (regra: lote mais antigo com validade ≥ 3 dias). Service layer cuida disso. Mas FK fica no item.

#### Decisão D9: Catálogo de resgate é tabela separada que pode REFERENCIAR produto

**O que:** `catalogo_resgate` tem `produto_id?` (nullable) OU `nome_custom`. Mãe escolhe: "10 brigadeiros = 200 pts" (referência ao produto unitário, mas em grupo) ou "Caneca da Valentina = 500 pts" (item exclusivo do resgate, não no catálogo principal).

**Por quê:** Flexibilidade sem duplicação. Resgate pode ser produto que ela já vende OU brinde exclusivo.

**Trade-off:** Schema tem nullability. Validar XOR (`produto_id IS NOT NULL XOR nome_custom IS NOT NULL`) via CHECK constraint.

#### Decisão D10: Campanha tem paleta visual em JSON

**O que:** `campanhas.paleta_json` armazena `{primary, secondary, accent, bg}` como JSONB.

**Por quê:** Valores opacos para o sistema (CSS variables). Schema rígido daria 4 colunas para o mesmo conceito. JSONB é o uso clássico.

**Trade-off:** Sem validação no banco. Validar com Zod no service.

---

## 3. Camadas e Módulos

### 3.1 Estrutura de pastas recomendada

```
app/
├── (public)/                          # Cliente — sem auth de admin
│   ├── layout.tsx                     # Header com paleta da campanha ativa
│   ├── page.tsx                       # Vitrine
│   ├── produto/[slug]/page.tsx        # Detalhe + lotes disponíveis
│   ├── carrinho/page.tsx              # Reserva em construção
│   ├── conta/
│   │   ├── page.tsx                   # Painel cliente
│   │   ├── reservas/page.tsx
│   │   └── pontos/page.tsx
│   ├── login/page.tsx                 # Fluxo email-first
│   └── cadastro/page.tsx
│
├── (admin)/admin/                     # Mãe — guarded
│   ├── layout.tsx                     # Auth check + alerta sonoro
│   ├── page.tsx                       # Dashboard do dia
│   ├── reservas/page.tsx              # Lista, confirmar, cancelar
│   ├── lotes/
│   │   ├── page.tsx
│   │   └── novo/page.tsx              # Criar lote = consumir compras
│   ├── ingredientes/
│   │   ├── page.tsx
│   │   ├── [id]/compras/page.tsx      # Histórico de compras
│   │   └── nova-compra/page.tsx
│   ├── receitas/page.tsx
│   ├── produtos/page.tsx              # Catálogo + kits
│   ├── campanhas/page.tsx
│   ├── sorteios/page.tsx
│   ├── resgate/page.tsx
│   └── relatorios/
│       ├── faturamento/page.tsx
│       ├── margem/page.tsx
│       └── marcas/page.tsx
│
├── api/
│   ├── webhooks/resend/route.ts       # Bounce/complaint do email
│   └── cron/                          # Endpoints chamados por node-cron
│       ├── sorteio-expirado/route.ts
│       └── lotes-vencidos/route.ts
│
└── layout.tsx                         # Root

lib/
├── db/
│   ├── schema.ts                      # Drizzle schema (toda tabela)
│   ├── client.ts                      # Pool postgres
│   └── migrations/                    # Drizzle Kit migrations
│
├── services/                          # Domain logic — SEM dependência de next/*
│   ├── ingrediente-service.ts
│   ├── compra-service.ts              # registrarCompra(...)
│   ├── receita-service.ts
│   ├── lote-service.ts                # criarLote(...) — congela custo
│   ├── produto-service.ts
│   ├── reserva-service.ts             # criar, confirmar, cancelar
│   ├── pontos-ledger.ts               # creditar(), debitar(), saldo()
│   ├── sorteio-service.ts             # inscrever, sortear
│   ├── resgate-service.ts
│   ├── campanha-resolver.ts           # campanhaAtiva(now) → paleta
│   ├── precificacao-service.ts        # margem, alerta
│   └── audit-log.ts                   # logAcao(ator, acao, ref, payload)
│
├── actions/                           # Server Actions — fina camada que chama service
│   ├── reservas.ts                    # 'use server'
│   ├── lotes.ts
│   ├── compras.ts
│   ├── pontos.ts
│   ├── sorteios.ts
│   └── resgates.ts
│
├── auth/
│   ├── client-auth.ts                 # Cliente final (email/senha)
│   └── admin-auth.ts                  # Mãe (login único)
│
├── email/
│   ├── resend-client.ts
│   └── templates/                     # JSX para Resend
│       ├── reserva-criada.tsx
│       ├── reserva-confirmada.tsx
│       ├── pontos-creditados.tsx
│       ├── sorteio-aberto.tsx
│       └── sorteio-ganho.tsx
│
├── jobs/
│   ├── scheduler.ts                   # node-cron registra jobs
│   ├── sortear-expirados.ts
│   ├── invalidar-lotes-vencidos.ts
│   └── backup-postgres.ts
│
├── domain/                            # Tipos puros + helpers
│   ├── types.ts                       # Reserva, Lote, Cliente etc.
│   ├── enums.ts
│   └── money.ts                       # int64 centavos, sem float
│
└── validation/                        # Zod schemas
    ├── reserva.ts
    ├── lote.ts
    └── ...

instrumentation.ts                     # Inicia node-cron uma vez no boot
```

### 3.2 Onde mora cada coisa

| Coisa | Onde | Por quê |
|------|------|---------|
| Validação de input | `lib/validation/*.ts` (Zod) | Reusada por action e route handler |
| SQL | `lib/db/` apenas | Service nunca importa Drizzle direto fora desse módulo |
| Regra de negócio (ex.: "só credita pontos depois de confirmar") | `lib/services/*.ts` | Testável sem Next |
| Auth check | Server Action (primeiro statement) | Princípio Next 16: action é exposta por POST direto |
| Revalidate cache | Server Action (após mutar) | `revalidatePath()` / `revalidateTag()` |
| Email send | Service chama `lib/email/` | Mesmo serviço dispara email + auditoria |
| Cron jobs | `lib/jobs/*` invocados por `instrumentation.ts` | Mesmo processo Node — sem infra extra |
| Audit log | `services/*` chama `audit-log.ts` antes de retornar | Não confiar em interceptor — explícito > mágico |

### 3.3 Fluxo padrão de uma mutação

```
[Form na page.tsx (RSC ou client)]
        │ formAction={confirmarReserva}
        ▼
[lib/actions/reservas.ts → confirmarReserva (Server Action)]
        │  1. 'use server'
        │  2. assertAdmin(session)
        │  3. const input = ConfirmarReservaSchema.parse(formData)
        │  4. result = await ReservaService.confirmar(input, session.userId)
        │  5. revalidatePath('/admin/reservas')
        │  6. revalidatePath(`/conta/reservas`)
        │  7. return result
        ▼
[ReservaService.confirmar (lib/services)]
        │  TX BEGIN
        │  • UPDATE reservas SET status='CONFIRMADA', confirmada_em=NOW()
        │  • UPDATE reserva_itens — sem mudança
        │  • UPDATE lotes SET qtde_disponivel = qtde_disponivel - X (FOR UPDATE)
        │  • INSERT pontos_transacoes (delta=+pts, motivo='RESERVA_CONFIRMADA', ref=reserva_id)
        │  • INSERT audit_log
        │  TX COMMIT
        │  • EmailService.send('reserva-confirmada', cliente)  ← FORA da TX
        ▼
[volta para a action]
        ▼
[Next renderiza partial — RSC streamed]
```

**Regra de ouro:** Email FORA da transação. Email demorando ou falhando não pode rollar back uma confirmação. Se o email falhar, log + retry manual via UI.

---

## 4. Fluxos Críticos (sequência)

### Fluxo F1 — Reserva (atomicidade em 2 etapas)

```
ETAPA 1: Cliente cria reserva (status = PENDENTE)

cliente clica "reservar"
   ↓
Server Action criarReserva(itens[])
   ↓
ReservaService.criar:
   TX BEGIN
   • Para cada item: SELECT lote FOR UPDATE; checa qtde_disponivel >= qtde
   • Se OK: NÃO decrementa ainda (status pendente, mãe pode não confirmar)
   • Decremento "soft": cria coluna qtde_reservada em lotes (incrementa)
       qtde_visivel = qtde_disponivel - qtde_reservada
   • INSERT reserva (status=PENDENTE, pontos_a_creditar=calc)
   • INSERT reserva_itens
   • INSERT audit_log
   TX COMMIT
   ↓
Email para mãe ("nova reserva!") + alerta no painel admin (polling/SSE)


ETAPA 2: Mãe confirma reserva (status = CONFIRMADA)

mãe clica "confirmar"
   ↓
ReservaService.confirmar:
   TX BEGIN
   • SELECT reserva FOR UPDATE; checa status==PENDENTE
   • UPDATE reserva SET status=CONFIRMADA
   • UPDATE lotes: qtde_disponivel -= qtde, qtde_reservada -= qtde
   • INSERT pontos_transacoes (delta=+pts)
   • INSERT audit_log
   TX COMMIT
   ↓
Email para cliente ("confirmada!" + pontos creditados)


ETAPA ALTERNATIVA: Cliente cancela (status = CANCELADA)

cliente clica "cancelar" (se dentro da janela X horas)
   ↓
ReservaService.cancelar:
   TX BEGIN
   • SELECT reserva FOR UPDATE; checa status==PENDENTE && criada_em > NOW() - X
   • UPDATE reserva SET status=CANCELADA
   • UPDATE lotes: qtde_reservada -= qtde  (libera para outros)
   • Pontos NÃO movem (nunca foram creditados)
   • INSERT audit_log
   TX COMMIT
   ↓
Email para mãe ("cliente cancelou")
```

### Fluxo F2 — Produção de lote (custo congela)

```
mãe abre "novo lote"
   ↓
seleciona receita
   ↓
sistema sugere ingredientes da receita × quantidade
   ↓
PARA CADA ingrediente:
   • sistema lista compras com qtde_restante > 0 (mais recente primeiro)
   • mãe escolhe DE QUAL compra puxar (escolha manual — preserva intenção)
   • sistema mostra custo_unit_base daquela compra
   ↓
mãe informa: rendimento real, custo de gás
   ↓
LoteService.criar:
   TX BEGIN
   • INSERT lote (custo_total e custo_unitario calculados ANTES, snapshot final)
   • Para cada ingrediente da receita:
       UPDATE ingrediente_compras: qtde_restante -= qtde_usada
       INSERT lote_uso_ingredientes (
         lote_id, ingrediente_compra_id,
         qtde_usada,
         custo_congelado = compra.custo_unit_base * qtde_usada,
         marca_snapshot = compra.marca,
         preco_unit_snap = compra.custo_unit_base
       )
   • UPDATE lote SET custo_total = SUM(custo_congelado) + custo_gas
                     custo_unitario = custo_total / rendimento_real
                     qtde_disponivel = rendimento_real
   • INSERT audit_log
   TX COMMIT
   ↓
PrecificacaoService.checarMargem(produto):
   se margem < threshold (30% default) → flag visual no produto
   (não bloqueia — só alerta; mãe é livre)
```

### Fluxo F3 — Sorteio (inscrição, expiração, premiação)

```
ETAPA 1: Mãe abre sorteio

mãe define titulo, premio, custo_pontos, prazo_fim
   ↓
INSERT sorteios (status=ABERTO)
   ↓
Email broadcast aos clientes ativos (opt-in implícito: cadastrou-se = recebe)


ETAPA 2: Cliente inscreve (debita já)

cliente clica "comprar 1 chance"
   ↓
SorteioService.inscrever:
   TX BEGIN
   • SELECT sorteio FOR UPDATE; checa status==ABERTO && prazo > NOW()
   • saldo = SUM(pontos_transacoes WHERE cliente_id)
   • assert saldo >= custo_pontos
   • INSERT pontos_transacoes (delta = -custo, motivo='SORTEIO_INSCRICAO', ref=sorteio_id)
   • INSERT sorteio_inscricoes
   TX COMMIT
   (cliente pode comprar N chances — N inscrições)


ETAPA 3: Cron expira sorteio (a cada 5 min)

node-cron tick:
   ↓
sortear-expirados.ts:
   FOREACH sorteio WHERE status=ABERTO AND prazo_fim <= NOW():
      TX BEGIN
      • SELECT sorteio FOR UPDATE
      • inscricoes = lista de sorteio_inscricoes
      • SE vazia: UPDATE status=FECHADO_SEM_VENCEDOR
      • SENÃO: vencedor = inscricoes[crypto.randomInt(0, len)]
               UPDATE status=SORTEADO, vencedor_id = vencedor.id
      • INSERT audit_log
      TX COMMIT
      ↓
      Email para vencedor + Email para mãe
```

### Fluxo F4 — Resgate (pontos → reserva especial)

```
cliente abre catálogo de resgate
   ↓
clica "trocar 200 pts por 10 brigadeiros"
   ↓
ResgateService.solicitar:
   TX BEGIN
   • saldo = SUM(pontos_transacoes)
   • assert saldo >= custo_pontos
   • INSERT reserva (origem='RESGATE', total_centavos=0, pontos_a_creditar=0)
   • INSERT reserva_itens (mesma lógica de reserva normal — amarra a um lote)
   • UPDATE lotes: qtde_reservada += qtde
   • INSERT pontos_transacoes (delta = -custo, motivo='RESGATE', ref=reserva_id)
   • INSERT audit_log
   TX COMMIT
   ↓
[Daqui em diante segue fluxo F1 a partir da etapa 2 — mãe ainda confirma]
```

---

## 5. Build Order (dependência-respectivo)

Crítico: cada bloco depende dos anteriores. Pular ordem = retrabalho.

```
FASE 0 — Fundação
├── 0.1 Schema Postgres + Drizzle setup + migrations infra
├── 0.2 Auth admin (login da mãe — único usuário)
├── 0.3 Auth cliente (email-first, cadastro)
├── 0.4 Layout (público vs admin, route groups)
└── 0.5 Audit log + email infra (Resend client)

FASE 1 — Custo de produção (motor financeiro)
├── 1.1 Ingredientes (CRUD)
├── 1.2 Compras de ingrediente (evento, com qtde_restante)
├── 1.3 Receitas (ingredientes × quantidade, rendimento, gás)
├── 1.4 Produtos (cadastro mínimo: nome, tipo, categoria — sem preço ainda)
└── 1.5 Lotes (consome compras, congela custo, calcula unitário)
   └── PrecificacaoService.checarMargem (alerta)

FASE 2 — Catálogo público
├── 2.1 Vitrine (listar lotes disponíveis com produto)
├── 2.2 Detalhe de produto (mostra lotes com validade)
├── 2.3 Múltiplas fotos por produto
├── 2.4 Categorias
└── 2.5 Kits (composição) — depende de produtos unitários existirem

FASE 3 — Reserva e fidelização
├── 3.1 Reserva (criar, confirmar, cancelar) com qtde_reservada
├── 3.2 Pontos ledger (creditar na confirmação)
├── 3.3 Painel cliente (histórico, saldo)
├── 3.4 Painel admin do dia (lista do que confirmar)
└── 3.5 Email transacional completo

FASE 4 — Engagement
├── 4.1 Catálogo de resgate (M:N para produtos OU itens próprios)
├── 4.2 Resgate (debita pontos → cria reserva)
├── 4.3 Sorteios (abrir, inscrever)
└── 4.4 Cron de sorteio expirado + cron de lotes vencidos

FASE 5 — Sazonalidade visual
├── 5.1 Campanhas (CRUD com paleta JSON)
├── 5.2 CampanhaResolver (qual está ativa agora)
├── 5.3 Banner sazonal + CSS variables aplicadas via layout

FASE 6 — Relatórios
├── 6.1 Faturamento por período
├── 6.2 Top produtos por receita / margem
├── 6.3 Lucro real por produto
├── 6.4 Análise por marca (query no marca_snapshot)
└── 6.5 Sazonalidade no histórico

FASE 7 — Operação produtiva
├── 7.1 Backup automatizado (pg_dump → R2)
├── 7.2 Monitoring básico (uptime, espaço em disco)
├── 7.3 LGPD (termos no cadastro, política de privacidade)
└── 7.4 Hardening (rate limit, CSRF se necessário, logs)
```

### Por que essa ordem

- **Custo antes de catálogo:** Produto sem custo é inútil (margem é a feature). Lote é a unidade de venda. Fazer lote antes de catálogo significa que catálogo já lê lotes, sem retrabalho.
- **Reserva antes de pontos:** Pontos são derivados de reserva confirmada. Sem reserva, ledger não tem entrada.
- **Resgate/sorteio antes de campanhas:** Engagement é diferenciador. Visual sazonal é skin — cosmético sobre o que já funciona.
- **Relatórios por último:** Lê dados. Não precisa existir até dados existirem por algumas semanas. Relatório vazio engana mais que ajuda.

---

## 6. Boundaries que importam manter

### B1 — Action ≠ Service ≠ Repository

```
Action (lib/actions/)        ─ Auth + parse + revalidate + chama Service
Service (lib/services/)      ─ Regras de negócio + transações + chama Repo
Repository (lib/db/)         ─ SQL/Drizzle apenas
```

Quebrar essa hierarquia (action chamando SQL direto, service usando `revalidatePath`) é o caminho mais rápido para "vira bagunça". Manter rígido.

### B2 — Domain types puros (lib/domain/) sem dependência de infra

`Reserva`, `Lote`, `Cliente` são tipos. Sem React, sem Next, sem Drizzle. Repositories convertem row → domain type. Isso permite:
- Testar service com objetos plain.
- Trocar Drizzle por outro ORM se preciso.
- Reusar tipos no client (são serializáveis).

### B3 — Cliente vs Admin: route groups distintos, MESMO domínio

`(public)` e `(admin)/admin/` são grupos no mesmo Next app. Não rotas diferentes em domínios diferentes. Por quê:
- Mesmo deploy, mesmo bundle, mesmo Postgres.
- Layout admin com `assertAdmin()` no `layout.tsx` cobre tudo.
- Cliente não vê rotas de admin (404 nativo + middleware).

### B4 — Money em centavos (int), não float

Toda coluna de preço/custo é `BIGINT` em centavos. Nunca `NUMERIC(10,2)` direto na lógica. Helpers em `lib/domain/money.ts`. Isso evita erros de arredondamento que destroem relatórios financeiros. Trade-off: precisa formatar em UI. Aceito.

### B5 — Background jobs vivem dentro do processo Next

`instrumentation.ts` (entry point oficial do Next 16) inicializa node-cron uma vez. Jobs chamam services como qualquer action. Trade-off: se Next reinicia, cron reinicia também — OK porque jobs são idempotentes (sortear sorteio que já tem `vencedor_id` é no-op). **NÃO usar setInterval em route handlers** (anti-pattern: handler pode ser chamado múltiplas vezes em paralelo).

### B6 — `delivery_mode` desde já, mesmo escondido

Coluna existe, default RETIRADA, UI v1 não mostra opção. Adicionar coluna em tabela de reservas com 6 meses de histórico = dor. Carregar coluna não usada = nada.

---

## 7. Anti-Patterns a evitar (específicos deste domínio)

### AP1 — "Atualizar preço corrente do ingrediente"

**Tentação:** "Preço caiu? Vou só fazer UPDATE em ingredientes.preco_atual."

**Por que destrói:** Lotes antigos referenciados perdem custo histórico. Análise por marca vira mentira. Lucro real vira ficção.

**Em vez disso:** Sempre INSERT em `ingrediente_compras`. "Preço corrente" é uma view/query: `MAX(data) WHERE ingrediente_id = X`.

### AP2 — "Recalcular custo do lote depois"

**Tentação:** "O custo de gás mudou, vou refazer o cálculo dos lotes."

**Por que destrói:** Histórico imutável é o requisito. Se mudou de gás, é outro contexto.

**Em vez disso:** Lote tem custo congelado, nunca muda. Se gás mudou, próximo lote leva o novo valor.

### AP3 — "Saldo de pontos como coluna em clientes"

**Tentação:** "SUM em cada exibição é lento."

**Por que destrói:** Bug no UPDATE = saldo dessincronizado = cliente brigando "tinha 500 pts!". Ninguém consegue auditar de onde veio o saldo.

**Em vez disso:** Saldo derivado. Se virar gargalo (improvável com 100 clientes ativos), view materializada com refresh on-write.

### AP4 — "Decremento de estoque na criação da reserva"

**Tentação:** "Cliente reservou? Tira do estoque já."

**Por que destrói:** Reserva pode ser cancelada. Lote tem 10 unidades, 5 reservas pendentes que não vão fechar = vitrine esconde produto que tem.

**Em vez disso:** `qtde_reservada` (soft hold) na criação; `qtde_disponivel` decrementa só na confirmação. UI mostra `qtde_disponivel - qtde_reservada`.

### AP5 — "JSON blob para toda configuração"

**Tentação:** "Vou jogar paleta + banner + ativa + tudo num JSON em campanhas."

**Por que destrói:** Em algumas coisas (paleta de cores) JSON é OK; em outras (banner_url, datas) é horrível porque perde índice e validação.

**Em vez disso:** Colunas tipadas para o que é semântico (`inicio`, `fim`, `banner_url`); JSONB só para o que é opaco (paleta).

### AP6 — "useEffect + fetch para tudo no admin"

**Tentação:** Habito de Next 12-13.

**Por que destrói:** Next 16 tem RSC + Server Actions. Buscar dados em `useEffect` no client perde SEO, perde cache de RSC, perde streaming. Verificado em `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`.

**Em vez disso:** Página é async server component → busca direto no banco → Server Action faz mutação → `revalidatePath`. Client components só onde há interação real.

### AP7 — "Envio de email dentro da transação SQL"

**Tentação:** "Confirmou? Envia email já dentro do TX."

**Por que destrói:** Resend down → transação fica esperando ou rolla back uma confirmação válida. Mãe vê reserva como pendente apesar de confirmada.

**Em vez disso:** TX COMMIT → depois disparar email. Falha de email vira retry manual + log, nunca rollback.

### AP8 — "Sub-receita modelada como grafo na v1"

**Tentação:** "Calda de açúcar é uma sub-receita reusada."

**Por que destrói:** Cálculo recursivo de custo, UI de árvore, validação de ciclos, pesadelo de migração quando a árvore muda.

**Em vez disso:** Duplicar ingredientes nas receitas que usam calda. 10 segundos a mais de data entry, zero complexidade.

---

## 8. Scaling Considerations

| Escala | O que faz | Quando atinge | Próximo passo |
|--------|-----------|---------------|---------------|
| **0-100 clientes** (v1) | Tudo na VPS, Postgres + Next no mesmo container ou Docker compose | dia 1 | — |
| **100-500 clientes** | Index review, EXPLAIN nas queries de relatório | provável em 6-12 meses | adicionar pg_stat_statements |
| **500-2k clientes** | Read replica do Postgres para relatórios; fotos para Cloudflare R2 | 1-2 anos | considerar separar admin em domínio diferente |
| **2k+** | Não acontece (público é bairro). Se acontecer, repensar — provavelmente virou outro negócio | improvável | — |

### Bottlenecks prováveis (em ordem)

1. **Storage de fotos no FS da VPS** — cresce mais rápido que dados. Migrar para R2 quando passar de ~5GB. Decisão já no PROJECT.md.
2. **Query de "lotes disponíveis" na vitrine** — se virar lenta, materialized view + refresh on lote-write.
3. **SUM de pontos por cliente** — index em `(cliente_id, criada_em)` resolve. Materialized view só se virar realmente lento.
4. **Painel admin do dia** — query bem específica; index composto em `(status, criada_em)` em reservas.

Não otimizar antes da medição. Postgres em VPS médio aguenta milhares de QPS deste perfil sem suar.

---

## 9. Integration Points

### 9.1 Externos

| Serviço | Padrão de integração | Observações |
|---------|---------------------|-------------|
| Resend | HTTP API via `lib/email/resend-client.ts` | Webhook em `/api/webhooks/resend/route.ts` para bounces; nunca dentro de TX |
| Cloudflare R2 | S3-compat via @aws-sdk/client-s3 | v1 só para backup pg_dump; v2 fotos |
| Postgres | TCP via Drizzle pool | Pool de 10-20 conexões em VPS pequeno; `instrumentation.ts` cria singleton |

### 9.2 Internos

| Boundary | Comunicação | Observações |
|----------|-------------|-------------|
| Action ↔ Service | Function call direta | Same process, same memory |
| Service ↔ Repository | Function call | Repository devolve domain type, não row |
| Service ↔ Email | Async function call após TX | Falha de email não rolla back |
| Cron ↔ Service | Function call de dentro de `lib/jobs/` | Jobs chamam services, não actions |
| Public ↔ Admin | URL boundary + auth check | Mesmo bundle, layouts separados |

---

## 10. Decisões resumidas (cheat sheet)

| Decisão | Escolha | Trade-off aceito |
|---------|---------|------------------|
| Event-sourcing parcial em compras | SIM | Tabela cresce; trivial em escala bairro |
| Snapshot de custo em lote_uso_ingredientes | Colunas tipadas (não JSON) | Dado replicado; ganha índice e query |
| Sub-receitas | NÃO na v1 | Duplicação em receitas; simplicidade enorme |
| Produto unitário e kit na mesma tabela | SIM (enum tipo) | Schema permite combinações inválidas; valida em service |
| Saldo de pontos | Derivado (SUM em ledger) | SUM em cada read; nunca dessincroniza |
| Pré-decremento de estoque | qtde_reservada (soft) + qtde_disponivel | 2 colunas; permite cancelamento sem comer estoque |
| Catálogo resgate referencia produto OU item próprio | XOR | Validação no service |
| delivery_mode desde v1 | SIM | Coluna não usada por meses |
| Money em centavos int | SIM | Format na UI |
| Background jobs no mesmo processo | node-cron via instrumentation.ts | Jobs reiniciam com Next; idempotência cobre |
| Email fora de TX | SIM | Retry manual se falhar |
| Sub-domain admin | NÃO | Route group `(admin)` no mesmo bundle |
| Audit log explícito | SIM (service chama) | Verbosidade; não confia em interceptor |

---

## Sources

- `E:/BRCONNECT/doces_mae/.planning/PROJECT.md` — Spec de domínio (ground truth)
- `E:/BRCONNECT/doces_mae/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` — Server Actions / Server Functions API atual (Next 16)
- `E:/BRCONNECT/doces_mae/node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — `'use cache'` + `cacheLife`, modelo Cache Components
- `E:/BRCONNECT/doces_mae/node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md` — Convenções App Router (route groups, private folders, parallel routes)
- Padrões de event sourcing parcial: ledger imutável + snapshot denormalizado é padrão clássico de sistemas financeiros (Stripe ledger, Shopify orders) — adaptado para escala de bairro

---

*Architecture research for: Doces Valentina (Next.js 16 + Postgres + VPS único)*
*Researched: 2026-04-29*
