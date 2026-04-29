# Feature Research — Doces Valentina

**Domain:** Reserva de doces caseiros (pré-produção) + clube de fidelidade B2C de bairro + admin financeiro/produção para microempreendedora não-técnica
**Researched:** 2026-04-29
**Confidence:** MEDIUM-HIGH (cruza padrões consolidados de loyalty/food-cost/perishable + observação direta do PROJECT.md)
**Lens:** Apenas DESCOBERTAS — features que o PROJECT.md ainda não tem. Duplicações foram suprimidas.

---

## Como ler este documento

O PROJECT.md já cobre: auth email-first, catálogo, lotes com validade, reserva sem checkout, pontos pós-confirmação, sorteios manuais, resgate, ingredientes com tracking de marca, BOM com gás manual, custo congelado, precificação livre + alerta de margem, admin financeiro básico, sazonalidade visual, email transacional, painel com alerta sonoro.

Este arquivo lista o que pesquisas de mercado mostram que **operações similares têm e o PROJECT.md ainda não lista**, organizado por:

- **Table Stakes (Esquecidos)** — Coisas que clientes/operadora vão esperar e cuja ausência machuca a percepção de "sistema completo"
- **Differentiators (Reais)** — Vantagem competitiva genuína para o caso (não vaidade tecnológica)
- **Nice-to-have** — Bom mas adiável sem dor
- **Anti-features** — Tentações comuns que o time deve recusar EXPLICITAMENTE com justificativa

Cada linha indica fase sugerida (v1 / v1.x / v2+), complexidade (B/M/A), impacto de negócio (A/M/B).

---

## 1. Table Stakes Esquecidos no PROJECT.md

Features que o PROJECT.md não cita mas que são **piso operacional** — sem elas o sistema parece incompleto na primeira semana de uso real.

### 1.1 Operação diária da mãe

| # | Feature | Por que é table stake | Fase | Complex. | Impacto |
|---|---------|-----------------------|------|----------|---------|
| 1 | **Lista de separação imprimível/visualizável do dia** ("hoje preciso separar: 3× brigadeiro Maria, 2× kit Páscoa João") agrupada por cliente e por horário previsto de retirada | Bakeries/confeitarias usam "daily prep / picking sheet" há décadas — sem isso a mãe vai fazer essa lista no papel e o sistema vira só "captador de pedido", não ferramenta de operação | v1 | B | A |
| 2 | **Observações livres do cliente na reserva** (campo texto opcional: "alergia a amendoim", "para entregar lá na escola", "favor sem laço") | Clientela artesanal sempre tem pedido especial; sem campo, ela usa o WhatsApp e o sistema perde dado | v1 | B | A |
| 3 | **Janela / horário preferencial de retirada** escolhido pelo cliente na reserva (slot grosso: manhã/tarde/noite, ou data + período) | Mãe organiza a fila de retirada; hoje no PROJECT só tem "retirada genérica" sem horário | v1 | B | A |
| 4 | **Telefone do cliente em destaque na tela do pedido com link `wa.me/<num>?text=<msg pré-formatada>`** ("Oi, Maria! Sua reserva #128 está confirmada, pode passar das 14h às 18h") | A mãe vai abrir WhatsApp pra cada pedido — se o sistema gerar a mensagem pronta, salva 30s × N reservas/dia. WhatsApp click-to-chat com mensagem prefilled é padrão consolidado de e-commerce no Brasil | v1 | B | A |
| 5 | **Estado "aguardando retirada" e "retirado" como passos explícitos no fluxo** (PROJECT.md cita "confirmada" mas não fecha o ciclo: como a mãe marca que o cliente já passou e levou?) | Sem esse fechamento, mãe não tem visão de "ainda devem aparecer hoje 4 pessoas". Reserva fica eternamente "confirmada" | v1 | B | A |
| 6 | **Política de no-show / não-retirou** explícita: depois de X horas após a janela combinada, lote volta para estoque automaticamente OU vira "perdido" registrado | Bakeries reais têm essa dor — produto perecível não retirado vira prejuízo. Sem política, o lote some do estoque e nunca volta | v1.x | M | A |
| 7 | **Fechamento de dia / resumo do dia** (uma tela: "hoje você teve 12 reservas, 9 retiradas, 3 ainda pendentes, faturamento R$ X, custo R$ Y, lucro R$ Z") | POS reconciliation diária é universal em food retail. Sem isso, a mãe não sabe se o dia foi bom até abrir relatórios complexos | v1 | B | A |
| 8 | **Snapshot de quanto tem em estoque AGORA, agrupado por produto, com flag visual de validade** ("Brigadeiro: 42 unid total, 8 vencem hoje") | Inventário consolidado é essencial; PROJECT cita "lotes" mas não a visão agregada que a mãe precisa pra decidir o que produzir amanhã | v1 | B | A |

### 1.2 Experiência do cliente

| # | Feature | Por que é table stake | Fase | Complex. | Impacto |
|---|---------|-----------------------|------|----------|---------|
| 9 | **Comprovante de reserva acessível depois** (link único, página `/r/<id>` ou no painel do cliente) com status atual + dados pra retirada | Cliente VAI perder o email; vai mandar print pra mãe no WhatsApp; vai precisar voltar 3 dias depois pra ver o pedido. Sem isso, a mãe vira centro de atendimento | v1 | B | A |
| 10 | **Barra de progresso visual de pontos para próxima recompensa** ("Você está a 40 pts de um brigadeiro grátis") no painel do cliente | Loyalty research consolidada: progresso visível dobra engagement vs. saldo numérico cru | v1 | B | A |
| 11 | **Página "Meus dados" editável** (telefone, endereço, nome) e exclusão da conta (LGPD: direito de exclusão é obrigatório, não opcional) | LGPD exige; PROJECT.md menciona termos mas não dá controle ao titular dos dados | v1 | B | A (legal) |
| 12 | **Confirmação de email no cadastro** (link de verificação) — ou pelo menos validação client-side rigorosa pra clientela mais velha que digita errado | PROJECT cita "talvez você tenha digitado o email errado" no login, mas não aborda email errado no CADASTRO. Cliente cadastra com typo, nunca recebe nada e some | v1 | B | A |
| 13 | **Recuperação de senha por email** | Trivial e esperado; não consta no PROJECT | v1 | B | A |
| 14 | **Mensagem clara quando produto está esgotado vs. fora de temporada vs. nunca existiu** (404 amigável) | Cliente que clica em link velho de WhatsApp vai cair em produto sem estoque — precisa entender que pode haver no próximo lote | v1 | B | M |
| 15 | **Indicador visual de "vence em X dias" no card do produto** quando a validade do lote disponível está próxima — usado tanto pra transparência quanto pra ajudar a girar o lote | Confeitarias online maduras mostram validade explícita; ajuda confiança e ajuda a vender o que tem que sair primeiro | v1 | B | M |

### 1.3 Compliance e operação básica

| # | Feature | Por que é table stake | Fase | Complex. | Impacto |
|---|---------|-----------------------|------|----------|---------|
| 16 | **Lista de alergênicos por produto** (contém leite / contém glúten / contém amendoim / contém ovo) — visível pro cliente no card | Vai ser pedido na primeira semana; pode evitar acidente real. Padrão na indústria de food (rotulagem ANVISA RDC 26/2015 já obriga em embalagem; coerência online é esperada) | v1 | B | A (segurança) |
| 17 | **Endereço de retirada com mapa / link Google Maps + observação de referência** ("portão preto, tocar a campainha 2x") na página de checkout/comprovante | Cliente novo precisa achar a casa; sem isso, mãe atende ligação "tô perdido" | v1 | B | A |
| 18 | **Backup de banco de dados visível pro próprio dono** (mesmo que automatizado: tela "último backup: hoje 03h, ok") | Operadora precisa de confiança visual de que se o celular quebrar não some tudo. Tranquilidade emocional importa | v1.x | B | M |
| 19 | **Auditoria mínima** (log de quem mudou preço de produto, quem editou um lote, quem confirmou reserva) — mesmo na v1 com 1 admin, esses eventos viram dado de ouro depois | Não custa caro ligar desde o dia 1; reescrever depois é caro | v1 | B | M |

---

## 2. Differentiators Reais (Vantagem Competitiva)

Features pouco comuns no nicho que casam com o **Core Value** ("lucro real + fidelização sem perder o WhatsApp"). Não são vaidade — são alavanca de uso/retorno.

### 2.1 No lado financeiro (única coisa que diferencia de qualquer site de loja online)

| # | Feature | Por que é diferencial | Fase | Complex. | Impacto |
|---|---------|----------------------|------|----------|---------|
| 20 | **Sub-receitas / receitas-mestre** ("calda de açúcar", "ganache base") usadas em 5 doces — produzir 1× a sub-receita gera estoque intermediário consumido por receitas-filhas | Software profissional de food cost (Recipe Cost Calculator, CookKeepBook) tem isso há anos; é o que diferencia "calculadora bobo" de "ferramenta real". Doceira artesanal usa MUITO calda/recheio em comum | v1.x | M | A |
| 21 | **"Alerta de margem inversa" / preço-piso sugerido**: sistema NÃO sugere preço (decisão respeitada), mas mostra "abaixo de R$ X você está vendendo no prejuízo (custo unitário + embalagem)" como linha vermelha visível ao digitar o preço | PROJECT já alerta margem < 30%, mas não destaca o piso absoluto. Pequena adição, evita erro grosseiro de digitação que o alerta de margem 30% não pega se a mãe digitar dois zeros a menos | v1 | B | A |
| 22 | **Comparativo "marca atual vs. melhor marca histórica"** no painel de análise por marca — não só "essa marca rendeu X" mas "mudando do leite condensado A pro B você economizaria R$ Y por lote, baseado em 12 lotes históricos" | PROJECT já tem análise por marca; o salto pra **recomendação acionável** é o diferencial real. Transforma dado em decisão | v2+ | M | A |
| 23 | **Histórico de preço de ingrediente em gráfico** (linha de tempo: leite condensado Nestlé subiu de R$ 8 pra R$ 11 no último ano) | Mãe vai sentir essa pressão; ver o gráfico ajuda a justificar reajuste de preço pra cliente | v1.x | B | M |
| 24 | **Custo unitário "sombra"**: lado a lado, custo congelado do lote E custo de reposição (se eu fosse refazer hoje, custaria X) | Custo congelado é decisão sólida (PROJECT já cobre). Mas pra DECIDIR preço de venda pro próximo lote, custo de reposição importa. Conviver os dois é um diferencial sutil mas poderoso | v1.x | B | A |

### 2.2 No relacionamento com o cliente

| # | Feature | Por que é diferencial | Fase | Complex. | Impacto |
|---|---------|----------------------|------|----------|---------|
| 25 | **Indicação ("traz seu amigo, ganha pontos")**: cliente compartilha link único, novo cliente que reservar a 1ª vez gera bônus pra ambos | Referral programs têm 30% mais conversão e 16% mais LTV (referralCandy/Zendesk research). Pra doceria de bairro, é o motor natural de crescimento (boca-a-boca já existe — formalizar dá tração). **Cuidado anti-feature 39 abaixo** | v1.x | M | A |
| 26 | **Vale-presente / cupom de presente**: cliente A compra "R$ 50 de doces" pra cliente B (gera código + email pro B) | Gift cards são acelerador clássico em datas-pico (Dia das Mães é literalmente o caso de uso). Casa com sazonalidade que o PROJECT já prevê | v2+ | M | A |
| 27 | **Bônus de aniversário automático** (pontos extras + cupom no aniversário do cliente) | Email lifecycle research: aniversário é touchpoint de mais alto retorno. Cliente sente "ela lembrou de mim". Custa muito pouco e gera reativação anual previsível | v1.x | B | A |
| 28 | **Email de "saudade"** (cliente sem reservar há 60 dias recebe um email leve, com talvez bônus de 50 pts pra voltar) | Win-back é padrão comprovado e barato; clientes inativos são mais baratos de reativar do que conquistar novos | v1.x | M | M |
| 29 | **"Avisem-me quando voltar"** em produto fora de estoque/temporada — quando mãe registra novo lote daquele produto, fila recebe email automático | Reduz frustração + cria demanda pré-acumulada para o lote novo. Confeitarias artesanais têm muita oscilação de catálogo | v1.x | M | A |
| 30 | **Histórico do cliente visível pra mãe** ("Maria — cliente desde mar/2026 — 14 reservas — preferida: brigadeiro de café — última: há 12 dias") na tela do pedido | Transforma o dado em superpoder pra atendimento. Mãe lembra cliente A mas não cliente B; o sistema lembra todos | v1 | B | A |
| 31 | **Nota interna do admin sobre cliente** (campo livre, só a mãe vê: "filha alérgica a amendoim", "não cobrar embalagem extra, é sobrinha") | CRM artesanal — clientela íntima de bairro — esse tipo de tag faz diferença real | v1.x | B | A |

### 2.3 Na operação

| # | Feature | Por que é diferencial | Fase | Complex. | Impacto |
|---|---------|----------------------|------|----------|---------|
| 32 | **Plano de produção da semana** (mãe define "vou produzir tal coisa terça e quinta") + mostra na vitrine "disponível a partir de terça" → cliente já reserva pra um lote ainda não-existente, sistema só consome quando o lote é registrado | Eleva o sistema de "vitrine reativa" pra "antecipação de demanda". Doceria pequena que NÃO faz isso, faz no escuro. Permite a mãe ver "essa semana já tenho 12 reservas pré-pagas em pontos pro lote de quinta — vale produzir" | v2+ | A | A |
| 33 | **Modo "alta demanda" sazonal**: durante campanha (Páscoa, Natal), reserva exige um número mínimo de itens, ou tem janela específica de retirada. Tudo configurável por campanha | Sazonalidade do PROJECT é só visual; uma camada operacional sazonal evita caos no Dia das Mães | v2+ | M | M |
| 34 | **Promoção de lote próximo do vencimento**: lote com validade em ≤ 2 dias ganha badge "Última Chance" + opcionalmente preço reduzido configurado pela mãe | Padrão consolidado em food retail (Walmart, supermercados): 60%+ dos clientes aceitam comprar com desconto perto da validade. Reduz prejuízo de produto não vendido (uma das maiores dores de quem vende perecível) | v1.x | M | A |
| 35 | **PWA installable (ícone na tela inicial do celular do cliente)** — sem app nativo, mas com manifest + service worker básico | Custo baixo, retenção alta. Cliente mais velho que clicou no WhatsApp tem ícone pronto; volta sem buscar de novo | v1.x | B | M |

---

## 3. Nice-to-have (Adiável)

| # | Feature | Por quê | Fase |
|---|---------|---------|------|
| 36 | Avaliação/estrelas de produto (cliente nota depois de retirar) | Social proof, mas em clientela de bairro a confiança já existe | v2+ |
| 37 | Galeria pública de fotos de cliente ("Meus brigadeiros foram pro aniversário da Sofia") | Engajamento social, requer moderação | v2+ |
| 38 | Compartilhamento direto pra Instagram a partir do produto | Bom mas raramente usado em e-commerce de bairro; custo de mantê-lo > benefício na v1 | v2+ |
| 39 | Filtros avançados de busca (por preço, por categoria, por validade) | Catálogo da mãe será pequeno (15-30 produtos); filtros são overkill | v2+ |
| 40 | Versão em desktop com layout admin "rico" | Mãe usa celular/tablet — desktop é luxo | v2+ |

---

## 4. Anti-Features (NÃO fazer — com justificativa)

Features que parecem boas e VÃO ser pedidas. Documentar a recusa AGORA evita refazer depois.

| # | Anti-feature | Por que parece boa | Por que é armadilha aqui | Alternativa |
|---|--------------|--------------------|--------------------------|-------------|
| A1 | **Chat ao vivo no site** | "Cliente tira dúvida em tempo real" | Mãe sozinha não consegue manter chat aberto durante produção. WhatsApp já cumpre essa função, e ela controla quando responde | Botão "Falar no WhatsApp" com mensagem pré-pronta (#4) |
| A2 | **Push notifications agressivas** ("Você tem 50 pts! Compre agora! Brigadeiro novo!") | Engajamento, conversão | Clientela mais velha não tolera notificações invasivas — desinstala / bloqueia. Dano de imagem permanente | Email transacional já previsto + email lifecycle moderado (#27, #28) |
| A3 | **Gamificação com badges/níveis/conquistas** ("Você é Cliente Bronze! Suba pra Prata!") | Engagement maior, sensação de jogo | Loyalty research mostra que mecânicas complexas confundem e desengaja a maioria dos usuários ("overload of mechanics"). Em clientela mais velha o efeito é maior. Aumenta custo de UI sem retorno | Saldo de pontos + barra de progresso (#10). Simples vence |
| A4 | **Pontos por engajamento (login diário, ler newsletter)** | "Aumenta retenção" | Mecânicas fora de transação dão métricas vaidosas e canibalizam margem (gera passivo de pontos sem receita correspondente) | Pontos só por R$ reservado e confirmado (PROJECT já decide isso) |
| A5 | **Cashback monetário (pontos viram dinheiro de desconto na compra seguinte)** | "Cliente sente desconto direto" | Vira margem cost direto e empurra a mãe pra concorrer com ela mesma. Fica difícil sair depois sem revolta de cliente | Resgate por catálogo separado (PROJECT já decide) — ela controla o que vira moeda |
| A6 | **Sugestão automática de preço baseado em margem-alvo** | "Sistema decide por mim" | PROJECT já recusou; reforçar — mãe perde sensibilidade de mercado, pode passar a vender caro demais e perder cliente que ela conhece | Alerta de margem com valor configurável (PROJECT) |
| A7 | **Múltiplos endereços de entrega no perfil do cliente** | "Profissional, e-commerce sério tem isso" | v1 só retirada; campo desnecessário polui cadastro e confunde clientela menos digital | Modelo de dados preparado, UI escondida (PROJECT já decide) |
| A8 | **Carrinho persistente longo + checkout multi-step** | "Padrão de e-commerce" | Reserva é simples, perecível, e a mãe confirma manualmente. Carrinho elaborado é fricção a mais. UX one-page é melhor pra clientela mais velha | Página única "Meu pedido" com itens + observação + botão Reservar |
| A9 | **Conta sem cadastro / "comprar como visitante"** | "Reduz fricção de checkout" | Quebra o programa de pontos (anônimo não acumula) e não casa com clientela conhecida (mãe quer ter contato). Gera reservas órfãs | Cadastro é pré-requisito; UX de cadastro deve ser rápida (#12) |
| A10 | **Sistema de cupons de desconto livre** ("PASCOA10", "BEMVINDO20") | "Marketing tradicional" | Clientela de bairro não responde a esse vocabulário; aumenta complexidade de admin (regras, expiração, exclusões); canibaliza margem que ela já controla com pontos | Cupom fica embutido em referral/aniversário (#25, #27), com regras fixas e simples |
| A11 | **WhatsApp Business API integrada** | "Tudo no WhatsApp da empresa, automático" | PROJECT já recusou por custo; reforçar — também tem custo cognitivo: separar conta pessoal/business em celular único, perder histórico de conversa, gerenciar templates aprovados | Email + painel + click-to-chat com WhatsApp pessoal (#4) |
| A12 | **Marketplace / vender produto de outras pessoas** | "Crescer a oferta" | Quebra o controle de qualidade que é a CARA do negócio. A mãe é o produto, não a plataforma | Manter monomarca; eventual sub-conta em v3+ |
| A13 | **Tradução / multilíngue** | "E se vier turista" | PROJECT já decide pt-BR único; reforçar | Nada |
| A14 | **Integração com iFood / Rappi** | "Mais canal" | Quebra o modelo (sem checkout online), diluição de margem, taxa de plataforma destrói lucro pequeno | Manter canal próprio |
| A15 | **Autenticação social (Google/Facebook login)** | "Mais fácil que senha" | Política de privacidade complexifica (compartilhamento de dado); clientela mais velha pode não ter conta Google. Email+senha é o que ela já entende | Email-first como PROJECT decide |
| A16 | **Estrelas / avaliação visível pra outros clientes** (≠ #36 que é privada pra mãe) | "Social proof" | Em clientela íntima, avaliação ruim = problema pessoal direto, não dado anônimo. Pode envenenar relação | Coletar feedback por email pós-retirada, privado |

---

## 5. Dependências Críticas (input pro roadmap)

```
[Lote com validade] (PROJECT)
      |
      ├──habilita──> [Promoção de lote próximo do vencimento] (#34)
      ├──habilita──> [Snapshot estoque com flag visual] (#8)
      └──habilita──> [Lista de separação do dia] (#1)

[Reserva confirmada] (PROJECT)
      |
      ├──habilita──> [Estado retirado/no-show] (#5, #6)
      ├──habilita──> [Resumo do dia] (#7)
      └──habilita──> [Pontos creditados] (PROJECT)
                            |
                            ├──habilita──> [Barra de progresso] (#10)
                            ├──habilita──> [Bônus aniversário] (#27)
                            └──habilita──> [Indicação cliente novo] (#25)

[Receita] (PROJECT)
      |
      └──refina──> [Sub-receitas / mestres] (#20)
                            |
                            └──refina──> [Custo de reposição "sombra"] (#24)

[Cliente cadastrado] (PROJECT)
      |
      ├──habilita──> [Campo observação na reserva] (#2)
      ├──habilita──> [Histórico do cliente pra mãe] (#30)
      ├──habilita──> [Nota interna do admin] (#31)
      └──habilita──> [Email lifecycle: welcome / winback / aniversário] (#27, #28)
```

**Conflito notável:** Anti-feature A9 (visitante) X Feature #25 (indicação). Ambos querem reduzir fricção do "convidado". Resolução: cadastro é obrigatório, MAS o link de indicação leva direto pra cadastro com nome do indicador pré-preenchido — fricção mínima sem quebrar o modelo.

---

## 6. MVP Recomendado (visão final)

Pegando o PROJECT.md como base e somando os table stakes esquecidos:

### v1 (lançar com isso, validar)

PROJECT.md inteiro **MAIS**:
- [ ] #1 Lista de separação do dia
- [ ] #2 Observação livre na reserva
- [ ] #3 Janela de retirada
- [ ] #4 wa.me com mensagem pré-formatada
- [ ] #5 Estado retirado/concluído explícito
- [ ] #7 Resumo do dia
- [ ] #8 Snapshot estoque agregado
- [ ] #9 Comprovante acessível (página /r/<id>)
- [ ] #10 Barra de progresso de pontos
- [ ] #11 LGPD: editar dados + excluir conta
- [ ] #12 Validar email no cadastro
- [ ] #13 Recuperação de senha
- [ ] #14 404/esgotado amigável
- [ ] #15 Validade visível no card
- [ ] #16 Lista de alergênicos
- [ ] #17 Endereço com mapa + referência
- [ ] #19 Auditoria mínima
- [ ] #21 Alerta de preço-piso (custo absoluto)
- [ ] #30 Histórico do cliente na tela do pedido

### v1.x (depois de validar fluxo básico, antes de escalar)

- [ ] #6 Política de no-show automatizada
- [ ] #18 Tela de status de backup
- [ ] #20 Sub-receitas / mestres
- [ ] #23 Gráfico histórico de preço de ingrediente
- [ ] #24 Custo de reposição "sombra"
- [ ] #25 Indicação (referral)
- [ ] #27 Bônus aniversário
- [ ] #28 Email winback
- [ ] #29 "Avisem-me quando voltar"
- [ ] #31 Nota interna do admin sobre cliente
- [ ] #34 Promoção de lote próximo do vencimento
- [ ] #35 PWA installable

### v2+ (quando houver sinal de demanda real)

- [ ] #22 Recomendação acionável de marca
- [ ] #26 Vale-presente
- [ ] #32 Plano de produção da semana
- [ ] #33 Modo alta demanda sazonal
- [ ] (Tudo da seção 3)

---

## 7. Considerações específicas do contexto

### 7.1 Operadora não-técnica (mãe)
- **Contagem de cliques**: cada feature do admin deve ter contagem honesta de cliques pra completar fluxo recorrente. Se "registrar lote" leva 14 cliques, vai virar planilha no celular.
- **Toda confirmação destrutiva** (cancelar reserva, excluir lote) precisa de duplo-toque OU undo de 5 segundos. Nunca diálogo sim/não em letra pequena.
- **Vocabulário consistente**: "lote", "reserva", "ponto", "resgate", "campanha" — escolher e nunca variar. "Pedido" ≠ "reserva", "produto" ≠ "lote".
- **Onboarding inicial guiado** (1ª vez no admin): "Cadastre seu 1º ingrediente" → "Cadastre sua 1ª receita" → "Registre seu 1º lote" → "Cadastre seu 1º produto". Sem isso, ela vai abrir o admin e travar. (#novo, sugerir v1)

### 7.2 Clientela mista de idade (bairro)
- **Tipografia mínima 16px no corpo, 18px+ em CTAs** (research consolidada de UX para clientela mais velha)
- **Contraste AAA quando possível, AA mínimo** (4.5:1 texto normal, 7:1 texto pequeno)
- **Touch targets ≥ 44px** com espaçamento generoso
- **Sem hover-only**: tudo precisa funcionar com toque
- **Sem dependência de cor pra significado** (status colorido SEMPRE acompanha texto/ícone)
- **Linguagem direta, sem jargão**: "Reservar" e não "Adicionar ao carrinho", "Sua mãe vai confirmar e te chamar no WhatsApp" e não "Aguarde o processamento do pedido"

### 7.3 Mobile como caso primário
- **Cliente vem de link do WhatsApp** → site precisa ser reconhecível imediatamente como "site da Valentina", não site genérico
- **Foto grande em destaque** — clientela compra com olho
- **Botão "Reservar" sempre visível** (sticky bottom em telas longas)
- **Performance crítica**: 1ª tela em < 2s em 3G da Tim no bairro

---

## 8. Mapeamento Competitivo

Padrões observados em operações similares (online + offline) e o que esse projeto faz de diferente:

| Padrão competitivo | Como concorrentes fazem | Como Doces Valentina vai fazer |
|---|---|---|
| Cardápio online | Goomer, iFood, kyte.site, sites próprios | Site próprio, mas com **lote visível e validade explícita** (raríssimo) |
| Reserva sem checkout | WhatsApp + planilha + memória | **Reserva estruturada com pontos, sem perder o WhatsApp** |
| Loyalty | Stamp.me (carimbo), Loyverse (POS), nada | **Pontos + sorteios + resgate, integrado ao histórico imutável** |
| Custo de produção | Excel, intuição, Recipe Cost Calculator | **Tracking por marca + custo congelado por lote** (combinação rara) |
| Sazonalidade | Banner manual, post no Insta | **Campanha com paleta + banner + produtos vinculados, automatizada** |
| Anti-no-show | Depósito antecipado | **Reserva sem dinheiro + política de não-retirou volta ao estoque** (#6) |

---

## 9. Gaps de pesquisa (a investigar mais tarde)

- **Comportamento real de cancelamento e no-show em doceria de bairro brasileira**: pesquisa publicada não cobre o nicho. Sugestão: registrar evento e medir nos primeiros 60 dias pra calibrar a política #6 com dado real.
- **Limite saudável de saldo de pontos** (a partir de qual passivo cumulativo a margem média começa a ficar comprometida): depende do mix dela; medir nos primeiros 90 dias.
- **Aceitação de PWA installable em clientela 50+** no Brasil: pouca pesquisa direta; pode falhar e exigir simplificação extra.
- **Frequência ideal de email lifecycle**: research geral (welcome em 5min, winback em 60-90 dias) é boa baseline, mas calibrar com dado real cedo.

---

## 10. Sources

### Loyalty / Fidelização
- [Stamp Me — Top 5 Loyalty Program Features Small Businesses Actually Use](https://www.stampme.com/blog/top-loyalty-program-features-small-business)
- [Loyverse — Best Loyalty Software Programs](https://loyverse.com/blog/best-loyalty-software-programs-for-small-to-medium-businesses)
- [LoyaltyLion — 11 Loyalty Program Mistakes](https://loyaltylion.com/blog/the-11-reasons-loyalty-programs-usually-fail-and-how-you-can-avoid-them)
- [OpenLoyalty — Types of loyalty programs: what actually works](https://www.openloyalty.io/insider/types-of-loyalty-programs-models-evidence-and-what-actually-works)
- [Antavo — Loyalty Program Mistakes](https://antavo.com/blog/loyalty-program-mistakes-mission-loyalty/)
- [Retail Customer Experience — Why gamified loyalty programs fail](https://www.retailcustomerexperience.com/blogs/5-reasons-why-gamified-loyalty-programs-fail/)
- [LoopyLoyalty — Bakery Loyalty Card](https://blog.loopyloyalty.com/bakery-loyalty-card-a-recipe-for-repeat-business-db7afc677a14)
- [Cheers — Bakery and Dessert Shop Customer Loyalty](https://earnredeemcheer.com/businesses/bakery-loyalty-program/)

### Referral / Word of Mouth
- [Giftbit — Successful Referral Program for Small Business](https://www.giftbit.com/blog/successful-referral-program-small-business)
- [Zendesk — Customer Referral Program 2026](https://www.zendesk.com/blog/customer-referral-program/)
- [Retainful — Best Referral Program Examples](https://www.retainful.com/blog/best-referral-program-examples-to-increase-word-of-mouth)

### Email Lifecycle
- [Crowdspring — Lifecycle Email Marketing Guide](https://www.crowdspring.com/blog/lifecycle-email-marketing/)
- [ReferralCandy — Lifecycle Email Marketing Ecommerce 2026](https://www.referralcandy.com/blog/lifecycle-email-marketing-ecommerce-the-2026-complete-guide-to-maximizing-customer-value)
- [MailCharts — 5 Must-Have Email Lifecycle Campaigns](https://www.mailcharts.com/blog/lifecycle-campaigns)
- [Drip — Win Back Email Examples](https://www.drip.com/blog/win-back-email-examples)

### Food Cost / Sub-receitas
- [Recipe Cost Calculator (recipecostcalculator.net)](https://recipecostcalculator.net/)
- [CookKeepBook — Recipe/Food Cost Calculator](https://www.cookkeepbook.com/)
- [BakeProfit — 10 Best Recipe Cost Calculators 2026](https://bakeprofit.com/blog/best-recipe-calculators)
- [Reciprofity — Food Costing & Inventory Management](https://reciprofity.com/)
- [MenuSano — Recipe Costing Software](https://www.menusano.com/recipe-costing-software/)

### Estoque perecível
- [Toast POS — How to Handle Expired Products](https://pos.toasttab.com/blog/on-the-line/expired-products)
- [VasyERP — Expiry Management in Retail Stores](https://vasyerp.com/the-retail-guru/expiry-management-in-retail-stores)
- [ScienceDirect — Dynamic expiration date-based discounting of fresh food products](https://www.sciencedirect.com/science/article/pii/S0925527325003093)
- [Krazy Coupon Lady — Stores That Mark Down Food Near Best-By Date](https://thekrazycouponlady.com/tips/store-hacks/shelf-life-savings-these-stores-mark-down-items-near-their-best-by-date)
- [Shelvz — Shelf-Life Management with Promotions](https://www.shelvz.com/shelf-life-management-avoiding-expiries-with-promotions/)

### No-show / Reservas
- [Toast — Restaurant Reservation Cancellation Fees](https://pos.toasttab.com/blog/on-the-line/restaurant-reservation-cancellation-fees)
- [TableCheck — Strategies to Minimize Restaurant No-Shows](https://www.tablecheck.com/en/blog/strategies-minimize-restaurant-no-shows/)
- [BAKE PORT — Reservation and pre-order system](https://bakerypartner.com/en/cc63b9dd-64c1-425e-a397-93fb4bc1655a/)
- [Tiffany's Bakery — Cancellation Policies](https://www.tiffanysbakery.com/pages/cancellation-changes-returns)

### POS / Operação
- [FitSmallBusiness — POS Reconciliation in 7 Steps](https://fitsmallbusiness.com/pos-reconciliation/)
- [Manifestly — End-of-Day Sales Reconciliation Checklist](https://www.manifest.ly/use-cases/restaurant/end-of-day-sales-reconciliation-checklist)
- [The Culinary Pro — Kitchen Prep Sheet](https://www.theculinarypro.com/kitchen-prep)
- [WebstaurantStore — Kitchen Prep Lists Guide](https://www.webstaurantstore.com/article/583/kitchen-prep-lists.html)
- [RestaurantOwner — Daily Prep Sheet](https://www.restaurantowner.com/public/Daily-Prep-Sheet.cfm)

### WhatsApp click-to-chat
- [WhatsApp — How to use click to chat](https://faq.whatsapp.com/5913398998672934)
- [Verloop — How to Create WhatsApp Click-to-Chat Link](https://www.verloop.io/blog/create-a-whatsapp-link-click-to-chat/)
- [QuadLayers — Create wa.me Link with Pre-Filled Message](https://quadlayers.com/how-to-create-a-whatsapp-link-wa-me-with-a-pre-filled-message/)

### Acessibilidade clientela 50+ / mobile
- [PMC NIH — Optimizing mobile app design for older adults](https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/)
- [Adchitects — Guide To Interface Design for Older Adults](https://adchitects.co/blog/guide-to-interface-design-for-older-adults)
- [Toptal — Interface Design for Older Adults](https://www.toptal.com/designers/ui/ui-design-for-older-adults)
- [Cadabra — Essential UX for Elderly](https://cadabra.studio/blog/ux-for-elderly/)

### PWA
- [MDN — PWA Re-engageable Notifications and Push](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push)
- [MDN — PWA Offline Service Workers](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Offline_Service_workers)

### Alérgenos / Dietary
- [Restaurantware — How to Cater to Dietary Restrictions](https://www.restaurantware.com/blogs/menu-development-and-ideas/how_to_cater_to_dietary_restrictions_and_preferences)
- [GonnaOrder — Allergen Info in Restaurant Digital Menu](https://www.gonnaorder.com/blog/what-is-the-importance-of-providing-allergen-information-on-your-digital-menu/)

### Confeitarias artesanais BR (observação de mercado)
- [Brigaderia](https://brigaderia.com.br/)
- [Ponto de Brigadeiro](https://www.pontodebrigadeiro.com.br/)
- [La Panela Brigaderia](https://app.lapanela.com.br/)
- [Delizie Brigaderia (kyte.site exemplo)](https://delizie-brigaderia-artesanal.kyte.site/)
- [CNN Brasil — 10 lugares em SP para encomendar brigadeiros](https://www.cnnbrasil.com.br/viagemegastronomia/gastronomia/10-lugares-em-sao-paulo-para-encomendar-brigadeiros/)

---

*Feature research for: Doces Valentina*
*Researched: 2026-04-29*
*Quality gate: não duplica PROJECT.md / anti-features justificadas / considera operadora não-técnica e clientela mista de idade.*
