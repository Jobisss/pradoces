# Roadmap: Doces Valentina

## Overview

Construção do site de reserva online + sistema de gestão de produção da mãe (custo rastreado por marca, fidelização por pontos, sazonalidade). O caminho começa por **fundação técnica defensável** (infra, auth, LGPD baseline, schema com `numeric(19,4)` e `timestamptz`), continua pelo **motor financeiro** (ingredientes → compras imutáveis → receitas → lotes com custo congelado) que alimenta o **catálogo público**, segue para **reserva + pontos** (o coração do produto), depois **engagement** (resgate + sorteios), **sazonalidade visual**, e termina em **admin operacional + relatórios** que dão à mãe a visão de lucro real. Hardening operacional pesado (Fase 7 da research — backup com drill, monitoring externo, OPERATIONS.md, plano B de email) foi DEFERIDO pelo usuário para v1.x; LGPD baseline e bloqueadores técnicos (numeric, argon2id, OWASP reset, Cloudflare proxy, UFW, rate limit) PERMANECEM em v1, distribuídos nas fases relevantes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Infra defensável (Docker/Cloudflare/UFW), schema com numeric+timestamptz, auth Better Auth + argon2id + OWASP reset, LGPD baseline, audit log e email infra
- [x] **Phase 2: Motor Financeiro** - Ingredientes, compras imutáveis (event sourcing), receitas, produtos básicos, lotes com custo congelado e alerta de margem/preço-piso
- [x] **Phase 3: Catálogo Público** (parcial — falta CAT-08 auditoria Lighthouse real) - Vitrine mobile-first, detalhe com lotes/validade/alergênicos, fotos via sharp (3 tamanhos WebP), categorias, kits, wa.me e endereço/Maps
- [x] **Phase 4: Reserva + Pontos** (falta só NOTIF-*, bloqueado no Resend) - Reserva com soft hold (qtde_reservada), confirmação atômica, ledger imutável de pontos, painel cliente, painel do dia da mãe, comprovante público
- [x] **Phase 5: Engagement** - Catálogo de resgate (XOR produto/custom), troca de pontos, sorteios com random_seed auditado, cron de expiração e de lotes vencidos
- [ ] **Phase 6: Sazonalidade Visual** - Campanhas hardcoded (Páscoa, Mães, Junina, Crianças, Natal) com paleta JSON e CampanhaResolver aplicando banner+CSS vars automaticamente
- [ ] **Phase 7: Admin Operacional + Relatórios** - Home admin de ações pendentes, lista de separação PDF, resumo do dia, faturamento/margem/lucro real, análise por marca, sazonalidade no histórico

## Phase Details

### Phase 1: Foundation
**Goal**: A VPS está em pé com infra defensável e o sistema tem auth completa de cliente e admin, audit log funcional, fila de email pronta e LGPD baseline (export, exclusão, +18, termos versionados, política descritiva) — nada de domínio ainda, mas o que vier depois assenta em base sólida.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-10, INFRA-11, INFRA-12, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-05, LGPD-06
**Success Criteria** (what must be TRUE):
  1. Cliente faz cadastro inteligente (email-first com mensagem "talvez tenha digitado errado"), confirma email por link, faz login e mantém sessão; mãe faz login admin único e acessa `/admin/*` (rotas protegidas por middleware)
  2. Cliente clica "esqueci minha senha", recebe link, redefine — token é single-use, expira em 30-60min, sessões antigas são revogadas; mensagens são genéricas em todos fluxos sensíveis (sem enumeração)
  3. Cliente acessa "Meus dados" e baixa JSON com cadastro+reservas+pontos+transações; cliente clica "Excluir minha conta" e dados pessoais são anonimizados (histórico fiscal preservado); checkbox "+18" é obrigatório no cadastro com versionamento de termos/privacidade
  4. VPS responde APENAS via Cloudflare proxy (IP origin nunca exposto), portas 80/443 aceitam só IPs Cloudflare, SSH só do dev, rate limit ativo em `/api/auth/*`; Server Actions têm `allowedOrigins` + CSP; logs em pino redact PII; build falha se variável de ambiente faltar
  5. Migration Prisma Migrate (`prisma migrate dev` em DEV, `prisma migrate deploy` em PROD) versionada e aplicada cria schema-base em `prisma/schema.prisma` com toda coluna financeira em `Decimal @db.Decimal(19, 4)`, datas em `DateTime @db.Timestamptz` (`TZ=America/Sao_Paulo`); `instrumentation.ts` boota worker pg-boss; audit_log registra logins admin, e Resend client + webhook svix estão prontos para a próxima fase usar
**Plans**: TBD
**UI hint**: yes

### Phase 2: Motor Financeiro
**Goal**: A mãe consegue cadastrar ingredientes (com embalagens unificadas), registrar compras (que são imutáveis — evento), montar receitas com rendimento e custo de gás, cadastrar produtos básicos (unitário ou kit), e produzir um lote que **congela** o custo do momento (rastreado até a compra+marca específica) e emite alerta visual quando margem fica abaixo de 30% ou bloqueia se preço < custo.
**Depends on**: Phase 1
**Requirements**: ING-01, ING-02, ING-03, ING-04, ING-05, ING-06, ING-07, ING-08, REC-01, REC-02, REC-03, REC-04, REC-05, LOTE-01, LOTE-02, LOTE-03, LOTE-04, LOTE-05, LOTE-06, LOTE-07, LOTE-08, PROD-01, PROD-02, PROD-08, PROD-09, PROD-10
**Success Criteria** (what must be TRUE):
  1. Mãe cadastra ingrediente (nome + unidade-base) e registra uma compra (data, mercado, marca, qtde, preço); sistema deriva R$/unidade-base; embalagens (forminha, caixa) entram pelo mesmo formulário com `tipo='EMBALAGEM'`; mãe vê histórico cronológico de compras e a compra é append-only (trigger Postgres bloqueia UPDATE se referenciada por lote)
  2. Mãe cadastra receita (lista de ingredientes × qtde por lote-padrão + rendimento + custo de gás opcional) ligada a um produto; sistema mostra custo total e custo por unidade calculados automaticamente
  3. Mãe registra lote produzido (escolhe receita, informa rendimento real e validade); sistema escreve `lote_uso_ingredientes` referenciando a **compra específica** (FK `ingrediente_compra_id`) com `marca_snapshot` e `custo_congelado` em colunas tipadas; `qtde_disponivel` + `qtde_reservada` são populados com CHECK ≥ 0
  4. Mãe define preço de venda livre no produto; sistema mostra margem em tempo real, exibe linha vermelha se margem < 30% (configurável) e BLOQUEIA salvar se preço < custo absoluto; página de ajuda contém aviso ANVISA sobre alegações de saúde
  5. Teste de regressão automatizado passa: registrar lote → mudar preço corrente do ingrediente → relatório do lote antigo permanece com custo congelado original (custo histórico imutável é enforce no schema, não convenção)

**Pitfalls associados** (research SUMMARY 2.1, 5.5, 1.4, 4.3): float vs numeric (já mitigado na Fase 1), custo congelado bug (FK pra compra, trigger, teste de regressão), ANVISA alegações de saúde (linter visual), começar com queries `.with` desde já para não criar N+1.
**Plans**: 11 plans

Plans (implementados diretamente, sem orquestração GSD, a partir de 2026-08-01 — usuário optou por pular o multi-agent executor pra um projeto deste porte; ver STATE.md Decisions):
- [x] 02-01-PLAN.md — Schema + migration (9 models, trigger ING-07, CHECKs LOTE-04) + harness de testes (wave 1)
- [x] 02-02-PLAN.md — Infra de UI: RHF + shadcn (workaround form stub) + nav admin + ajuda ANVISA (wave 1)
- [x] 02-03-PLAN.md — Núcleo monetário: requireAdmin, zDecimalBRL, lib/custo, fixtures + testes (wave 2)
- [x] 02-04-PLAN.md — Backend ingredientes + compras (D-01..04, ING-01..07) + testes (wave 3)
- [x] 02-05-PLAN.md — Receitas vertical: actions + form RHF com custo ao vivo (REC-01..05) (wave 3)
- [x] 02-06-PLAN.md — Backend produtos + config: PROD-09 server-side, audit de preço, D-10/D-11 + testes (wave 3)
- [x] 02-07-PLAN.md — Lotes backend: LOTE-08 test-first + produzirLote transacional + filtros TZ (wave 3)
- [x] 02-08-PLAN.md — UI ingredientes/compras: lista, histórico D-03, fluxo "ida ao mercado" (wave 4)
- [x] 02-09-PLAN.md — UI produtos/ajustes: margem batch + form com margem reativa + PROD-08/09 (wave 4)
- [x] 02-10-PLAN.md — UI lotes: filtros LOTE-07 + fluxo "Produzi hoje" D-05..08 (wave 4)
- [x] 02-11-PLAN.md — Home admin + audit copy + checkpoint human-verify do ciclo completo (wave 5)
- [x] D-12 (fora do escopo original) — Recheio: receita anexa opcional a um produto (`Produto.recheioReceitaId`), custo soma base+recheio escalando por eixos diferentes (multiplicador vs rendimentoReal) em `produzirLote`; 5 testes em `tests/financeiro/recheio.test.ts`
**UI hint**: yes

### Phase 3: Catálogo Público
**Goal**: Cliente consegue navegar a vitrine no celular (mobile-first, 16px+, AA, touch 44px+), ver detalhe de cada doce com fotos otimizadas, alergênicos, lotes separados com validade ("vence em X dias"), filtrar por categoria, ver kits compostos, e tomar a ação social fora do site (clicar "Falar com a confeiteira" pelo `wa.me` ou ver "Onde retirar" com Google Maps).
**Depends on**: Phase 2 (precisa de produtos com custo congelado e lotes existindo)
**Requirements**: PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08
**Success Criteria** (what must be TRUE):
  1. Cliente abre home no celular e vê produtos ativos com foto de capa (servida em WebP responsivo, 3 tamanhos via sharp — original NUNCA exposto); produto desativado pela mãe some imediatamente
  2. Cliente abre detalhe de produto e vê: múltiplas fotos, lista de alergênicos (glúten, leite, ovo, amendoim, etc.), preço, e **lotes separados com validade visível** ("Brigadeiro lote 16/04, vence 22/04, 18 disponíveis"); kit mostra produtos componentes
  3. Cliente filtra por categoria; vê mensagem específica e diferenciada para cada caso: "esgotado" (lote sem qtde), "fora de temporada" (campanha não ativa), "404" (produto não existe)
  4. Cliente clica "Falar com a confeiteira" e abre WhatsApp com mensagem pré-formatada (`wa.me/55XXXXXXXX?text=...`); cliente acessa "Onde retirar" e vê endereço + link Google Maps + observação ("portão verde, ao lado da padaria")
  5. Lighthouse mobile mostra contraste AA mínimo, tipografia ≥16px, touch targets ≥44px, sem hover-only — testado em viewport real de celular

**Pitfalls associados** (research SUMMARY 3.5, 1.5, 1.4): disco lota sem pipeline sharp (max 1920px, WebP, 3 tamanhos), validade exibida vs etiqueta impressa precisa bater, alergênicos no card são mandatórios.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Reserva + Pontos
**Goal**: Cliente reserva produtos sem checkout (carrinho simples), informa horário preferencial e observação; reserva PENDENTE faz soft hold no lote; mãe é notificada (email + alerta sonoro/visual no painel) e confirma manualmente (em transação atômica que decrementa estoque, libera hold, escreve crédito no ledger imutável e enfileira email **fora** da transação); cliente vê saldo, extrato, barra de progresso e pode cancelar com UNDO de 30s.
**Depends on**: Phase 2 (lotes precisam existir para reservar) e Phase 3 (catálogo público para o cliente entrar no fluxo)
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, RES-07, RES-08, RES-09, RES-10, RES-11, RES-12, RES-13, RES-14, RES-15, PT-01, PT-02, PT-03, PT-04, PT-05, PT-06, PT-07, PT-08, PT-09, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
**Success Criteria** (what must be TRUE):
  1. Cliente adiciona produtos ao carrinho, escolhe janela de retirada, escreve observação (≤500 chars), clica reservar; reserva entra como PENDENTE, lote tem `qtde_reservada` incrementada via `SELECT FOR UPDATE` + CHECK; cliente recebe email de comprovante com link `/r/<token>` (público, sem login); reserva guarda `delivery_mode='PICKUP_ONLY'` (UI esconde a opção)
  2. Mãe recebe email + ouve alerta sonoro/visual no painel admin; vê reserva pendente com histórico do cliente (reservas anteriores, valor total, no-shows); clica confirmar — em transação atômica: decrementa `qtde_disponivel`, libera `qtde_reservada`, escreve `pontos_transacoes` (+pts), escreve audit_log; email é enfileirado via pg-boss SOMENTE após COMMIT
  3. Estados explícitos funcionam: PENDENTE → CONFIRMADA → AGUARDANDO_RETIRADA → RETIRADA, e laterais CANCELADA/NO_SHOW; cliente cancela com UNDO de 30s (sem dialog), libera `qtde_reservada`; mãe pode bloquear cliente manualmente com nota explicativa
  4. Cliente vê painel próprio: saldo de pontos (derivado por SUM no ledger — NUNCA coluna em `clientes`), extrato completo (data, valor, motivo, ref polimórfica), barra de progresso visual, histórico de reservas; recebe email transacional após cada confirmação com saldo atualizado e 30 dias antes da expiração de pontos (12m configurável)
  5. Anti-abuse funciona: pontos só caem após confirmação manual (não na PENDENTE), cap de 500 pts/reserva (configurável); admin tem simulador "se eu mudasse a taxa para X, quanto teria custado nos últimos 30 dias?"; webhook Resend valida com `svix` e bounces marcam email como inválido

**Pitfalls associados** (research SUMMARY 2.3, 5.4, 6.1, 1.6, 5.1, 5.2, 6.2, 6.3, 6.4, 6.5): race condition em estoque (FOR UPDATE + CHECK), no-show visível, **UX testing presencial OBRIGATÓRIO com a mãe antes de fechar fase**, cancelamento em prejuízo, inflação de pontos (simulador + cap + 12m), anti-farm, comprovante via token, email duplicado, cancelamento acidental (UNDO 30s), mãe esquece de confirmar.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Engagement
**Goal**: A mãe transforma os pontos em retenção real: define um catálogo de resgate separado (apenas produtos do próprio catálogo OU itens custom — XOR via CHECK), e abre sorteios com prazo + custo em chances; cliente troca pontos por produtos resgatáveis (vira reserva especial que a mãe ainda confirma) ou por chances de sorteio (debita imediato); cron pg-boss expira sorteios sorteando aleatoriamente com `random_seed` auditável e tira lotes vencidos da vitrine de hora em hora.
**Depends on**: Phase 4 (precisa de ledger de pontos e fluxo de reserva)
**Requirements**: RESG-01, RESG-02, RESG-03, RESG-04, RESG-05, RESG-06, RESG-07, SORT-01, SORT-02, SORT-03, SORT-04, SORT-05, SORT-06, SORT-07, SORT-08
**Success Criteria** (what must be TRUE):
  1. Mãe cadastra item resgatável (referenciando produto do próprio catálogo OU com nome custom — nunca ambos, garantido por CHECK XOR), define custo em pontos; cliente troca pontos → cria reserva tipo RESGATE (mãe ainda confirma); pontos debitados imediatamente; se mãe rejeita, pontos voltam via transação compensatória; item resgatável esgotado some do catálogo automaticamente
  2. Mãe abre sorteio (nome, prêmio, custo em pontos por chance, prazo, foto opcional); cliente compra chances respeitando cap por cliente (default 10, configurável); cada chance debita pontos imediatamente no ledger
  3. Cron pg-boss expira sorteio no prazo: gera resultado com vencedor, `random_seed` armazenado para auditoria, snapshot completo da lista de inscritos; vencedor recebe email, mãe recebe email com info do vencedor; cliente vê histórico de sorteios passados com vencedor visível
  4. Cron de hora em hora (não 1×/dia, por causa do timezone) tira lotes vencidos da vitrine pública automaticamente; lote vencido continua acessível pra mãe via filtro "vencidos" no admin
  5. Termos do sorteio publicados cobrindo Lei 5.768/71 (sorteio sem custo direto monetário, revisão jurídica leve antes do launch desta fase) — link visível na página de cada sorteio aberto

**Pitfalls associados** (research SUMMARY 5.1, 8.2, 5.3): inflação de pontos via cap de chances por sorteio, resgate virando "marketplace" (regra: só produtos da mãe), sorteio com auditoria via `random_seed` + termos cobrindo Lei das Loterias.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Sazonalidade Visual
**Goal**: Site aplica skin sazonal automaticamente nas datas-pico do nicho (Páscoa, Dia das Mães, Festa Junina, Dia das Crianças, Natal): 4-5 campanhas hardcoded com janela de ativação, paleta CSS vars em JSON, banner próprio, e produtos vinculados (M:N) — sem editor WYSIWYG (anti-feature confirmada).
**Depends on**: Phase 3 (catálogo público existir para receber a paleta)
**Requirements**: SAZON-01, SAZON-02, SAZON-03, SAZON-04
**Success Criteria** (what must be TRUE):
  1. As 4-5 campanhas hardcoded existem no schema (Páscoa, Mães, Junina, Crianças, Natal) com janelas de ativação corretas; cada campanha tem produtos vinculados via M:N e paleta CSS vars (primary, secondary, accent, bg) em JSON
  2. Quando uma campanha está dentro da janela de ativação, `CampanhaResolver` retorna a campanha ativa e o site aplica o banner sazonal + CSS vars no `layout.tsx` automaticamente, sem ação da mãe
  3. Quando nenhuma campanha está ativa, o site usa a paleta default Doces Valentina (sem flash de troca de tema entre páginas)
  4. Vitrine pode filtrar produtos vinculados à campanha vigente (CAT-01 já lê esse filtro); produto vinculado a uma campanha aparece em destaque sazonal durante a janela

**Pitfalls associados** (research SUMMARY 8.1): scope creep — manter v1 hardcoded com PR review checklist; nada de editor WYSIWYG (A17 anti-feature).
**Plans**: TBD
**UI hint**: yes

### Phase 7: Admin Operacional + Relatórios
**Goal**: A mãe ganha a visão completa de operação e finanças: home admin com lista de "ações pendentes", painel do dia agrupado por horário, lista de separação imprimível em PDF, resumo de faturamento/custo/lucro do dia, snapshot agregado de estoque, e relatórios financeiros completos (faturamento por período, top produtos por receita/margem, lucro real por produto, **análise por marca de ingrediente**, sazonalidade visível no histórico).
**Depends on**: Phase 4 (reservas precisam existir há algumas semanas para gerar dados realistas) e Phase 5 (cron de lotes vencidos para snapshot de estoque coerente)
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07
**Success Criteria** (what must be TRUE):
  1. Mãe abre home admin e vê lista de ações pendentes (reservas não confirmadas, lotes vencendo em ≤2 dias, ingredientes com pouca compra recente — heurística simples); abre painel do dia e vê reservas pendentes/confirmadas/retiradas previstas agrupadas por horário; clica e gera lista de separação em PDF agrupada por cliente/horário
  2. Mãe vê resumo do dia (faturamento + custo total + lucro + retiradas pendentes) e snapshot agregado de estoque por produto somando lotes ativos com flag de validade próxima; histórico do cliente aparece na tela de confirmação (já parte do success #2 da Fase 4 e visível também aqui)
  3. Mãe abre relatório de faturamento por período (mês, ano, customizável), vê top produtos por receita e por margem, e lucro real por produto (preço − custo congelado, agregado por mês)
  4. Mãe abre análise por marca de ingrediente e descobre "qual marca de leite condensado rendeu mais brigadeiro lucrativo" (query agregando `marca_snapshot` em `lote_uso_ingredientes`); mãe vê sazonalidade no histórico (gráfico mensal mostra picos de Páscoa/Mães/Natal)
  5. Relatórios pesados são servidos por materialized view com refresh 1×/dia; seed realista (12 meses × 50 reservas) está aplicado em ambiente de staging para comprovar ausência de N+1 antes do launch desta fase

**Pitfalls associados** (research SUMMARY 4.3): N+1 em relatórios — Prisma `include`/`select` explícito desde início, `prisma.$queryRaw` para agregações por marca, materialized view 1×/dia, seed realista de 12 meses para EXPLAIN antes de produção.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 10/11 | In progress | - |
| 2. Motor Financeiro | 11/11 + D-12 | Done | 2026-08-01 |
| 3. Catálogo Público | done (menos CAT-08) | Quase completo | - |
| 4. Reserva + Pontos | done (menos NOTIF-*) | Quase completo | - |
| 5. Engagement | 15/15 REQ | Done | 2026-08-02 |
| 6. Sazonalidade Visual | 0/TBD | Not started | - |
| 7. Admin Operacional + Relatórios | 0/TBD | Not started | - |

## Deferred for v1.x (post-launch)

A research SUMMARY descreveu uma "Fase 7 — Hardening de produção" que o user explicitamente DEFERIU para v1.x. Itens deferidos (NÃO em v1, mas tracked):

- **OPS-01**: Backup com drill de restore mensal automático + alerta se falhar
- **OPS-02**: Monitoring externo (Better Stack) + endpoint `/api/health` + email semanal
- **OPS-03**: OPERATIONS.md em pt-BR para procedimentos comuns
- **OPS-04**: Bitwarden compartilhado + dev secundário identificado (bus factor)
- **OPS-05**: Cloudflare granular (WAF rules, Turnstile no cadastro)
- **OPS-06**: Status de backup visível para a mãe
- **SEC-01**: MFA admin (email-code ou TOTP)
- **SEC-02**: Linter ANVISA com alerta amarelo no campo de descrição (v1 tem só aviso na página de ajuda — PROD-10)
- **SEC-03**: Anonimização programada (não só sob solicitação) após 5 anos

**Importante:** Os bloqueadores TÉCNICOS (numeric money, argon2id, OWASP reset, Cloudflare proxy, UFW, rate limit) e LGPD baseline (export, exclusão, +18, termos versionados, política descritiva) PERMANECEM em v1, distribuídos nas Fases 1-4. Só os itens de hardening operacional pesado e SEC avançada foram deferidos.

---

*Roadmap created: 2026-04-29*
*Granularity: standard (5-8 phases)*
*Coverage: 129/129 v1 requirements mapped*
