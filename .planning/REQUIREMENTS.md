# Requirements: Doces Valentina

**Defined:** 2026-04-29
**Core Value:** Sua mãe enxerga o lucro real de cada doce vendido (custo rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp.

**Defaults travados (configuráveis no admin):**
- Janela de cancelamento: 24h antes da data de retirada
- Threshold do alerta de margem: 30%
- Conversão de pontos: 1pt = R$ 1 reservado
- Expiração de pontos: 12 meses
- Retenção de dados: 5 anos para fins fiscais, depois anonimização
- Cap de pontos por reserva: 500 pts (anti-abuse)
- Cap de chances por sorteio por cliente: 10

---

## v1 Requirements

### Infraestrutura e segurança baseline (INFRA)

- [ ] **INFRA-01**: Deploy via Docker Compose (Next.js standalone + Postgres 16 + Caddy) numa VPS única
- [ ] **INFRA-02**: Cloudflare Proxy laranja ativo em todos subdomínios; IP da VPS NUNCA exposto
- [ ] **INFRA-03**: UFW bloqueia todas portas exceto 80/443 (apenas IPs Cloudflare) e SSH (apenas IP do dev)
- [x] **INFRA-04**: Rate limit em `/api/auth/*` e endpoints de reserva (in-memory ou DB-based, sem Redis)
- [ ] **INFRA-05**: Server Actions com `allowedOrigins` configurado e CSP no `next.config.ts`
- [ ] **INFRA-06**: Validação de variáveis de ambiente com `@t3-oss/env-nextjs` no build (falha cedo)
- [ ] **INFRA-07**: Logging com pino + redact de PII (email, senha, telefone, endereço, CPF se houver)
- [ ] **INFRA-08**: Migrations versionadas via Prisma Migrate (`prisma migrate dev` em DEV, `prisma migrate deploy` em PROD); padrão expand-then-contract; rollback SQL escrito manualmente quando necessário (Prisma não gera automatic down — escrever em PR de migrations críticas)
- [ ] **INFRA-09**: Money em `numeric(19,4)` em TODA coluna financeira (zero `real`/`double`/`float`); decimal.js no app
- [ ] **INFRA-10**: Datas em `timestamptz`; `TZ=America/Sao_Paulo` no app + `timezone='America/Sao_Paulo'` no `postgres.conf`; render via `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })`
- [x] **INFRA-11**: `instrumentation.ts` inicializa workers pg-boss no boot
- [ ] **INFRA-12**: Habilita `reactCompiler: true` no `next.config.ts`

### Autenticação e identidade (AUTH)

- [x] **AUTH-01**: Cliente cria conta com email + senha + nome + telefone (todos obrigatórios) — 01-08 (signupCustomer + cadastro UI)
- [x] **AUTH-02**: Cadastro inteligente — cliente informa email primeiro; sistema verifica existência; se existe pede senha; se não existe abre cadastro completo — 01-08 (checkEmailExists + 2 passos)
- [x] **AUTH-03**: Quando cliente tenta cadastrar email já existente, sistema mostra "talvez você tenha digitado o email errado, tente fazer login" antes de bloquear duplicata — 01-08 (branch AUTH-03)
- [x] **AUTH-04**: Verificação de email obrigatória no cadastro (link de confirmação válido por 24h) — 01-04 (envio real Resend + emailVerification.expiresIn 24h)
- [x] **AUTH-05**: Recuperação de senha OWASP-compliant — token único de 32 bytes, hash no DB, expiração 30-60min, single-use, revoga sessões ativas após reset — 01-03 (token 1h + revokeSessionsOnPasswordReset) + 01-04 (email real)
- [ ] **AUTH-06**: Senhas hasheadas com argon2id (parâmetros recomendados pelo OWASP)
- [x] **AUTH-07**: Mensagens genéricas em fluxos sensíveis ("Se o email existir, você receberá um link") para não revelar enumeração — 01-08 (signinUser/requestPasswordReset copy idêntica)
- [x] **AUTH-08**: Cliente loga e mantém sessão (Better Auth com sessions DB) — 01-08 (signinUser; UI de login fica no Plan 10)
- [x] **AUTH-09**: Cliente acessa painel próprio (saldo, histórico de reservas, histórico de pontos)
- [x] **AUTH-10**: Admin tem login único da mãe; rotas `/admin/*` protegidas por middleware
- [x] **AUTH-11**: Audit log mínimo registra: quem confirmou qual reserva, quem mudou qual preço, quem criou qual lote, quem fez login admin

### LGPD (LGPD)

- [x] **LGPD-01**: Checkbox "Tenho 18+ ou estou com autorização do responsável" obrigatório no cadastro — 01-08 (Zod ===true hard block + checkbox UI)
- [x] **LGPD-02**: Aceite versionado: campos `terms_version`, `terms_accepted_at`, `privacy_version`, `privacy_accepted_at` no usuário
- [x] **LGPD-03**: Política de privacidade descreve operadores reais (Resend EUA, Cloudflare, hospedagem) e retenção (5 anos para fins fiscais, depois anonimização)
- [x] **LGPD-04**: Página "Meus dados" com botão de exportação — gera JSON com cadastro + reservas + pontos + transações
- [x] **LGPD-05**: Página "Excluir minha conta" — anonimiza (preserva histórico de reservas para fins fiscais, mas troca dados pessoais por placeholders e revoga sessões)
- [x] **LGPD-06**: Email de DPO visível em rodapé/política para solicitação manual

### Ingredientes e compras (ING)

- [ ] **ING-01**: Mãe cadastra ingrediente (conceito): nome + unidade-base de cálculo (g, ml, un)
- [ ] **ING-02**: Mãe registra compra: ingrediente + mercado + marca + quantidade comprada + preço pago + data
- [ ] **ING-03**: Sistema deriva R$/unidade-base automaticamente para cada compra
- [ ] **ING-04**: Compras são append-only (event sourcing parcial — `ingrediente_compras` é imutável)
- [ ] **ING-05**: Preço corrente do ingrediente = última compra
- [ ] **ING-06**: Embalagens (forminha, caixa, fita, sacola) cadastradas como ingredientes do tipo "embalagem"
- [ ] **ING-07**: Trigger Postgres `BEFORE UPDATE` em `ingrediente_compras` bloqueia mudança se referenciada por lote (custo congelado preservado)
- [ ] **ING-08**: Mãe vê histórico cronológico de compras por ingrediente

### Receitas (REC)

- [ ] **REC-01**: Mãe cadastra receita ligada a um produto unitário ou kit
- [ ] **REC-02**: Receita lista ingredientes × quantidade usada por lote-padrão
- [ ] **REC-03**: Receita tem rendimento (X unidades por lote)
- [ ] **REC-04**: Receita tem campo "custo de gás/energia por lote" (R$ manual, opcional)
- [ ] **REC-05**: Sistema calcula custo total e custo por unidade automaticamente

### Lotes de produção (LOTE)

- [ ] **LOTE-01**: Mãe registra lote produzido: produto + receita + rendimento real + validade manual
- [ ] **LOTE-02**: Cada `lote_uso_ingredientes` referencia uma compra específica (FK não-nula `ingrediente_compra_id`, NÃO `ingrediente_id`)
- [ ] **LOTE-03**: Sistema congela `marca_snapshot` + `custo_congelado` no momento da produção (colunas tipadas, não JSON)
- [ ] **LOTE-04**: Lote tem `qtde_disponivel` + `qtde_reservada` (constraint CHECK ≥ 0)
- [ ] **LOTE-05**: Lote vencido removido automaticamente da vitrine (cron de hora em hora, não 1×/dia, devido a timezone)
- [ ] **LOTE-06**: Validade do lote vira imutável após primeira reserva ativa
- [ ] **LOTE-07**: Mãe vê todos os lotes (filtros: vigentes, vencidos, esgotados)
- [ ] **LOTE-08**: Teste de regressão automatizado: "muda preço corrente do ingrediente → relatório do lote antigo permanece com custo congelado"

### Catálogo / Produtos (PROD)

- [ ] **PROD-01**: Mãe cadastra produto: nome + descrição + categoria + tipo (UNITARIO|KIT) + preço de venda
- [ ] **PROD-02**: Produto vincula a uma receita (que define custo)
- [ ] **PROD-03**: Produto tem lista de alergênicos selecionável (glúten, leite, ovo, amendoim, castanha, soja, derivados de soja, etc.)
- [ ] **PROD-04**: Produto tem múltiplas fotos (primeira = capa)
- [ ] **PROD-05**: Sharp processa upload: max 1920px, gera 3 tamanhos WebP (thumb 320, médio 768, grande 1280); original NUNCA servido
- [ ] **PROD-06**: Produto pode ser ativado/desativado
- [ ] **PROD-07**: Kit (`tipo=KIT`) é composto por produtos unitários (M:N) ou itens próprios; preço livre, não derivado
- [ ] **PROD-08**: Preço livre + alerta visual (linha vermelha) se margem < 30% (configurável)
- [ ] **PROD-09**: Alerta de preço-piso absoluto (preço < custo) — bloqueia salvar
- [ ] **PROD-10**: Página de ajuda contém aviso ANVISA sobre alegações de saúde ("evite palavras como 'saudável', 'diet', 'sem conservantes', 'imunidade' nas descrições")

### Vitrine pública / Catálogo (CAT)

- [ ] **CAT-01**: Cliente vê home com produtos ativos (filtra por campanha sazonal vigente, se houver)
- [ ] **CAT-02**: Cliente vê detalhe do produto: fotos + descrição + alergênicos + preço + lotes disponíveis com validade ("vence em X dias")
- [ ] **CAT-03**: Cliente vê lotes separados ("Brigadeiro lote 16/04, vence 22/04, 18 disponíveis")
- [ ] **CAT-04**: Cliente filtra por categoria
- [ ] **CAT-05**: Mensagens claras: produto esgotado vs fora de temporada vs 404
- [ ] **CAT-06**: Botão "Falar com a confeiteira" abre WhatsApp com mensagem pré-formatada (`wa.me/55XXXXXXXX?text=...`) em qualquer página relevante
- [ ] **CAT-07**: Página "Onde retirar" com endereço + link Google Maps + observação ("portão verde, ao lado da padaria")
- [ ] **CAT-08**: Mobile-first: tipografia 16px+, contraste AA mínimo, touch targets 44px+, sem hover-only

### Reservas (RES)

- [ ] **RES-01**: Cliente reserva produtos (carrinho simples) sem pagamento online
- [ ] **RES-02**: Cliente informa janela/horário preferencial de retirada
- [ ] **RES-03**: Cliente coloca observação livre (texto até 500 chars)
- [ ] **RES-04**: Reserva PENDENTE incrementa `lote.qtde_reservada` (soft hold via `SELECT FOR UPDATE`)
- [ ] **RES-05**: Reserva nova dispara: email para cliente (comprovante) + email para mãe + alerta sonoro+visual no painel admin
- [ ] **RES-06**: Mãe confirma reserva manualmente — em transação atômica: decrementa `qtde_disponivel`, libera `qtde_reservada`, escreve crédito no ledger de pontos, agenda email
- [ ] **RES-07**: Estados explícitos: PENDENTE → CONFIRMADA → AGUARDANDO_RETIRADA → RETIRADA. Também: CANCELADA, NO_SHOW
- [ ] **RES-08**: Cliente cancela reserva até 24h antes (configurável); sistema libera `qtde_reservada`
- [ ] **RES-09**: Cancelamento usa UNDO de 30s (sem dialog "tem certeza")
- [ ] **RES-10**: Reserva CONFIRMADA gera comprovante acessível em `/r/<token>` (público com token único, sem login)
- [ ] **RES-11**: Reserva guarda `delivery_mode` (ENUM com PICKUP_ONLY na v1; UI esconde a opção, coluna existe)
- [ ] **RES-12**: Race condition em estoque protegida por `SELECT FOR UPDATE` + CHECK constraint `qtde_disponivel >= 0`
- [ ] **RES-13**: Mãe vê histórico de no-show do cliente na tela de confirmação
- [ ] **RES-14**: Mãe pode bloquear cliente manualmente (impede futuras reservas com nota explicativa)
- [ ] **RES-15**: Email NUNCA dispara dentro da transação — enfileirado via pg-boss após `COMMIT`

### Pontos / Fidelização (PT)

- [ ] **PT-01**: Pontos creditados por R$ reservado (default 1pt = R$1, configurável)
- [ ] **PT-02**: Pontos só caem no saldo após confirmação manual da mãe (anti-farm)
- [ ] **PT-03**: Saldo é DERIVADO por SUM no ledger `pontos_transacoes` (NUNCA coluna em `clientes`)
- [ ] **PT-04**: Cap de 500 pts por reserva (configurável, anti-abuse)
- [ ] **PT-05**: Pontos expiram em 12 meses (configurável); cliente recebe email 30 dias antes da expiração
- [ ] **PT-06**: Cliente vê extrato completo no painel (data, valor, motivo, ref polimórfica)
- [ ] **PT-07**: Cliente vê barra de progresso visual (saldo atual / próximo prêmio sugerido)
- [ ] **PT-08**: Email transacional após cada confirmação com saldo atualizado
- [ ] **PT-09**: Admin tem simulador "se eu mudar a taxa de pontos para X, quanto teria custado nos últimos 30 dias?"

### Catálogo de resgate (RESG)

- [ ] **RESG-01**: Mãe define produtos resgatáveis (apenas produtos do próprio catálogo, sem terceiros)
- [ ] **RESG-02**: Cada item tem custo em pontos definido livremente
- [ ] **RESG-03**: Cliente troca pontos → cria reserva especial tipo RESGATE (mãe ainda confirma)
- [ ] **RESG-04**: Pontos são debitados imediatamente ao trocar (transação no ledger)
- [ ] **RESG-05**: Se mãe rejeitar, pontos voltam pro saldo via transação compensatória
- [ ] **RESG-06**: Item resgatável esgotado some do catálogo automaticamente
- [ ] **RESG-07**: Constraint CHECK (XOR) — item de resgate referencia produto OU tem nome custom, nunca ambos

### Sorteios (SORT)

- [ ] **SORT-01**: Mãe abre sorteio: nome + prêmio + custo em pontos por chance + prazo + foto opcional
- [ ] **SORT-02**: Cap de chances por cliente por sorteio (default 10, configurável)
- [ ] **SORT-03**: Cliente troca pontos → adquire 1 chance (debita imediato no ledger)
- [ ] **SORT-04**: Cron pg-boss expira sorteio no prazo: sorteia aleatoriamente entre inscritos com `random_seed` armazenado para auditoria
- [ ] **SORT-05**: Sorteio gera resultado: ID do vencedor, seed, snapshot completo da lista de inscritos (auditável)
- [ ] **SORT-06**: Vencedor recebe email; mãe recebe email com info do vencedor
- [ ] **SORT-07**: Cliente vê sorteios abertos + histórico de sorteios passados (vencedor visível)
- [ ] **SORT-08**: Termos do sorteio cobrem requisitos da Lei 5.768/71 — sorteio sem custo direto monetário, sujeito a revisão jurídica leve antes do launch desta fase

### Sazonalidade visual (SAZON)

- [ ] **SAZON-01**: 4-5 campanhas hardcoded (Páscoa, Dia das Mães, Festa Junina, Dia das Crianças, Natal) com janelas de ativação
- [ ] **SAZON-02**: Cada campanha tem produtos vinculados (M:N) e paleta CSS vars (JSON config)
- [ ] **SAZON-03**: Quando campanha está ativa, site aplica banner sazonal + paleta no front automaticamente
- [ ] **SAZON-04**: Quando nenhuma campanha ativa, site usa paleta default Doces Valentina

### Admin operacional (ADM)

- [ ] **ADM-01**: Home admin = lista de "ações pendentes" (reservas não confirmadas, lotes vencendo em 2 dias, ingredientes acabando — heurística simples)
- [ ] **ADM-02**: Painel do dia: reservas pendentes, confirmadas, retiradas previstas — agrupadas por horário
- [ ] **ADM-03**: Lista de separação imprimível em PDF, agrupada por cliente/horário
- [ ] **ADM-04**: Resumo do dia: faturamento + custo total + lucro + retiradas pendentes
- [ ] **ADM-05**: Snapshot agregado de estoque por produto (somando lotes ativos, com flag de vencimento próximo)
- [ ] **ADM-06**: Histórico do cliente visível na tela de confirmação (reservas anteriores, valor total, no-shows)

### Financeiro / Relatórios (FIN)

- [ ] **FIN-01**: Faturamento por período (mês, ano, customizável)
- [ ] **FIN-02**: Top produtos por receita
- [ ] **FIN-03**: Top produtos por margem
- [ ] **FIN-04**: Lucro real por produto (preço − custo congelado, agregado por mês)
- [ ] **FIN-05**: Análise por marca de ingrediente (qual marca rendeu mais margem em qual produto)
- [ ] **FIN-06**: Sazonalidade visível no histórico (gráfico mensal)
- [ ] **FIN-07**: Materialized view 1×/dia para relatórios pesados; seed realista (12 meses × 50 reservas) para evitar N+1 surpresa em produção

### Notificações (NOTIF)

- [ ] **NOTIF-01**: Email transacional via Resend para cliente: reserva criada + reserva confirmada + pontos creditados + pontos prestes a expirar (30d antes) + sorteio aberto + sorteio ganho + resgate confirmado + comprovante de retirada
- [ ] **NOTIF-02**: Email para mãe: nova reserva + cancelamento de cliente
- [ ] **NOTIF-03**: Alerta visual + sonoro no painel admin quando entra reserva nova (mãe mantém aberto no celular/tablet durante operação)
- [ ] **NOTIF-04**: Webhooks Resend processados em Route Handler com validação `svix` (bounces marcam email como inválido)
- [ ] **NOTIF-05**: Templates em React Email; componentes reutilizáveis com paleta sazonal vigente

---

## v2 / Defensáveis adiar (após validação real)

Tudo abaixo é desejável mas não-essencial para v1. Reavaliar após primeiros 60-90 dias com dados reais.

### Operação avançada
- **OPS-01**: Backup com drill de restore mensal automático + alerta se falhar
- **OPS-02**: Monitoring externo (Better Stack ou similar) + endpoint `/api/health` + email semanal de saúde do sistema
- **OPS-03**: OPERATIONS.md em pt-BR descrevendo procedimentos para casos comuns (restore, certificado, domínio, disco cheio)
- **OPS-04**: Bitwarden compartilhado + dev secundário identificado (mitigar bus factor 1)
- **OPS-05**: Cloudflare granular (WAF rules específicas, Turnstile no cadastro)
- **OPS-06**: Status de backup visível para a mãe (last successful backup + next scheduled)

### Segurança avançada
- **SEC-01**: MFA admin (código por email ou TOTP)
- **SEC-02**: Linter ANVISA com alerta amarelo no campo de descrição
- **SEC-03**: Anonimização programada (não só sob solicitação) após 5 anos

### UX avançada
- **UX-01**: Onboarding guiado para a mãe ("1º ingrediente → 1ª receita → 1º lote → 1º produto")
- **UX-02**: PWA installable
- **UX-03**: Mensagens de erro amigáveis em todos os fluxos (revisar com a mãe)

### Features de fidelização avançada
- **LOY-01**: Programa de referral estruturado (cliente convida amigo → ambos ganham bônus)
- **LOY-02**: Bônus de aniversário automático
- **LOY-03**: Winback de cliente inativo (>60d sem reserva)
- **LOY-04**: "Avise-me quando voltar" para produtos esgotados

### Operação financeira avançada
- **PRC-01**: Sub-receitas (calda de açúcar usada em 3 produtos)
- **PRC-02**: Custo "sombra" de reposição lado a lado com custo congelado
- **PRC-03**: Gráfico histórico de preço de ingrediente
- **PRC-04**: Cálculo de mão de obra no custo (campo "tempo da mãe" × R$/hora dela)
- **PRC-05**: Plano de produção da semana (sugere o que produzir baseado em demanda histórica)

### Catálogo / venda
- **CAT-V2-01**: Política de no-show automatizada (X faltas → cliente bloqueado N dias)
- **CAT-V2-02**: Promoção automática de lote próximo do vencimento (desconto progressivo)
- **CAT-V2-03**: Nota interna do admin sobre cliente (preferências, observações)
- **CAT-V2-04**: Bolos inteiros / tortas / doces grandes (escopo expandido)

### Entrega
- **DEL-01**: Modelo de entrega ativado (frete por região, motoboy, etc.) — campo `delivery_mode` já existe na v1, só ativar UI

### Fatura/Caixa
- **FAT-01**: Recibo PDF imprimível
- **FAT-02**: Conciliação fim do dia (caixa físico vs sistema)

---

## Out of Scope (explícito — não voltar)

| Feature | Razão |
|---------|-------|
| Pagamento online (Pix, cartão) | PROJECT.md travou — mãe quer manter contato direto via WhatsApp; e-commerce real adiciona complexidade fiscal |
| App mobile nativo | Mobile-first via web cobre o caso de uso (cliente abre link do WhatsApp no celular) |
| WhatsApp Business API | Custo da API + complexidade cognitiva; email + painel + `wa.me` cobrem |
| Cálculo de mão de obra no custo | Mãe optou em não incluir; v2 se mudar de ideia |
| Sugestão automática de preço por margem | Mãe prefere preço livre + alerta; algoritmo decidindo gera frustração |
| Múltiplos admins / RBAC | v1 tem só 1 admin; multiusuário em v2 se ganhar ajudante |
| Estoque crítico de ingredientes (alerta automático) | v2; v1 a mãe ajusta visualmente |
| FIFO ou recálculo retroativo de custo | Custo histórico imutável é a decisão; FIFO/recálculo confunde análise |
| Chat ao vivo | Mãe sozinha não mantém; WhatsApp já cumpre esse papel |
| Push notifications agressivas | Clientela mais velha desinstala apps que pedem demais |
| Gamificação com badges/níveis | Loyalty research: complexidade desengaja em pequena escala |
| Pontos por engajamento (login diário, etc.) | Cria passivo sem receita correspondente |
| Cashback monetário | Vira custo direto; difícil sair do programa sem revolta de cliente |
| Conta sem cadastro / "comprar como visitante" | Quebra programa de pontos + cliente conhecido é o modelo |
| Cupons de desconto livres ("PASCOA10") | Clientela de bairro não responde; só canibaliza margem |
| Marketplace / produtos de terceiros no resgate | Quebra controle de qualidade |
| Tradução / multilíngue | pt-BR único |
| Integração iFood / Rappi | Quebra modelo de reserva sem checkout; taxa destrói margem |
| Login social (Google/Facebook) | Política complexifica; clientela mais velha pode não ter conta |
| Estrelas públicas entre clientes | Em clientela íntima vira problema pessoal direto |
| Sazonalidade WYSIWYG (editor de tema) | v1 hardcoded com 4-5 temporadas; expansão pra editor é scope creep |
| Bônus de pontos por cadastro | Vetor de farm |
| Bolos inteiros / tortas / doces grandes em v1 | Mãe não produz isso; só doces unitários e kits |

---

## Traceability

Mapeamento de cada requirement para a fase em que será entregue. Coverage 100% (129/129).

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 — Foundation | Pending |
| INFRA-02 | Phase 1 — Foundation | Pending |
| INFRA-03 | Phase 1 — Foundation | Pending |
| INFRA-04 | Phase 1 — Foundation | Done (01-06) |
| INFRA-05 | Phase 1 — Foundation | Pending |
| INFRA-06 | Phase 1 — Foundation | Pending |
| INFRA-07 | Phase 1 — Foundation | Pending |
| INFRA-08 | Phase 1 — Foundation | Pending |
| INFRA-09 | Phase 1 — Foundation | Pending |
| INFRA-10 | Phase 1 — Foundation | Pending |
| INFRA-11 | Phase 1 — Foundation | Done (01-06) |
| INFRA-12 | Phase 1 — Foundation | Pending |
| AUTH-01 | Phase 1 — Foundation | Done (01-08) |
| AUTH-02 | Phase 1 — Foundation | Done (01-08) |
| AUTH-03 | Phase 1 — Foundation | Done (01-08) |
| AUTH-04 | Phase 1 — Foundation | Done (01-04, 01-08) |
| AUTH-05 | Phase 1 — Foundation | Done (01-04) |
| AUTH-06 | Phase 1 — Foundation | Pending |
| AUTH-07 | Phase 1 — Foundation | Done (01-08) |
| AUTH-08 | Phase 1 — Foundation | Done (01-08) |
| AUTH-09 | Phase 1 — Foundation | Done (01-11) |
| AUTH-10 | Phase 1 — Foundation | Done (01-09) |
| AUTH-11 | Phase 1 — Foundation | Done (01-04, 01-09) |
| LGPD-01 | Phase 1 — Foundation | Done (01-08) |
| LGPD-02 | Phase 1 — Foundation | Done (01-07) |
| LGPD-03 | Phase 1 — Foundation | Done (01-07) |
| LGPD-04 | Phase 1 — Foundation | Done (01-11) |
| LGPD-05 | Phase 1 — Foundation | Done (01-11) |
| LGPD-06 | Phase 1 — Foundation | Done (01-07) |
| ING-01 | Phase 2 — Motor Financeiro | Pending |
| ING-02 | Phase 2 — Motor Financeiro | Pending |
| ING-03 | Phase 2 — Motor Financeiro | Pending |
| ING-04 | Phase 2 — Motor Financeiro | Pending |
| ING-05 | Phase 2 — Motor Financeiro | Pending |
| ING-06 | Phase 2 — Motor Financeiro | Pending |
| ING-07 | Phase 2 — Motor Financeiro | Pending |
| ING-08 | Phase 2 — Motor Financeiro | Pending |
| REC-01 | Phase 2 — Motor Financeiro | Pending |
| REC-02 | Phase 2 — Motor Financeiro | Pending |
| REC-03 | Phase 2 — Motor Financeiro | Pending |
| REC-04 | Phase 2 — Motor Financeiro | Pending |
| REC-05 | Phase 2 — Motor Financeiro | Pending |
| LOTE-01 | Phase 2 — Motor Financeiro | Pending |
| LOTE-02 | Phase 2 — Motor Financeiro | Pending |
| LOTE-03 | Phase 2 — Motor Financeiro | Pending |
| LOTE-04 | Phase 2 — Motor Financeiro | Pending |
| LOTE-05 | Phase 2 — Motor Financeiro | Pending |
| LOTE-06 | Phase 2 — Motor Financeiro | Pending |
| LOTE-07 | Phase 2 — Motor Financeiro | Pending |
| LOTE-08 | Phase 2 — Motor Financeiro | Pending |
| PROD-01 | Phase 2 — Motor Financeiro | Pending |
| PROD-02 | Phase 2 — Motor Financeiro | Pending |
| PROD-03 | Phase 3 — Catálogo Público | Pending |
| PROD-04 | Phase 3 — Catálogo Público | Pending |
| PROD-05 | Phase 3 — Catálogo Público | Pending |
| PROD-06 | Phase 3 — Catálogo Público | Pending |
| PROD-07 | Phase 3 — Catálogo Público | Pending |
| PROD-08 | Phase 2 — Motor Financeiro | Pending |
| PROD-09 | Phase 2 — Motor Financeiro | Pending |
| PROD-10 | Phase 2 — Motor Financeiro | Pending |
| CAT-01 | Phase 3 — Catálogo Público | Pending |
| CAT-02 | Phase 3 — Catálogo Público | Pending |
| CAT-03 | Phase 3 — Catálogo Público | Pending |
| CAT-04 | Phase 3 — Catálogo Público | Pending |
| CAT-05 | Phase 3 — Catálogo Público | Pending |
| CAT-06 | Phase 3 — Catálogo Público | Pending |
| CAT-07 | Phase 3 — Catálogo Público | Pending |
| CAT-08 | Phase 3 — Catálogo Público | Pending |
| RES-01 | Phase 4 — Reserva + Pontos | Pending |
| RES-02 | Phase 4 — Reserva + Pontos | Pending |
| RES-03 | Phase 4 — Reserva + Pontos | Pending |
| RES-04 | Phase 4 — Reserva + Pontos | Pending |
| RES-05 | Phase 4 — Reserva + Pontos | Pending |
| RES-06 | Phase 4 — Reserva + Pontos | Pending |
| RES-07 | Phase 4 — Reserva + Pontos | Pending |
| RES-08 | Phase 4 — Reserva + Pontos | Pending |
| RES-09 | Phase 4 — Reserva + Pontos | Pending |
| RES-10 | Phase 4 — Reserva + Pontos | Pending |
| RES-11 | Phase 4 — Reserva + Pontos | Pending |
| RES-12 | Phase 4 — Reserva + Pontos | Pending |
| RES-13 | Phase 4 — Reserva + Pontos | Pending |
| RES-14 | Phase 4 — Reserva + Pontos | Pending |
| RES-15 | Phase 4 — Reserva + Pontos | Pending |
| PT-01 | Phase 4 — Reserva + Pontos | Pending |
| PT-02 | Phase 4 — Reserva + Pontos | Pending |
| PT-03 | Phase 4 — Reserva + Pontos | Pending |
| PT-04 | Phase 4 — Reserva + Pontos | Pending |
| PT-05 | Phase 4 — Reserva + Pontos | Pending |
| PT-06 | Phase 4 — Reserva + Pontos | Pending |
| PT-07 | Phase 4 — Reserva + Pontos | Pending |
| PT-08 | Phase 4 — Reserva + Pontos | Pending |
| PT-09 | Phase 4 — Reserva + Pontos | Pending |
| RESG-01 | Phase 5 — Engagement | Pending |
| RESG-02 | Phase 5 — Engagement | Pending |
| RESG-03 | Phase 5 — Engagement | Pending |
| RESG-04 | Phase 5 — Engagement | Pending |
| RESG-05 | Phase 5 — Engagement | Pending |
| RESG-06 | Phase 5 — Engagement | Pending |
| RESG-07 | Phase 5 — Engagement | Pending |
| SORT-01 | Phase 5 — Engagement | Pending |
| SORT-02 | Phase 5 — Engagement | Pending |
| SORT-03 | Phase 5 — Engagement | Pending |
| SORT-04 | Phase 5 — Engagement | Pending |
| SORT-05 | Phase 5 — Engagement | Pending |
| SORT-06 | Phase 5 — Engagement | Pending |
| SORT-07 | Phase 5 — Engagement | Pending |
| SORT-08 | Phase 5 — Engagement | Pending |
| SAZON-01 | Phase 6 — Sazonalidade Visual | Pending |
| SAZON-02 | Phase 6 — Sazonalidade Visual | Pending |
| SAZON-03 | Phase 6 — Sazonalidade Visual | Pending |
| SAZON-04 | Phase 6 — Sazonalidade Visual | Pending |
| ADM-01 | Phase 7 — Admin Operacional + Relatórios | Pending |
| ADM-02 | Phase 7 — Admin Operacional + Relatórios | Pending |
| ADM-03 | Phase 7 — Admin Operacional + Relatórios | Pending |
| ADM-04 | Phase 7 — Admin Operacional + Relatórios | Pending |
| ADM-05 | Phase 7 — Admin Operacional + Relatórios | Pending |
| ADM-06 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-01 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-02 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-03 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-04 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-05 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-06 | Phase 7 — Admin Operacional + Relatórios | Pending |
| FIN-07 | Phase 7 — Admin Operacional + Relatórios | Pending |
| NOTIF-01 | Phase 4 — Reserva + Pontos | Pending |
| NOTIF-02 | Phase 4 — Reserva + Pontos | Pending |
| NOTIF-03 | Phase 4 — Reserva + Pontos | Pending |
| NOTIF-04 | Phase 4 — Reserva + Pontos | Pending |
| NOTIF-05 | Phase 4 — Reserva + Pontos | Pending |

**Coverage:**
- v1 requirements: 129 total (12 INFRA + 11 AUTH + 6 LGPD + 8 ING + 5 REC + 8 LOTE + 10 PROD + 8 CAT + 15 RES + 9 PT + 7 RESG + 8 SORT + 4 SAZON + 6 ADM + 7 FIN + 5 NOTIF)
- Mapped to phases: 129 ✓
- Unmapped: 0

**Distribuição por fase:**
- Phase 1 — Foundation: 29 requirements (INFRA + AUTH + LGPD)
- Phase 2 — Motor Financeiro: 26 requirements (ING + REC + LOTE + PROD subset)
- Phase 3 — Catálogo Público: 13 requirements (PROD subset + CAT)
- Phase 4 — Reserva + Pontos: 29 requirements (RES + PT + NOTIF)
- Phase 5 — Engagement: 15 requirements (RESG + SORT)
- Phase 6 — Sazonalidade Visual: 4 requirements (SAZON)
- Phase 7 — Admin Operacional + Relatórios: 13 requirements (ADM + FIN)

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 — traceability populada após criação do ROADMAP.md (7 fases, 129/129 requirements mapeados)*
