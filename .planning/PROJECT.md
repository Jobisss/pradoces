# Doces Valentina

## What This Is

Site de **reserva** (não checkout) dos doces que a mãe da pessoa produz em pré-produção. Cliente reserva pelo celular, sua mãe confirma manualmente após contato (WhatsApp pessoal), retira no endereço dela, e ganha pontos para trocar por produtos ou inscrever em sorteios. O lado administrativo é um sistema completo de gestão: ingredientes com rastreio por marca/compra, lotes de produção com custo congelado, precificação com alerta de margem, e visão financeira histórica.

## Core Value

Sua mãe enxerga o **lucro real** de cada doce vendido (custo de produção rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp que é a base do negócio dela.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

> Nota brownfield: o repositório tem apenas o scaffolding default de Next.js 16 (App Router) em `app/`. Nenhuma feature de domínio foi construída. Tratar como greenfield para fins de planejamento.

### Active

<!-- Hipóteses até serem validadas em produção. Cobertura v1. -->

**Autenticação e identidade**
- [ ] Cliente: cadastro inteligente — informa email primeiro; se existe, sistema pede senha; se não existe, abre cadastro completo (email, senha, nome, telefone)
- [ ] Cliente: ao tentar cadastrar email já existente, sistema avisa "talvez você tenha digitado o email errado" antes de bloquear
- [ ] Cliente: painel próprio com saldo de pontos, histórico de reservas, histórico de pontos
- [ ] Admin: login único da mãe (admin único na v1)

**Catálogo e produtos**
- [ ] Cadastro de produtos unitários (brigadeiro, beijinho, cajuzinho, etc.)
- [ ] Cadastro de kits/cestas (combinações de produtos unitários e/ou itens próprios)
- [ ] Múltiplas fotos por produto (a mãe já tem material)
- [ ] Categorias de produto
- [ ] Campanhas/temporadas sazonais com data início/fim, banner próprio e paleta visual customizada (Páscoa, Dia das Mães, Natal)
- [ ] Produtos podem ser vinculados a uma campanha (aparecem no destaque sazonal)

**Lotes de produção e estoque**
- [ ] Quando a mãe produz, registra um "lote" com receita aplicada, rendimento real, e ingredientes consumidos amarrados a compras específicas (rastreio por marca)
- [ ] Cada lote tem validade definida manualmente pela mãe
- [ ] Cliente vê lotes separados (ex.: "Brigadeiro lote 16/04, vence 22/04, 18 disponíveis")
- [ ] Reserva consome unidades de um lote específico
- [ ] Lotes vencidos saem automaticamente da vitrine

**Reserva**
- [ ] Cliente reserva produtos sem pagamento online
- [ ] Reserva nova dispara: email para a mãe + alerta no painel admin
- [ ] Mãe confirma reserva manualmente após contato/combinação por WhatsApp
- [ ] Confirmação dá baixa no estoque do lote e libera pontos para o cliente (anti-farm)
- [ ] Cliente pode cancelar reserva até X horas antes (X configurável)
- [ ] v1: somente retirada (modelo de dados já preparado para entrega futura — campo `delivery_mode` desde o início, mas UI esconde a opção)

**Pontos e fidelização**
- [ ] Pontos creditados por R$ reservado (taxa configurável no admin)
- [ ] Pontos só caem no saldo do cliente após a mãe confirmar a reserva
- [ ] Extrato de pontos por email (após cada confirmação)
- [ ] Catálogo de **resgate** separado: mãe define quais produtos são resgatáveis e o custo em pontos de cada um
- [ ] Cliente troca pontos por produtos do catálogo de resgate (vira uma reserva especial, mãe ainda confirma)
- [ ] Sorteios periódicos abertos pela mãe (ela define prêmio, prazo, custo em pontos por chance)
- [ ] Cliente troca pontos por chances (cada chance debita pontos imediatamente)
- [ ] Sistema sorteia aleatoriamente no fim do prazo, notifica vencedor e a mãe

**Ingredientes e compras**
- [ ] Cadastro de ingrediente (conceito): "Açúcar refinado", unidade-base de cálculo
- [ ] Cada compra registrada como evento separado: data, mercado, marca, quantidade comprada, preço pago — sistema deriva R$/unidade-base
- [ ] Preço corrente do ingrediente = última compra
- [ ] Embalagens (forminha, caixa, fita, sacola) cadastradas como ingredientes do tipo "embalagem"

**Receitas**
- [ ] Receita por produto: lista de ingredientes × quantidade usada por lote-padrão
- [ ] Rendimento da receita (ex.: "essa receita rende 50 brigadeiros")
- [ ] Custo de gás/energia por lote: campo manual que a mãe informa por receita ou por lote produzido
- [ ] Sistema calcula custo total do lote e custo por unidade automaticamente

**Custo histórico imutável**
- [ ] Quando um lote é produzido, sistema "congela" o custo unitário do momento da produção
- [ ] Lote registra a compra específica de cada ingrediente que foi usada (não o ingrediente abstrato)
- [ ] Quando preço de ingrediente muda no futuro, lotes antigos não são recalculados (lucro histórico fica preciso)

**Análise por marca**
- [ ] Relatório admin: produtos feitos com cada marca de ingrediente — custo médio, margem média, número de lotes
- [ ] Permite à mãe ver "qual marca de leite condensado rende mais brigadeiro lucrativo"

**Precificação**
- [ ] Preço de venda definido livremente pela mãe (sem sugestão automática)
- [ ] Sistema mostra margem real calculada (preço − custo unitário)
- [ ] Alerta dispara se margem ficar abaixo de um limite configurável (default: 30%)

**Admin financeiro**
- [ ] Painel de operação do dia: reservas pendentes, confirmadas, retiradas previstas para hoje/semana
- [ ] Faturamento por período (mês, ano)
- [ ] Top produtos por receita / por margem
- [ ] Lucro real por produto (preço − custo congelado)
- [ ] Sazonalidade visível no histórico
- [ ] Análise por marca de ingrediente

**Notificações e comunicação**
- [ ] Email transacional para o cliente: reserva criada, reserva confirmada, pontos creditados, sorteio aberto, sorteio ganho, resgate confirmado
- [ ] Email para a mãe: nova reserva, cancelamento de cliente
- [ ] Alerta visual + sonoro no painel admin quando entra reserva (mãe mantém aberto no celular/tablet)
- [ ] Sem WhatsApp Business API (decisão de custo)

**LGPD e termos**
- [ ] Política de privacidade simples (template)
- [ ] Termos de uso simples
- [ ] Cliente aceita explicitamente no cadastro

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Pagamento online (Pix/cartão)** — Mãe quer manter o contato direto via WhatsApp; e-commerce real geraria complexidade fiscal e de atendimento que ela não quer agora
- **Entrega/frete** — v1 só retirada; modelo de dados já fica preparado (campo `delivery_mode`), mas implementação fica para milestone futuro
- **App mobile nativo** — Mobile-first via web cobre o caso de uso (cliente abre link do WhatsApp no celular)
- **Bolos inteiros / tortas / doces grandes** — A mãe não produz isso; só doces unitários e kits
- **WhatsApp Business API** — Custo da API (≈US$ 0,005/mensagem ou plano fixo) não compensa; email + painel cobrem notificação
- **Cálculo de mão de obra no custo** — A mãe optou por NÃO incluir tempo dela no preço (só ingredientes + embalagem + gás)
- **Sugestão automática de preço por margem** — A mãe prefere definir preço livre e ser alertada; não quer algoritmo decidindo por ela
- **Múltiplos admins / permissões granulares** — v1 tem só 1 admin (a mãe); sistema multiusuário fica para v2
- **Estoque crítico de ingredientes (alerta automático)** — Útil mas não essencial; v2
- **Cálculo de FIFO ou recálculo retroativo de custo** — Cada lote tem custo congelado; histórico imutável simplifica análise

## Context

**Modelo de negócio:**
- Pré-produção real (não made-to-order): a mãe acorda, faz uma fornada, e disponibiliza o lote no site
- Vendas hoje rolam por boca-a-boca e WhatsApp pessoal — sem rastreio, sem fidelização, sem visão de lucro real
- Clientela é local (bairro), conhece a mãe pessoalmente
- Toda confirmação e combinação de pagamento continua via WhatsApp pessoal — site não substitui esse contato, só estrutura o pedido

**Operação:**
- Mãe sozinha cuida de tudo: cozinha, atende WhatsApp, separa pedido, recebe cliente
- Acesso ao admin majoritariamente via celular ou tablet enquanto ela produz
- Cliente quase 100% mobile (recebe link do WhatsApp, abre, reserva)

**Histórico técnico:**
- Repositório atual tem só scaffolding default de Next.js 16 (App Router) em `app/` — nenhuma feature de domínio construída
- Primeiro projeto digital deste negócio — UX precisa ser zero-fricção, sem jargão técnico, sem opções desnecessárias

**Sazonalidade:**
- Datas-pico do ramo: Páscoa (kits temáticos), Dia das Mães, Festa Junina, Dia das Crianças, Natal
- Sistema deve permitir customização visual (banner + paleta) automática nessas janelas
- Faturamento provavelmente bem concentrado nessas épocas

## Constraints

- **Tech stack**: Next.js 16 (App Router) — já instalado e travado pela primeira tentativa do projeto. AGENTS.md raiz avisa que essa versão tem mudanças que quebram com o que está em training data; consultar `node_modules/next/dist/docs/` antes de codar
- **Hospedagem**: VPS único (Hostinger ou similar, ~R$ 30/mês) — escolha do usuário privilegia custo previsível sobre conveniência de PaaS. Implica deploy manual, monitoring manual, backup manual
- **Banco**: PostgreSQL containerizado na VPS (decisão derivada — único Postgres em VPS é o caminho natural)
- **Email transacional**: Resend (3k emails/mês free, ≈R$ 100/mês depois) — não tentar Postfix self-hosted (deliverability sofre, IP de VPS quase sempre em blocklist)
- **Storage de fotos**: filesystem da VPS na v1; migrar para Cloudflare R2 quando passar de ~5GB
- **Domínio**: `.com.br` ~R$ 40/ano (Registro.br)
- **Idioma**: pt-BR único; sem internacionalização
- **Mobile-first**: cliente quase tudo no celular; admin tablet/celular durante produção
- **LGPD**: termos básicos + política de privacidade no cadastro; coleta de email + telefone + nome + histórico de compras
- **Backup**: cron diário do Postgres → upload para Cloudflare R2 free tier (10GB grátis) ou similar
- **Domínio do cliente**: a mãe vai usar isso de verdade — UX precisa ser à prova de usuário não-técnico. Sem opções escondidas atrás de menus, sem jargão, sem confirmações desnecessárias

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reserva sem pagamento online | Mãe quer manter contato direto via WhatsApp; e-commerce real adiciona complexidade fiscal | — Pending |
| Estoque contínuo (não por batch agendado) | Mãe pensa em estoque, não em "fornada de tal dia"; modelo segue o mental dela | — Pending |
| Lote = estoque visível para o cliente (com validade) | Permite rastreio fino de validade e custo histórico por lote | — Pending |
| Pontos só após confirmação manual da mãe | Anti-farm; alinha com fluxo já existente via WhatsApp | — Pending |
| Auth: email-first com mensagem de "talvez tenha errado o email" | Detalhe de UX importante para reduzir cadastros duplicados em clientela mais velha | — Pending |
| Sorteios manuais (mãe abre cada um) | v1 simples; sorteio mensal automático fica para depois | — Pending |
| Resgate via catálogo separado | Mãe define o que vira moeda de pontos; protege margem | — Pending |
| Preço livre + alerta de margem (default 30%) | Mãe sabe o mercado dela melhor que um algoritmo; sistema protege contra erro grosseiro | — Pending |
| Custo histórico imutável por lote | Lucro histórico precisa refletir custo do dia; FIFO/recálculo retroativo confunde análise | — Pending |
| Tracking de marca/compra em lotes | Análise diferenciada — "qual marca rende mais margem" | — Pending |
| Embalagem como ingrediente (modelo unificado) | Reduz conceitos no admin; mesma UX para açúcar e forminha | — Pending |
| Gás/energia como custo manual por lote | Variável demais para automatizar; mãe informa o que gastou | — Pending |
| Mão de obra fora do custo | Mãe optou por não incluir; pode revisar em v2 | — Pending |
| v1 só retirada, modelo preparado para entrega | Mãe não entrega hoje, mas pode mudar; estrutura fica pronta | — Pending |
| Notificação por email + painel (sem WhatsApp Business API) | Custo zero; redundância suficiente para não perder reserva | — Pending |
| Sazonalidade com customização visual (banner/paleta) | Identidade visual do negócio nas datas importantes | — Pending |
| VPS único com Postgres + Next.js | Custo previsível ~R$30/mês; trade-off: manutenção e backup manuais | — Pending |
| Resend para email (não Postfix) | IPs de VPS quase sempre caem em blocklist; deliverability é crítica | — Pending |
| ORM: Prisma 7 (não Drizzle) | Decisão revisada em 2026-04-30 antes de planejar Phase 1: Prisma 7 (Rust query engine removido, TS puro) tem DX superior + Prisma Studio polido para a mãe inspecionar dados; Drizzle (escolha original na research) substituído. Better Auth tem adapter Prisma oficial. Postgres-only features (`numeric(19,4)`, triggers, CHECK XOR, custo congelado) usam raw SQL via `prisma.$queryRaw` quando necessário. **Atenção:** Prisma 7 tem mudanças importantes vs v6 — consultar `node_modules/@prisma/client/` e docs oficiais antes de codar (mesmo padrão do Next 16). | — Locked 2026-04-30 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-29 after initialization*
