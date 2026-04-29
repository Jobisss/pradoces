# Pitfalls Research — Doces Valentina

**Domain:** Reserva online de doces artesanais (pré-produção) com gestão de custo, lotes, validade e fidelização por pontos
**Researched:** 2026-04-29
**Confidence:** MEDIUM-HIGH (LGPD/ANVISA confirmadas em fontes oficiais; pitfalls técnicos validados em docs oficiais; pitfalls operacionais derivados do perfil "operadora não-técnica em VPS único")
**Stack-aware:** Next.js 16 App Router, PostgreSQL 16+ em VPS único Hostinger, Resend, Cloudflare proxy, Drizzle ORM (assumido), Resend.

---

## Como ler este documento

Cada pitfall tem 4 atributos:

- **Severidade:** `BLOQUEADOR` (não pode ir pra produção) / `CRÍTICO` (resolver antes de uso real) / `IMPORTANTE` (resolver antes de escalar) / `BOM-DE-SABER` (evita dor)
- **Sinal de alerta:** como detectar antes de virar incêndio
- **Prevenção:** ação concreta no design/código
- **Fase recomendada:** quando endereçar no roadmap

A última seção (Pitfall-to-Phase Mapping) consolida tudo numa tabela única para input direto na criação do roadmap.

---

## 1. Pitfalls Legais e Regulatórios

### Pitfall 1.1: LGPD — Tratar dados de menores sem consentimento parental

**Severidade:** CRÍTICO

**O que sai errado:**
A clientela do bairro inclui pais que reservam para crianças, ou — pior — crianças/adolescentes acessam o site e se cadastram. A LGPD exige consentimento parental específico para dados de menores de 12 anos (art. 14) e tratamento adequado para 12-18 anos. Se a mãe armazenar telefone e nome de uma criança sem consentimento dos pais, a ANPD pode multar (multa simples até 2% do faturamento, limitada a R$ 50 milhões — sim, vale para microempresa também).

**Por que acontece:**
Cadastro pede só email + senha + nome + telefone. Não há campo "data de nascimento" nem checkbox "sou maior de 18 anos". Site assume que quem cadastra é adulto.

**Sinal de alerta:**
- Reservas com nomes que parecem de criança ("João, 8 anos")
- Clientes mencionando que filho fez a reserva pelo celular dele
- Telefones sem prefixo padrão de adulto

**Prevenção:**
1. Adicionar checkbox no cadastro: "Declaro ser maior de 18 anos"
2. Termos de uso explicitando que cadastro é para adultos
3. Canal claro para pais reportarem cadastro indevido (email da mãe basta)
4. Em caso de pedido de exclusão por responsável legal, processar em até 15 dias

**Fase recomendada:** Junto com auth/cadastro (Fase de Identidade & Auth)

---

### Pitfall 1.2: LGPD — Falta de mecanismo de exportação/exclusão de dados

**Severidade:** CRÍTICO

**O que sai errado:**
Cliente pede para deletar conta e a mãe não tem botão para fazer isso. Pede "todos os dados que vocês têm sobre mim" e ninguém sabe responder. ANPD considera direito do titular não atendido = infração.

**Por que acontece:**
Foco fica em features de produto (catálogo, reserva, pontos). Direitos do titular ficam pra "depois".

**Sinal de alerta:**
- Não existe rota `/admin/clientes/:id/exportar` nem `/admin/clientes/:id/excluir`
- Não há registro de quem aceitou termos e quando
- Não há log de operações sobre dados pessoais

**Prevenção:**
1. **Aceite registrado:** ao cadastrar, gravar `terms_accepted_at`, `privacy_accepted_at`, `terms_version`
2. **Botão de exclusão:** painel do cliente tem "Excluir minha conta" que dispara hard-delete (ou anonimização) com confirmação
3. **Botão de exportação:** painel do cliente tem "Baixar meus dados" → JSON com cadastro, reservas, histórico de pontos
4. **Anonimização vs exclusão:** reservas históricas precisam virar `cliente: "[excluído]"` em vez de DELETE em cascata (preserva relatórios financeiros sem reter dado pessoal)
5. **Política de retenção:** definir explicitamente — ex.: "histórico de reservas mantido por 5 anos para fins fiscais; depois disso, anonimizado"

**Fase recomendada:** Antes de v1 ir pra produção. Não opcional.

---

### Pitfall 1.3: LGPD — Política de privacidade genérica que não descreve o tratamento real

**Severidade:** IMPORTANTE

**O que sai errado:**
Mãe copia template genérico da internet. Política diz "podemos compartilhar dados com parceiros comerciais" quando ela não tem parceiros, ou omite que usa Resend (operador de tratamento sediado nos EUA — transferência internacional precisa estar declarada).

**Por que acontece:**
Templates genéricos não cobrem o stack específico. Resend hospeda fora do Brasil = transferência internacional = cláusula obrigatória.

**Sinal de alerta:**
- Política menciona "cookies de marketing" quando o site não tem
- Política não menciona Resend nem Cloudflare
- Política não tem data nem versão

**Prevenção:**
1. Política descreve exatamente: dados coletados (email, nome, telefone, histórico de reservas), finalidade (atender pedido, fidelização, contato comercial), base legal (consentimento + execução de contrato), operadores (Resend para email, Cloudflare para CDN, Hostinger para hospedagem), retenção (X anos), direitos do titular
2. Versionar política — campo `privacy_version` no aceite
3. Quando alterar, exigir novo aceite de quem já estava cadastrado

**Fase recomendada:** Antes de v1 ir pra produção.

---

### Pitfall 1.4: ANVISA — Promessas de saúde/qualidade que viram propaganda enganosa

**Severidade:** IMPORTANTE

**O que sai errado:**
Mãe escreve descrição "brigadeiro 100% natural, sem conservantes, ajuda na imunidade". RDC 727/2022 e Lei 8.078/90 (CDC) proíbem alegações de saúde sem comprovação científica. Vigilância sanitária pode receber denúncia, abrir auto de infração e mandar tirar do ar.

**Por que acontece:**
Linguagem comercial natural ("o melhor brigadeiro do bairro!", "saudável", "diet sem açúcar"). Quem escreve descrição não pensa em compliance.

**Sinal de alerta:**
- Palavras como: "saudável", "diet", "light", "zero açúcar", "natural", "sem conservantes", "imunidade", "energético"
- Comparações: "mais saudável que X"
- Promessas terapêuticas: "ajuda em..."

**Prevenção:**
1. **Guia de redação na UI:** texto curto no campo de descrição alertando "evite alegações de saúde, diet/light, comparações com outras marcas"
2. **Linter de palavras:** lista local de termos suspeitos que o admin destaca em amarelo ao salvar (não bloqueia, alerta)
3. **Foco na ANVISA RDC 259/2002 e RDC 727/2022:** rotulagem física do produto entregue precisa ter denominação, lote, validade, fabricante. Site pode não exigir, MAS embalagem que vai com o cliente sim.
4. **Mãe é dispensada de registro do produto** (RDC 27/2010 — produtos de doceria vendidos diretamente ao consumidor pelo próprio produtor são isentos), mas isenção de registro ≠ isenção de boas práticas. Vigilância sanitária municipal pode visitar.

**Fase recomendada:** Junto com cadastro de produtos (Fase Catálogo).

---

### Pitfall 1.5: Validade exibida no site difere da validade impressa no produto

**Severidade:** CRÍTICO (responsabilidade civil + reputação)

**O que sai errado:**
Site diz "lote vence 22/04". Cliente reserva. Mãe esquece de imprimir etiqueta no doce. Cliente come depois e passa mal. Diz "no site dizia que vencia 22/04, comi dia 21, tô passando mal". Briga pode escalar para Procon + auto da Vigilância.

**Por que acontece:**
Validade é cadastrada no admin (campo digital), mas operação física na cozinha não conversa com sistema. Ou o sistema deixa a mãe alterar validade depois que cliente já reservou.

**Sinal de alerta:**
- Lote teve `validity_date` editado depois de ter reservas ativas
- Mãe relata "esqueci de etiquetar"

**Prevenção:**
1. **Imutabilidade da validade após primeira reserva:** depois que existe reserva ativa para o lote, campo de validade fica readonly. Para corrigir, mãe precisa cancelar reservas e reabrir o lote.
2. **Etiqueta imprimível:** fluxo de "produzir lote" gera PDF de etiquetas com lote+validade prontos para colar — reduz erro humano
3. **Confirmação no checkout:** cliente vê "ATENÇÃO: este lote vence em DD/MM. Validade impressa na embalagem." antes de confirmar reserva
4. **Termos de uso:** declarar que cliente é responsável por consumir até a validade impressa, e que site mostra a validade do lote no momento da reserva

**Fase recomendada:** Junto com lotes/estoque (Fase Lotes & Reservas).

---

### Pitfall 1.6: Cliente reserva, lote já produzido, cliente cancela — quem absorve o custo?

**Severidade:** IMPORTANTE (não é legal, é operacional/contratual)

**O que sai errado:**
Mãe produziu o lote para 5 reservas. Cliente cancela 3 horas antes da retirada. Lote vence em 2 dias. Resto da clientela já tinha reservado outros doces. Mãe come o prejuízo.

**Por que acontece:**
Reserva sem compromisso financeiro ⇒ cliente trata como "vou ver". Política de cancelamento não está clara nem é forçada.

**Sinal de alerta:**
- Taxa de cancelamento > 15% das reservas
- Cancelamentos concentrados perto da hora de retirada
- Mesmos clientes cancelando frequentemente

**Prevenção:**
1. **Janela de cancelamento configurável** (já está no PROJECT.md): cliente cancela até X horas antes. Default: 24h.
2. **Após a janela, cancelamento bloqueado pelo cliente:** ele precisa falar com a mãe via WhatsApp (mantém o contato pessoal, gera atrito útil)
3. **Tracking de "no-show":** reservas confirmadas que não foram retiradas viram flag no perfil do cliente; mãe vê histórico antes de confirmar próxima
4. **Estratégia anti-prejuízo:** "redistribuir" lote — botão admin "marcar lote como queima" reaproveita pontos: cliente fiel ganha desconto/oferta especial em lote prestes a vencer
5. **Termo de uso:** explicitar que reserva é compromisso de retirada, não checkout reversível

**Fase recomendada:** Junto com fluxo de reserva (Fase Lotes & Reservas).

---

## 2. Pitfalls Técnicos — Banco e Dados

### Pitfall 2.1: Float em vez de NUMERIC para dinheiro destrói margem

**Severidade:** BLOQUEADOR

**O que sai errado:**
`real`/`double precision`/JavaScript `number` perde precisão decimal. R$ 0.10 + R$ 0.20 vira 0.30000000000000004. Em sistema com cálculo de custo unitário (preço lote / rendimento), erro acumula. Ao final do mês, relatório diz lucro foi R$ 1.234,56 quando foi R$ 1.234,78. Mãe perde confiança no sistema.

**Por que acontece:**
ORM ou template default usa `number`/`float`. Drizzle aceita `real`, `double` e tudo parece funcionar nos testes.

**Sinal de alerta:**
- Schema tem `real`, `double precision`, `float` em qualquer coluna de dinheiro
- Front faz `(custo / rendimento)` em JavaScript sem biblioteca decimal
- Relatório diferente do esperado por R$ 0,01-0,05

**Prevenção:**
1. **Schema:** TODA coluna monetária é `numeric(19, 4)` (4 casas para conta intermediária; arredondar para 2 só na exibição). Ingredientes podem precisar mais (R$/g pode ser 0.0023).
2. **Alternativa válida:** armazenar em centavos como `bigint`. Então R$ 5,40 = 540. Aritmética inteira nunca arredonda.
3. **Drizzle:** `numeric` retorna string — usar [decimal.js](https://mikemcl.github.io/decimal.js/) ou [dinero.js](https://dineroJS.com) no app, NUNCA `Number(value)`
4. **Não usar `MONEY`:** tipo `MONEY` do Postgres depende de locale e não é portável
5. **Testes:** test case explícito "1/3 do lote × 3 = lote inteiro" com numeric (deve dar exato), depois mesmo teste com float (vai dar errado, prova que o tipo importa)

**Fase recomendada:** Schema inicial (Fase Foundation/Data Model). É decisão arquitetural, mudar depois requer migration dolorosa.

**Recovery cost:** ALTA se descoberto após 6 meses de produção.

---

### Pitfall 2.2: Timezone bug em validade de lote

**Severidade:** CRÍTICO (validade de alimento — risco direto)

**O que sai errado:**
Mãe cadastra "lote vence 22/04" às 23:50 BRT. Sistema salva como UTC (= 23/04 02:50 UTC). Query `WHERE validity_date >= NOW()` no início do dia 22 (BRT) ainda retorna o lote como válido — porque NOW() retorna UTC. Mas o lote VENCE no dia 22, não no dia 23. Cliente reserva achando que ainda dá tempo. Doce vence antes da retirada.

Inversamente: lote que ainda está válido pode sumir da vitrine no dia errado.

**Por que acontece:**
- PostgreSQL armazena `timestamp with time zone` em UTC internamente
- Servidor da VPS pode estar com TZ=UTC ou TZ=America/Sao_Paulo (não dá pra assumir)
- Brasil tem horário de verão historicamente (revogado em 2019, mas DST abreviations ainda no banco do Postgres podem confundir)
- Next.js server-side roda em Node.js que usa `process.env.TZ` ou padrão do SO

**Sinal de alerta:**
- `Date.now()` no front e `NOW()` no banco produzem resultados aparentemente consistentes mas há offset de horas
- Lote desaparece da vitrine "um dia antes do esperado" segundo a mãe
- Logs mostram timestamps em UTC mas data exibida ao cliente está em BRT

**Prevenção:**
1. **Schema:** TODAS as colunas temporais usam `timestamp with time zone` (`timestamptz`) — nunca `timestamp` puro
2. **Validade de lote:** semanticamente é uma DATA (não datetime). Armazenar como `date` e comparar com `current_date AT TIME ZONE 'America/Sao_Paulo'`. OU armazenar timestamptz fixado ao fim do dia (23:59:59 BRT) explicitamente.
3. **Servidor TZ explícito:** `TZ=America/Sao_Paulo` no `.env` do Next.js E `timezone = 'America/Sao_Paulo'` no `postgresql.conf` (ou `SET TIMEZONE` por sessão)
4. **Renderização:** sempre usar `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` no front. Nunca `new Date(str).toLocaleDateString()` sem timezone explícito.
5. **Cron de "expirar lotes":** rodar de hora em hora (não 1×/dia) — janela de erro reduz para 1h
6. **Teste:** rodar suite com `TZ=UTC` e `TZ=America/Sao_Paulo` — comportamento deve ser idêntico

**Fase recomendada:** Schema inicial + qualquer query que toque data.

---

### Pitfall 2.3: Race condition no estoque — dois clientes reservam o último doce

**Severidade:** CRÍTICO

**O que sai errado:**
Lote tem 1 unidade. Cliente A e Cliente B abrem a página ao mesmo tempo. Ambos clicam "reservar". Sem locking, ambas as transações leem `available = 1`, ambas decrementam para 0, ambas confirmam. Mãe agora deve 2 doces e tem 1 produzido.

**Por que acontece:**
Padrão ingênuo: `SELECT available FROM lote WHERE id = ?` → app calcula → `UPDATE lote SET available = available - 1`. Sem `FOR UPDATE` nem check de `WHERE available >= ?`.

**Sinal de alerta:**
- Reservas excedem `lote.available` original
- Logs mostram duas reservas no mesmo lote em milissegundos próximos
- Mãe relata "tinha só 1, vendi 2"

**Prevenção:**
1. **Padrão pessimista (preferido para baixo volume):** dentro de transação, `SELECT * FROM lote WHERE id = ? FOR UPDATE` antes de decrementar. Bloqueia leituras concorrentes da mesma linha.
2. **Padrão otimista (alternativa):** `UPDATE lote SET available = available - ? WHERE id = ? AND available >= ? RETURNING available`. Se afetou 0 linhas, falhou — retorna erro ao cliente.
3. **Constraint defensiva:** `CHECK (available >= 0)` no schema. Garante que mesmo um bug não deixa estoque negativo (transação aborta).
4. **Volume real:** clientela do bairro = baixíssima contenção. Padrão otimista basta. Mas a constraint é mandatória.
5. **Teste:** stress test simulando 10 reservas paralelas no mesmo lote de 1 unidade — exatamente 1 deve ter sucesso.

**Fase recomendada:** Junto com fluxo de reserva (Fase Lotes & Reservas).

---

### Pitfall 2.4: Migration de schema com dados em produção (200 receitas, 1000 ingredientes)

**Severidade:** IMPORTANTE → CRÍTICO conforme cresce

**O que sai errado:**
v1 modela `ingredient.unit` como `varchar`. Depois de 6 meses, mãe tem 200 receitas usando "g", "gramas", "grama", "gr". Refactor para enum quebra dados. Ou: mudar `lote.cost` de `numeric(10,2)` para `numeric(19,4)` requer recalcular, mas `cost_per_unit` é histórico imutável — não pode recalcular.

**Por que acontece:**
Schema v0 sempre é otimista. Pressão de prazo prioriza shipping sobre normalização. Documentação de "como migrar X depois" não é escrita.

**Sinal de alerta:**
- Strings em vez de enums para campos com valores conhecidos
- Falta de constraints que documentariam a intenção
- Dependência de "saber mexer no banco" para corrigir dados

**Prevenção:**
1. **Investir em modelagem antes de codar:** unidades de medida como tabela referência (não string), enums Postgres para status (`reservation_status`, `lot_status`), foreign keys explícitas
2. **Tooling de migration desde dia 1:** Drizzle `drizzle-kit` ou Prisma Migrate com versionamento + `down` migrations testadas
3. **Backup automático ANTES de cada migration de produção:** script de deploy faz `pg_dump` antes de rodar `migrate`
4. **Migrations expand-then-contract:** adicionar nova coluna → backfill → app passa a usar → remover velha (3 deploys, mas zero downtime e zero risco)
5. **Banco de staging idêntico:** restaurar dump de produção → rodar migration → smoke test antes de aplicar em prod

**Fase recomendada:** Foundation. Toolage de migration deve estar pronta antes da primeira feature ir pra produção.

---

## 3. Pitfalls Técnicos — Operação e Infraestrutura

### Pitfall 3.1: Backup que existe mas não restaura

**Severidade:** BLOQUEADOR

**O que sai errado:**
Cron diário roda `pg_dump > backup.sql`, sobe pra R2. Tudo verde. Seis meses depois, VPS pega ransomware ou disco falha. Tenta restaurar e... `pg_dump` foi feito sem `--clean`, ou o R2 cortou o upload na metade e ninguém viu, ou a versão do Postgres mudou e dump v14 não restaura em v16, ou o backup tem só `public` schema e perdeu extensions.

> "A backup is only trustworthy after you verify it and successfully restore it in practice." ([oneuptime](https://oneuptime.com/blog/post/2026-01-21-postgresql-backup-testing/view))

**Por que acontece:**
Cron parece funcionar = "está resolvido". Ninguém faz drill de restore. Stakeholder não-técnica não cobra (não sabe que precisa).

**Sinal de alerta:**
- Tamanho do dump cai inexplicavelmente (ex.: 50MB → 5MB) e nenhum alerta
- Logs do cron silenciosos (sem alerta de erro)
- Drill nunca foi feito
- Tempo entre dumps > 24h

**Prevenção:**
1. **Backup 3-2-1:** 3 cópias, 2 mídias diferentes, 1 off-site. VPS local + R2 + opcional dump semanal pro Hostinger storage.
2. **`pg_dump --format=custom --no-owner --clean --if-exists`** — formato que permite `pg_restore` seletivo
3. **Verificação imediata pós-dump:** script faz `pg_restore --list` no arquivo, conta tabelas esperadas, valida tamanho mínimo. Se falhar, alerta por email pra mãe E pro dev.
4. **Drill mensal automático:** cron mensal restaura dump em banco staging, roda `SELECT count(*)` em 5 tabelas-chave, compara com snapshot esperado, gera relatório
5. **Drill manual antes de produção:** ANTES de v1 ir pro ar, simular perda total — destruir VPS staging, restaurar do backup, app precisa subir e funcionar
6. **Retenção:** 7 daily + 4 weekly + 12 monthly (cobre 1 ano)
7. **Encriptar backup com chave fora da VPS** (gpg com senha em password manager) — protege contra ransomware que pega o R2 também

**Fase recomendada:** Antes de v1 ir pra produção. Backup que não foi restaurado uma vez não conta.

**Recovery cost:** CATASTRÓFICA se descobrir no momento que precisa.

---

### Pitfall 3.2: Email deliverability — Resend configurado mas vai pra spam

**Severidade:** CRÍTICO (mãe perde reservas que não chegam)

**O que sai errado:**
Configura Resend, manda primeiro email, chega na caixa principal do Gmail. Após 200 emails, Gmail decide que o domínio é suspeito e move tudo pra spam. Cliente perde código de confirmação. Mãe perde alerta de nova reserva. Negócio para.

**Por que acontece:**
1. **DKIM/SPF mas sem DMARC** — Gmail/Outlook tightening: a partir de fev/2024 exigem DMARC para envios em volume
2. **DMARC `p=none`** sem RUA (relatório) — Resend setup default deixa monitoring vazio ([dmarcdkim.com](https://dmarcdkim.com/setup/how-to-setup-resend-spf-dkim-and-dmarc-records))
3. **From address inconsistente:** ora `noreply@docesvalentina.com.br`, ora `mae@docesvalentina.com.br`
4. **Conteúdo HTML pesado, sem versão text/plain**
5. **Sem warm-up:** mandar 1000 emails no primeiro dia depois de 0 do domínio é red flag

**Sinal de alerta:**
- Cliente: "não recebi confirmação" (mas nem checa spam)
- Resend dashboard mostra `bounce_rate > 5%` ou `complaint_rate > 0.1%`
- DMARC report (RUA) mostra `pct=0` em alinhamento

**Prevenção:**
1. **Setup completo no Resend:**
   - `MX` apontando pro Resend (Resend pede pra recepção de bounces)
   - `SPF` (TXT `v=spf1 include:resend.com -all`)
   - `DKIM` (CNAME provido pelo Resend)
   - `DMARC` `v=DMARC1; p=quarantine; rua=mailto:dmarc@docesvalentina.com.br; pct=100`
   - Cuidado: Resend default só configura `p=none` — trocar para `quarantine` após 2 semanas de monitoramento sem fail
2. **From sempre o mesmo:** `Doces Valentina <oi@docesvalentina.com.br>`
3. **Email tem versão text/plain** (Resend React Email gera ambas se configurado)
4. **Reply-to válido:** caixa que a mãe lê
5. **Warm-up:** primeiros dias só email transacional pra ela mesma e família, depois libera produção
6. **Monitorar:** Resend dashboard tem deliverability score — checar semanalmente
7. **Plano B documentado:** se Resend falhar totalmente, qual o fallback? (ex.: SendGrid, AWS SES)

**Fase recomendada:** Antes de habilitar fluxo de reserva real. Email é parte do produto.

---

### Pitfall 3.3: SSL expirando porque renovação não automática

**Severidade:** CRÍTICO (site fora do ar = sem reservas)

**O que sai errado:**
Let's Encrypt cert expira em 90 dias. Setup inicial funciona. Em 80 dias, certbot tenta renovar, falha (porta 80 bloqueada por nova firewall rule, ou nginx/caddy mudou config), ninguém vê os logs. Em 90 dias, navegador bloqueia o site. Cliente abre WhatsApp pra mãe: "tá dando erro feio".

**Por que acontece:**
1. Certbot é instalado mas timer/cron não é validado
2. Validação Let's Encrypt requer HTTP-01 (porta 80) ou DNS-01; mudanças na firewall quebram
3. Reload do nginx/caddy depois de renovar não acontece automaticamente
4. Cron job roda como root, falha silenciosamente em ambiente sem mail

**Sinal de alerta:**
- `certbot certificates` mostra cert expirando em < 30 dias e nada renovou
- Logs `/var/log/letsencrypt/letsencrypt.log` com erros não vistos
- Não tem alerta proativo

**Prevenção:**
1. **Caddy em vez de Nginx:** Caddy renova SSL automaticamente, zero configuração. Para VPS único e operadora não-técnica é a escolha óbvia.
2. **Se Nginx, certbot com renew hook:**
   ```bash
   0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
   ```
3. **Monitor externo:** [Better Stack](https://betterstack.com), [UptimeRobot](https://uptimerobot.com) (free tier) checa SSL e notifica 14 dias antes de expirar — independente da VPS
4. **Renovação a cada 60 dias** (não 90): janela maior pra resolver problema antes de quebrar
5. **Drill:** após primeiro deploy, forçar `certbot renew --force-renewal` para validar que pipeline funciona

**Fase recomendada:** Junto com setup da VPS (Fase Foundation/Infra).

---

### Pitfall 3.4: Domínio expira porque não tem auto-renew

**Severidade:** CATASTRÓFICO (perde domínio = perde marca + emails configurados)

**O que sai errado:**
`.com.br` no Registro.br, registrado por 1 ano, R$ 40. Aviso de renovação vai pro email da mãe (que ela criou só pra registrar e não checa). Domínio expira, entra em "período de retenção", scammer registra e oferece de volta por R$ 5000. OU domínio simplesmente vai pra leilão.

**Por que acontece:**
Registro.br não tem auto-renew automatico habilitado por padrão para `.com.br`. Cobrança vai pra email/CPF. Operadora não-técnica não associa "boleto Registro.br" com "site fica fora do ar".

**Sinal de alerta:**
- Email do Registro.br: "seu domínio expira em 30 dias" — facilmente filtrado/ignorado
- Site para de funcionar inexplicavelmente
- Whois mostra status `pending delete`

**Prevenção:**
1. **Renovar por 5 anos** logo na primeira compra (Registro.br aceita) — reduz pressão pra 1×/5 anos
2. **Habilitar débito automático no Registro.br** se possível (tem opção via cartão)
3. **Calendar reminder externo** (Google Calendar): 60, 30, 7 dias antes da expiração — independente do email do Registro.br
4. **Email de renovação para conta que a mãe lê** (não conta criada só pra isso) + dev secundário
5. **Monitor externo:** UptimeRobot detecta queda; mas o domínio expirado pode demorar dias pra propagar — calendar manual é o backup

**Fase recomendada:** Junto com compra do domínio. Documentar.

---

### Pitfall 3.5: Disco da VPS lota com fotos sem ninguém perceber

**Severidade:** IMPORTANTE → CRÍTICO conforme cresce

**O que sai errado:**
Mãe sobe foto de bolo do celular. Foto é JPEG 4032×3024 = 5MB. 200 produtos × 4 fotos cada × 5MB = 4GB. Add backup local + logs + Postgres + cache do `.next` = VPS de 50GB no plano básico do Hostinger lota. Postgres não consegue escrever em transação. Site cai.

**Por que acontece:**
1. Upload aceita arquivo grande sem reprocessar
2. Next.js `Image` otimiza no fly mas guarda variantes em `.next/cache/images` (cresce indefinido sem TTL configurado)
3. Logs do app rotativos? Logs do Postgres rotativos?
4. Backup local antigo nunca limpo

**Sinal de alerta:**
- `df -h` mostra > 80% do disco
- Postgres logs com `could not extend file` ou `out of disk space`
- Upload começa a dar timeout

**Prevenção:**
1. **Pipeline de upload obrigatório:**
   - Aceitar arquivo até 10MB (validar no client + server)
   - Reprocessar com [sharp](https://sharp.pixelplumbing.com): redimensionar para max 1920×1920, converter pra WebP, qualidade 80
   - Salvar 2-3 tamanhos (thumb 400, medium 800, large 1920) — não armazenar original
   - Resultado típico: 5MB → 80-200KB por variante
2. **Cache do Next.js Image controlado:**
   - `next.config.js` com `images.minimumCacheTTL` razoável (ex.: 31 dias)
   - Cron limpa `.next/cache/images` se passar de N GB
3. **Monitoramento de disco:** UptimeRobot/Healthchecks.io checa `/api/health` que retorna `df -h` em JSON; alerta se > 80%
4. **Log rotation:** `logrotate` configurado para Postgres, app, nginx
5. **Backup retention:** retenção definida (7d/4w/12m), cron limpa antigos
6. **Plano de migração para R2:** documentar quando e como (ex.: ao ultrapassar 5GB de fotos). Threshold em monitoramento.

**Fase recomendada:** Pipeline de upload obrigatório desde a primeira feature de fotos. Monitoring antes de v1 produção.

---

### Pitfall 3.6: VPS único = SPOF — sem rate limit, primeiro ataque tira do ar

**Severidade:** CRÍTICO

**O que sai errado:**
Bot scanner descobre `/api/auth/signin`, dispara 10k tentativas/segundo. VPS de 1 vCPU + 2GB RAM consome 100% CPU em segundos. Postgres trava. Site cai. Mãe sem reservas. Pior: não há outra instância, não há failover.

**Por que acontece:**
- IP da VPS publicado em DNS — bots indexam
- Sem rate limit no app
- Sem WAF
- Sem proxy reverso entre internet e VPS

**Sinal de alerta:**
- Logs com burst de requests do mesmo IP
- CPU/memória 100% sem cliente real
- Postgres com muitas conexões idle

**Prevenção:**
1. **Cloudflare Proxy (laranja) sempre habilitado:** IP da VPS NUNCA é exposto. Mudar IP da VPS é trivial pra atacante; Cloudflare força tudo pelo edge deles.
2. **Cloudflare Rate Limiting (free plan tem básico, paid tem granular):** ex.: 5 tentativas/min em `/api/auth/*`, 30 req/min em `/api/reservas`
3. **Cloudflare WAF Managed Rules** (free tier tem básico): bloqueia user agents conhecidos como bot
4. **Firewall na VPS (`ufw`):** porta 80/443 só de IPs da Cloudflare; SSH só do IP do dev (ou via VPN)
5. **App-level rate limit redundante:** [@upstash/ratelimit](https://upstash.com/) ou rate limiter próprio em PostgreSQL — proteção em camadas
6. **Connection pooling no Postgres** ([PgBouncer](https://www.pgbouncer.org/) ou Supabase Pooler): limite de conexões evita exhaustion
7. **Limites de upload, payload size em API routes**

**Fase recomendada:** Antes de v1 ir pra produção. Não é "feature", é higiene básica.

---

## 4. Pitfalls Técnicos — Aplicação

### Pitfall 4.1: Hash de senha errado — bcrypt mal configurado ou pior

**Severidade:** BLOQUEADOR

**O que sai errado:**
Senha guardada em texto plano. Ou em md5/sha256 puro (instantâneo de quebrar). Ou bcrypt com cost factor 4 (década passada — quebrável). Ou — comum em 2026 — desenvolvedor "improvisa" porque não importou lib direito.

**Por que acontece:**
Pressa, copia stackoverflow antigo, ou framework Auth.js v5/NextAuth não configurado corretamente.

**Sinal de alerta:**
- Coluna `password` de `varchar(50)` — bcrypt ocupa 60 chars exatos
- Hash visível no banco que parece curto demais
- Não há campo `password_updated_at`

**Prevenção:**
1. **Usar Auth.js v5 (NextAuth) ou Better Auth:** providers prontos, hashing correto, refresh tokens, session strategy
2. **Se rolar manual:** [argon2id](https://github.com/ranisalt/node-argon2) (preferido em 2026) ou bcrypt com cost ≥ 12
3. **Schema:** `password_hash text not null` (não `varchar(60)` — tipos podem mudar)
4. **Política de senha:** mínimo 8 chars, mas SEM exigir caracteres especiais (NIST 800-63B desencoraja)
5. **Verificação contra HIBP:** opcional, checar [Have I Been Pwned k-anon API](https://haveibeenpwned.com/API/v3#PwnedPasswords) no cadastro
6. **Hash trocado em login:** se senha foi hasheada com cost antigo, rehash transparente no próximo login bem-sucedido (futuro-proof)

**Fase recomendada:** Auth foundation. NUNCA ir pra produção sem ter validado.

---

### Pitfall 4.2: Reset de senha com vulnerabilidades clássicas

**Severidade:** BLOQUEADOR

**O que sai errado:**
- Token de reset previsível (timestamp, sequencial)
- Token sem expiração — atacante invade email antigo, encontra link de reset de 6 meses atrás, ainda funciona
- Token reutilizável — após uso bem-sucedido, ainda válido
- Mensagem de erro vaza email enumeration: "email não cadastrado" vs "senha errada"
- Reset não revoga sessões ativas

**Por que acontece:**
Implementado às pressas, "obviamente" funciona. Mas detalhes de segurança são todos sutis. Ver [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

**Sinal de alerta:**
- Token tem comprimento < 32 chars
- Token não tem `expires_at` no banco
- Token não tem `used_at` (ou flag de consumo)
- Endpoint `/api/auth/forgot` retorna mensagens diferentes para email existente vs não
- Login antigo continua válido após reset

**Prevenção:**
1. **Token criptograficamente seguro:** `crypto.randomBytes(32).toString('hex')` (Node.js) — 64 chars hex
2. **Hash do token no banco:** salva hash, manda raw no email. Vazamento de DB não dá tokens válidos.
3. **Expiração de 30-60 minutos máximo**
4. **Single-use:** após reset bem-sucedido, marca token como `used` e invalida tudo emitido antes
5. **Revogar sessões:** após reset, invalidar todas sessions/refresh tokens do usuário
6. **Mensagem genérica:** "Se este email estiver cadastrado, enviaremos um link"
7. **Rate limit no `/forgot`:** 3 requests/min/IP (Cloudflare) + 5 requests/hora/email (app)
8. **Audit log:** registrar IP que pediu reset, IP que confirmou — diferença = sinal de phishing

**Fase recomendada:** Auth foundation.

---

### Pitfall 4.3: N+1 query no relatório financeiro

**Severidade:** IMPORTANTE → CRÍTICO conforme histórico cresce

**O que sai errado:**
Relatório "lucro do mês" lista 200 reservas. Para cada reserva, busca lote (1 query). Para cada lote, busca produto. Para cada produto, busca custo congelado. Para cada custo, busca ingredientes do lote. Total: 200 + 200 + 200 + 200 + 200×N queries. Relatório que era pra abrir em 1s, abre em 30s. Em 6 meses, 60s. Em 1 ano, timeout.

**Por que acontece:**
ORM permite acessar relação como atributo (`reserva.lote.produto.custo`) — cada acesso vira query. Drizzle e Prisma têm boas APIs pra prevenir, mas dev usa o "easy mode" que esconde N+1.

**Sinal de alerta:**
- Lentidão progressiva no admin financeiro
- Logs do Postgres mostram explosão de queries idênticas exceto WHERE
- `EXPLAIN ANALYZE` da request mostra muitas conexões

**Prevenção:**
1. **Drizzle:** usar `db.query.X.findMany({ with: { y: true, z: true } })` — JOIN único
2. **Prisma:** `include` ou `select` aninhado
3. **Materialized views para relatórios pesados:** view materializada de "lucro por mês" refrescada 1×/dia (cron)
4. **Índices:** verificar com `EXPLAIN ANALYZE` que queries usam index, não seq scan
5. **Pagination:** relatórios > 100 linhas sempre paginados
6. **Teste com volume realista:** seed o banco com 12 meses × 50 reservas/mês × 4 lotes/mês × 6 ingredientes — relatórios devem abrir em < 2s

**Fase recomendada:** Junto com admin financeiro. Teste de carga ANTES de produção.

---

### Pitfall 4.4: CSRF / Server Actions expostas

**Severidade:** CRÍTICO

**O que sai errado:**
Next.js 16 App Router com Server Actions. Action `cancelarReserva(id)` aceita qualquer call. Atacante hospeda site `evil.com` com `<form action="https://docesvalentina.com.br/_actions/cancelar" method="POST">` que submete via JS. Cliente logado abre o site, browser manda cookie da sessão, reserva cancelada.

**Por que acontece:**
Devs assumem que "Server Action é seguro porque é interno". Não é. É um endpoint POST.

**Sinal de alerta:**
- Server Actions sem validação de origem
- Cookies sem `SameSite=Strict` ou `SameSite=Lax`
- Sem CSP no header
- Logs mostram requests POST de origens inesperadas

**Prevenção:**
1. **Cookies de sessão:** `SameSite=Lax` (mínimo) ou `Strict` para auth (Auth.js já faz)
2. **Origin checking:** Next.js 16 já valida `Origin` em Server Actions por padrão; verificar `experimental.serverActions.allowedOrigins` no `next.config.js` lista apenas domínio próprio
3. **CSP header:** `Content-Security-Policy: default-src 'self'; ...`
4. **Validação de input em todo Server Action:** zod/valibot mesmo pra IDs numéricos
5. **Authorization checking dentro da action:** "essa reserva pertence a esse usuário?" — não confiar que o ID veio do front
6. **Audit log:** ação destrutiva (cancelar, deletar) registra `actor_id`, `actor_ip`, `target_id`

**Fase recomendada:** Fase Auth + qualquer Server Action.

---

### Pitfall 4.5: Logs sem PII redaction

**Severidade:** IMPORTANTE (LGPD compliance + segurança)

**O que sai errado:**
App loga `console.log("Reserva criada", body)`. `body` tem nome, email, telefone do cliente. Logs vão pro disco da VPS, depois pro backup, depois pro R2. Vazamento de logs = vazamento de PII = incidente LGPD reportável (art. 48: notificar ANPD em 72h).

**Por que acontece:**
Debugging com logs amplos durante dev. Esquece de remover. Lib de logging não tem redaction default.

**Sinal de alerta:**
- `grep -i "email\|telefone\|password" logs/` retorna resultados
- Sentry/log aggregator recebe payload bruto de POST
- Sem documento "o que pode ir pra log"

**Prevenção:**
1. **Logger estruturado** ([pino](https://github.com/pinojs/pino)) com [redact paths](https://github.com/pinojs/pino/blob/main/docs/redaction.md): nunca loga `*.email`, `*.password`, `*.cpf`, `*.phone`
2. **IDs em vez de objetos:** `log.info({ reservaId: x }, "criada")` em vez de `log.info({ reserva })`
3. **Stack trace de erro:** sanitiza antes de subir pro Sentry
4. **Política:** logs retidos 30d (não eternos); rotação automática
5. **Sentry/Log aggregator:** configurar `beforeSend` que redact PII

**Fase recomendada:** Logging foundation, antes de v1 produção.

---

## 5. Pitfalls de Domínio — Pontos, Pré-pedido, Resgate

### Pitfall 5.1: Inflação de pontos — mãe define ratio errado e quebra economia interna

**Severidade:** IMPORTANTE → CRÍTICO

**O que sai errado:**
Mãe configura "1 ponto por R$ 1 reservado". Catálogo de resgate tem brigadeiro a 50 pontos. Cliente reserva R$ 200, ganha 200 pontos, troca por 4 brigadeiros. Margem do brigadeiro é R$ 0,50; resgate "custou" mãe R$ 2 enquanto cliente percebe valor de R$ 12. Ela está pagando para fidelizar mais do que ganha.

Inverso: ratio 1 ponto por R$ 100. Cliente reserva R$ 50, ganha 0,5 ponto. Sistema parece quebrado, ninguém engaja.

**Por que acontece:**
Mãe não tem intuição econômica de "moeda". Ratio precisa ser pensado contra catálogo de resgate + sorteio. Sem simulação, decisão é cega.

**Sinal de alerta:**
- Saldo de pontos da clientela cresce monotonicamente sem ser gasto
- Resgates em produtos baratos esgotam estoque
- Mãe relata "tô dando muito doce de graça"
- Ratio de "pontos creditados / pontos resgatados" desbalanceado

**Prevenção:**
1. **Default conservador:** 1 ponto = R$ 1, mas resgate calibrado: brigadeiro custa pelo menos 3× sua margem em pontos. Ex.: brigadeiro de R$ 4 com margem R$ 1.50 → custa pelo menos 5 pontos = R$ 5 reservado. Cliente percebe valor de R$ 4 mas mãe gastou R$ 1.50 de margem para receber R$ 5 reservado.
2. **Simulador no admin:** ao alterar ratio, mostrar "pelos seus últimos 30 dias, isso teria custado R$ X em produtos resgatados vs R$ Y de receita gerada"
3. **Cap de pontos por reserva:** "máximo 100 pontos por reserva" — evita compra exagerada virar farm
4. **Expiração de pontos:** pontos expiram em 12 meses se não usados — força uso e impede acúmulo (declarar nos termos!)
5. **Catálogo de resgate revisado mensalmente:** rotina admin com alerta "produto X foi resgatado N vezes este mês"
6. **Sorteio com custo controlado:** prêmio do sorteio precisa ter custo ≤ pontos arrecadados pra rolar (UI mostra "custo total dos ingressos vs valor do prêmio" antes de abrir)

**Fase recomendada:** Junto com sistema de pontos. Simulador é diferencial competitivo do produto.

---

### Pitfall 5.2: Anti-farm não funciona — cliente cria conta nova a cada reserva

**Severidade:** IMPORTANTE

**O que sai errado:**
Sistema dá pontos somente após confirmação manual da mãe (anti-farm OK pra reserva-some). Mas cliente cria 5 contas, faz 5 reservas pequenas, retira todas, ganha 5× pontos de bônus de cadastro (se houver). Ou: mesma família com 4 emails diferentes acumula pontos de forma desigual.

**Por que acontece:**
Email-uniqueness é a única chave. Telefone pode repetir, endereço pode repetir.

**Sinal de alerta:**
- Múltiplas contas com mesmo telefone
- Endereços repetidos no histórico de retirada (não tem na v1, mas atenção pra v2)
- Reservas de R$ baixo concentradas em contas novas

**Prevenção:**
1. **Sem bônus de cadastro:** simplificar v1 — pontos só por R$ reservado. Remove vetor de farm.
2. **Telefone único** (com normalização: remove formatação): mesmo telefone = pode reservar mas não acumula bônus extras
3. **Confirmação manual da mãe é gate ÚLTIMO:** se ela vê "esse cliente é o filho da Dona Maria" reconhece e age. Sistema deve facilitar — mostrar "telefone já usado em N contas" como warning na confirmação
4. **Sem referral de pontos na v1** (mencionado no PROJECT.md como anti-feature implícita)

**Fase recomendada:** Junto com pontos.

---

### Pitfall 5.3: Sorteio com regras complexas que ninguém entende

**Severidade:** BOM-DE-SABER → IMPORTANTE se virar problema

**O que sai errado:**
Mãe abre sorteio: "20 pontos por chance, máximo 5 chances/cliente, ponderado por quantidade comprada nos últimos 30 dias, com bônus de 2x se cliente fiel há mais de 6 meses". Lei das Loterias (Lei 5.768/71) regulamenta sorteios — sorteio com pagamento (mesmo que em pontos comprados com dinheiro) pode ser interpretado como rifa não autorizada. SEFAZ pode questionar.

**Por que acontece:**
Mãe quer "premiar mais quem é mais cliente". Sistema aceita parametrização. Acaba virando jogo.

**Sinal de alerta:**
- UI de sorteio com mais de 3 parâmetros de ponderação
- Mãe perguntando "como faço pra essa cliente ganhar mais chance"
- Termos de uso não cobrem o sorteio

**Prevenção:**
1. **Sorteio simples na v1:** custo fixo em pontos por chance, sem ponderação, sem cap (ou cap simples), prêmio único
2. **Termos do sorteio:** declarar "sorteio entre clientes que trocaram pontos voluntariamente — não há venda direta de chances"
3. **Mecanismo aleatório auditável:** registrar `random_seed`, `participants_snapshot`, `winner_id`, `drawn_at`. Em caso de questionamento, conseguir mostrar como foi sorteado.
4. **Sem dinheiro real envolvido:** chance = pontos. Pontos não podem ser comprados diretamente (só ganhos por reserva). Garante que sorteio é "entre clientes" não "rifa paga".
5. **Documentação de "como funciona" visível pro cliente:** página explicando regras antes de troca de pontos por chance

**Fase recomendada:** Junto com sorteio.

---

### Pitfall 5.4: Cliente reserva e some — mãe produziu, ficou encalhado

**Severidade:** CRÍTICO (operacional — impacta caixa)

**O que sai errado:**
Cliente reserva 20 brigadeiros pra festa de domingo. Mãe acorda 5h, faz a fornada. Cliente não aparece. Mãe não tem como cobrar. Brigadeiro vence em 4 dias.

**Por que acontece:**
- Reserva sem qualquer compromisso financeiro
- Cliente não vê consequência ao fazer no-show
- Mãe não tem proteção

**Sinal de alerta:**
- Taxa de no-show > 10% das reservas confirmadas
- Reservas grandes de clientes novos
- Mesmos clientes recorrendo em no-show

**Prevenção:**
1. **Confirmação dupla — mãe pode pedir "sinal" via WhatsApp:** PROJECT.md já decidiu que confirmação é manual via WhatsApp; a mãe pode pedir Pix de R$ X pra confirmar pedido grande. Site não rastreia o sinal — é negócio dela.
2. **Histórico de no-show visível na confirmação:** quando reserva entra, painel da mãe mostra "Cliente X: 3 reservas anteriores, 2 confirmadas, 0 no-shows, 1 cancelamento". Mãe decide.
3. **Limite de reservas pendentes:** cliente com no-show prévio fica `restricted` — só 1 reserva pendente até completar uma com sucesso
4. **Comunicação clara:** ao reservar, modal "Reserva é compromisso de retirada. No-show repetido pode bloquear sua conta."
5. **Bloqueio manual:** mãe pode marcar cliente como `bloqueado` no admin. Cliente vê "sua conta está temporariamente restrita, entre em contato".

**Fase recomendada:** Junto com fluxo de reserva. Sinais de fraude/no-show só pegam força se métricas estão lá desde o início.

---

### Pitfall 5.5: Custo congelado calculado errado por bug, e relatório fica mentiroso retroativamente

**Severidade:** CRÍTICO (mãe perde confiança no sistema)

**O que sai errado:**
Bug no cálculo de "custo do lote" usa preço atual do ingrediente em vez da compra específica. Após detectar, ninguém pode corrigir os valores antigos sem reescrever histórico — o que viola a regra de "imutável". Relatório do mês passado fica suspeito.

**Por que acontece:**
Modelo "custo congelado" exige captura no momento exato. Atalho: salvar `ingredient_id` em vez de `purchase_id`. Bug fica latente até alguém perguntar.

**Sinal de alerta:**
- Schema do lote tem FK pra `ingredient` mas não pra `purchase_event`
- Custo histórico do lote muda quando preço corrente do ingrediente muda
- Mãe diz "esse mês deu lucro estranho"

**Prevenção:**
1. **Schema enforça imutabilidade:** `lot_ingredient` tem FK obrigatória pra `purchase_event` (não pra `ingredient`). Trigger Postgres `BEFORE UPDATE` em `purchase_event` que verifica se foi referenciada por algum lote — se sim, bloqueia mudança de preço/quantidade.
2. **Snapshot defensivo na criação do lote:** além da FK, materializar `unit_cost_snapshot numeric(19,6) not null` — derivado mas auditável
3. **Teste de regressão crítico:** "criar lote com compra X de R$ 10/kg → mudar preço corrente do ingrediente pra R$ 20/kg → relatório do lote ainda mostra R$ 10/kg"
4. **Recovery se bug for descoberto:** introduz tabela `lot_cost_correction` (audit + correção em vez de update destrutivo). Relatório histórico mostra original + correção explícita.

**Fase recomendada:** Foundation do modelo de lotes. Teste de regressão é mandatório.

---

## 6. Pitfalls de UX

### Pitfall 6.1: Mãe não acha onde "confirmar reserva"

**Severidade:** CRÍTICO (mãe é a operadora — atrito dela = produto não funciona)

**O que sai errado:**
Painel admin tem 8 abas. "Reservas pendentes" fica na 4ª aba. Mãe abre o app no tablet enquanto cozinha, com mão suja, e não acha. Acaba ignorando o site e operando só por WhatsApp — feature inútil.

**Por que acontece:**
Dev modela admin como CRUD genérico. Não pensa "qual a ação que ela faz 20 vezes por dia".

**Sinal de alerta:**
- Mãe perguntando "onde fica X?"
- Reservas demorando horas pra ser confirmadas
- Tickets de "não consegui usar"

**Prevenção:**
1. **Home do admin = lista de "o que precisa ação agora":** reservas pendentes, lotes prestes a vencer, alertas de margem. Mãe abre, vê, age. Tudo em 1 clique.
2. **Botão "confirmar reserva" gigante**, sem confirmação de "tem certeza?" — fluxo de mão suja precisa ser tap único. Se errou, botão "desfazer" por 30s.
3. **Notificação push web** ou alerta sonoro quando entra reserva (PROJECT.md já diz alerta visual+sonoro)
4. **Validação com a usuária real:** ANTES de fechar v1, sentar com a mãe, dar tarefas ("confirme essa reserva, marque esse cliente como bloqueado"), observar atrito, iterar.

**Fase recomendada:** Fase Admin. UX testing com usuária real é obrigatório.

---

### Pitfall 6.2: Cliente não acha onde reservou ou perdeu o código

**Severidade:** IMPORTANTE

**O que sai errado:**
Cliente reserva, recebe email com "código #1234". Email vai pro spam. 3 dias depois, vai retirar, mãe pergunta "qual seu código?" e cliente não sabe.

**Por que acontece:**
Confiança excessiva no email. Cliente não tem painel próprio (ou tem mas não sabe).

**Sinal de alerta:**
- WhatsApp da mãe entupido de "qual era meu código?"
- Reservas perdidas (mãe não consegue achar pelo nome do cliente)

**Prevenção:**
1. **Cliente NÃO precisa de código:** mãe encontra reserva por nome ou telefone. Código é conveniência opcional.
2. **Painel do cliente acessível:** "/meu-painel" mostra reservas atuais com clareza. Link curto pode ir no WhatsApp pra achar fácil.
3. **Email com layout simples:** assunto "Doces Valentina — reserva 12/05 — código 1234". Texto curto. Botão "ver minhas reservas" que vai pro painel direto.
4. **Recuperação por telefone:** mãe digita telefone → vê todas as reservas daquele número (todos os emails que usaram aquele telefone)
5. **Anti-perda do email:** SMS opcional na v2, mas pra v1 só email + WhatsApp natural

**Fase recomendada:** Junto com painel do cliente.

---

### Pitfall 6.3: Cadastro com email já existente e mensagem confusa

**Severidade:** IMPORTANTE

**O que sai errado:**
Cliente já tem conta (esqueceu). Tenta cadastrar de novo. Sistema diz "email já cadastrado". Cliente entra em pânico, acha que alguém roubou conta dele, cria conta nova com outro email, futuro acumula em 2 contas, perde pontos.

PROJECT.md já endereça isso ("se existe, sistema pede senha; talvez você tenha digitado o email errado") — mas a execução decide se funciona.

**Por que acontece:**
Padrão clássico de form de cadastro. Texto técnico ("email duplicado"). Sem fallback.

**Sinal de alerta:**
- Múltiplas contas por mesmo telefone
- Tickets de "perdi minha conta"

**Prevenção:**
1. **Email-first flow** (PROJECT.md): formulário só pede email. Server checa. Se existe, mostra "Já temos um cadastro com esse email. Pode ser seu? [continuar com login] [esqueci minha senha] [não é meu, tentar outro]"
2. **Mensagem da mãe da pessoa, não de TI:** "Talvez você já tenha cadastro? Vamos descobrir juntos."
3. **Botão "esqueci minha senha"** sempre 1 clique de distância
4. **Suporte por WhatsApp visível:** "ainda não conseguiu? chama no whats: [link]"

**Fase recomendada:** Junto com auth. Validação com usuário real.

---

### Pitfall 6.4: Botão "cancelar" muito acessível

**Severidade:** BOM-DE-SABER

**O que sai errado:**
Cliente abre painel, vê reserva, botão "cancelar" do lado de "ver detalhes". Toca sem querer no celular (telas pequenas). Reserva cancelada por engano.

**Por que acontece:**
UX sem hierarquia. Ações destrutivas misturadas com não-destrutivas.

**Sinal de alerta:**
- Cancelamento + "ué eu não cancelei" no WhatsApp da mãe

**Prevenção:**
1. **Cancelamento atrás de detalhe:** cliente abre reserva → tela de detalhes → botão cancelar embaixo, vermelho, com confirmação
2. **Confirmação modal:** "Tem certeza? Você poderá fazer outra reserva, mas a Valentina já pode ter começado a produzir."
3. **Janela de undo:** após cancelar, banner "Cancelada. [Desfazer]" por 30s
4. **Mobile-first sizing:** botão destrutivo tem espaço mínimo de 60px do botão de ação positiva (Apple HIG / Material guidelines)

**Fase recomendada:** Painel do cliente.

---

### Pitfall 6.5: Mãe esquece de marcar reserva como confirmada — cliente não recebe pontos

**Severidade:** IMPORTANTE (compromete fidelização)

**O que sai errado:**
Mãe entrega doce ao cliente (transação física aconteceu). Esquece de tocar "confirmar" no admin. Cliente não recebe pontos. Cliente reclama. Confiança no sistema cai.

**Por que acontece:**
Operação física e digital não estão acopladas. Sistema espera ação manual que pode esquecer.

**Sinal de alerta:**
- Reservas em status "confirmada pra retirada" mas data já passou (sem pickup OR sem confirmação)
- Reclamações de pontos

**Prevenção:**
1. **Lista de retirada do dia visível na home admin:** "Hoje: 5 retiradas. 2 ainda não marcadas." Lembrete visual constante.
2. **Status "retirado" com 1 tap:** swipe-right no item da lista marca como retirado e credita pontos. Sem dialogs.
3. **Lembrete automático:** se reserva tem data prevista de retirada e está pendente 24h depois, email pra mãe "essa reserva não foi marcada como retirada — foi ou não foi?"
4. **Cliente pode reportar:** botão no painel do cliente "já retirei mas pontos não caíram" → email pra mãe com contexto
5. **Reconciliação periódica:** cron mensal manda pra mãe "no mês passado, X reservas ficaram em limbo (não marcadas como retiradas nem canceladas) — quer fechar?"

**Fase recomendada:** Junto com fluxo de pickup/pontos.

---

## 7. Pitfalls Operacionais (mãe não-técnica)

### Pitfall 7.1: Senha de admin compartilhada / fraca

**Severidade:** CRÍTICO

**O que sai errado:**
Admin único da mãe. Senha "doces2026" anotada num post-it na geladeira. Filho posta foto da geladeira no Instagram. Conta comprometida.

**Por que acontece:**
v1 simplificou pra "admin único" (PROJECT.md decidiu). Sem MFA, qualquer vazamento da senha quebra tudo.

**Prevenção:**
1. **Senha forte obrigatória no setup:** entropia mínima medida com [zxcvbn](https://github.com/dropbox/zxcvbn)
2. **MFA por email com código** na v1 (TOTP é overhead pra mãe). Login pede senha + código que chega no email dela.
3. **Lockout após 5 falhas:** 15min de cooldown
4. **Audit log de login admin:** IP, timestamp. Mostrar na home do admin "último login: ontem 14:23 do IP X. Não foi você? [sair de tudo]"
5. **Helper:** documentar para a mãe "use o gerenciador do celular pra guardar a senha; nunca anote em papel"

**Fase recomendada:** Auth foundation.

---

### Pitfall 7.2: Backup/monitoramento que ninguém vê

**Severidade:** CRÍTICO

(Já coberto em 3.1 e 3.5. Adicionando aqui o ângulo "operadora não-técnica":)

**Prevenção adicional:**
1. **Email semanal "tudo OK"** pra mãe E pro dev: "Backup OK ✓, SSL OK ✓, Disco 35% ✓, Monitoring OK ✓". Ausência do email = problema (dev nota).
2. **Painel "saúde do sistema" no admin:** visualização simples — verde/amarelo/vermelho — sem jargão
3. **Status page externo (UptimeRobot público):** mãe pode verificar antes de mexer

---

### Pitfall 7.3: Falta de plano de "e se o dev sumir"

**Severidade:** IMPORTANTE

**O que sai errado:**
Filho monta o sistema. Algum tempo depois muda de cidade / fica ocupado / pega outro trabalho. Mãe sozinha com problema técnico, sem ninguém pra acionar.

**Por que acontece:**
Greenfield, ninguém pensa em sucessão.

**Prevenção:**
1. **Documentação operacional escrita:** README com "como restartar", "como ver logs", "como fazer deploy" — em PT-BR, com prints
2. **Credenciais em cofre acessível:** Bitwarden free / 1Password compartilhado entre filho + mãe (ou esposo da mãe)
3. **Lista de fornecedores:** Hostinger account, Registro.br account, Cloudflare account, Resend account — todos com email de recovery que a mãe controla
4. **Plano B de hospedagem:** documentar "se Hostinger sumir, restaurar backup em DigitalOcean/Hetzner — passos:..."
5. **Contato de emergência:** dev secundário (amigo dev) ciente do projeto, pago apenas em emergências

**Fase recomendada:** Antes de v1 ir pra produção. Documento `OPERATIONS.md` versionado.

---

## 8. Pitfalls de Scope Creep

### Pitfall 8.1: Sazonalidade visual virando engine de templates

**Severidade:** IMPORTANTE (consome roadmap inteiro)

**O que sai errado:**
PROJECT.md diz "campanhas/temporadas com banner próprio e paleta visual customizada (Páscoa, Dia das Mães, Natal)". Cresce pra "sistema de temas dinâmicos com editor WYSIWYG, preview, schedule, A/B testing por região".

**Prevenção:**
1. **v1 hardcoded:** 4-5 temporadas pré-definidas no código (`SEASONS = ['pascoa', 'maes', 'junina', 'natal']`). Cada uma tem 1 banner + paleta de 3 cores. Mãe upa banner e escolhe paleta de presets. Fim.
2. **Editor de tema só na v3+:** quando escala demandar
3. **Linha vermelha:** rejeitar PRs que adicionem campos de "configuração de tema" além do mínimo

**Fase recomendada:** Scope check em cada fase. PR review tem checklist "isso é v1 ou está crescendo?"

---

### Pitfall 8.2: Catálogo de resgate virando segunda loja

**Severidade:** IMPORTANTE

**O que sai errado:**
"Resgate" começa com 5 produtos da própria mãe. Vira "marketplace de parceiros — academia local oferece aula como prêmio, padaria oferece pão, pizzaria oferece desconto". Complexidade explode.

**Prevenção:**
1. **Resgate v1 = subset dos próprios produtos da mãe.** Nada de parceiros.
2. **Documentar em "Out of Scope" expandido:** parceiros, marketplace, comissão = v3+
3. **Mãe pode tentar querer:** explicar trade-off. Sistema simples + foco em vender mais doce > sistema complexo de fidelização externa.

---

### Pitfall 8.3: Sorteios com regras complexas (já coberto em 5.3, mas reforçando)

**Severidade:** IMPORTANTE

**Prevenção (resumo):**
- v1 = sorteio simples, custo fixo de pontos por chance, prêmio único, sem ponderação
- Adições futuras precisam de aval explícito (re-research)

---

## Technical Debt Patterns — Atalhos aceitáveis vs perigosos

| Atalho | Benefício imediato | Custo a longo prazo | Quando aceitável |
|---|---|---|---|
| Skip de testes E2E completos na v1 | Ship 30% mais rápido | Bug em produção custa caro | OK pra v1 SE tem smoke tests cobrindo fluxo crítico (reservar → confirmar → ganhar pontos) |
| Foto sem CDN (servida pela VPS) | Setup mais simples | Bandwidth + lentidão fora do bairro | OK até ~5GB de fotos / 50 produtos. Migrar pra R2 antes |
| Sem queue de jobs (envio de email síncrono) | Menos infra | Resend lento → resposta lenta pro cliente | OK na v1 com timeout < 5s; queue obrigatória se > 100 emails/hora |
| Logs em arquivo local (sem agregador) | Custo zero | Difícil debug remoto | OK na v1; adicionar Logtail/BetterStack quando >5 incidentes/mês |
| Single PostgreSQL sem replica | Custo previsível | Falha = downtime; restore demorado | OK até negócio depender em receita; v2 = replica leitura |
| Admin único (sem permissões granulares) | Simplifica auth | Não escala | OK na v1 conforme PROJECT.md |
| Sem CI rodando automaticamente | Setup zero | Regressões escapam | NUNCA aceitável — GitHub Actions free é grátis |
| Migração de schema sem `down` | Codifica mais rápido | Rollback impossível | NUNCA aceitável em produção |
| Cron de backup sem verificação de restore | Resolve "tarefa" | Backup que não restaura = nenhum backup | NUNCA aceitável |
| Senha do admin sem MFA | UX simples | Vetor de ataque trivial | NUNCA — MFA por email é grátis e leve |

---

## Integration Gotchas — Erros comuns ao integrar serviços externos

| Integração | Erro comum | Abordagem correta |
|---|---|---|
| Resend | DMARC `p=none` em produção (default Resend) | Subir pra `p=quarantine` após 2 sem de monitoring; configurar `rua` |
| Resend | From inconsistente entre tipos de email | Sempre `oi@docesvalentina.com.br`; reply-to válido |
| Cloudflare proxy | IP da VPS exposto em DNS de subdomínios | Todos subdomínios proxy laranja, MX apontando pro Resend (não pro IP da VPS) |
| Cloudflare proxy | Headers de IP do cliente em vez de Cloudflare-edge | Confiar em `CF-Connecting-IP`; ler com middleware Next.js |
| Hostinger VPS | `iptables` zerado no reboot | Persistir com `iptables-persistent` ou usar `ufw` (default no Ubuntu) |
| Postgres | `timezone` default do servidor difere de `timezone` do client | Setar `timezone = 'America/Sao_Paulo'` em `postgresql.conf` E TZ env do app |
| Cloudflare R2 | Credenciais commitadas no repo | `.env` no servidor; rotação anual; CI usa secret separado |
| Let's Encrypt | Renew falha silenciosamente | Cron com email-on-failure; monitor externo SSL expiration |
| Registro.br | Email de aviso vai pra inbox que ninguém abre | Calendar reminder externo + auto-renew se possível + email pra dev secundário |
| Next.js Image | Carregar imagem sem `width`/`height` (CLS, fetch lento) | Sempre com dimensions, ou `fill` com container dimensionado |

---

## Performance Traps

| Trap | Sintomas | Prevenção | Quando quebra |
|---|---|---|---|
| N+1 em relatório financeiro | Admin lento, piora com tempo | `with`/`include` em ORM; materialized view 1×/dia | 3-6 meses de produção |
| Cache do Next.js Image cresce indefinido | Disco lota | TTL configurado; cron de cleanup | 6-12 meses, depende de variantes |
| Foto original 5MB servida ao cliente mobile | LCP > 4s, dado móvel desperdiçado | Pipeline de upload com sharp obrigatório | Imediato |
| Connection pool exausto em pico | Timeouts intermitentes | PgBouncer ou pool no app com cap (ex.: 20) | Festa de fim de ano (sazonalidade) |
| Sem índice em `reservation.client_id`, `reservation.lot_id`, `reservation.status` | Queries de admin lentas | Indexar FKs e filtros frequentes desde dia 1 | 1-3 meses |
| Server Action que itera lista grande (sem paginação) | Timeout do request, OOM no node | Streaming/pagination obrigatórios | Quando relatório anual existe |
| Sem cache em página de catálogo | Postgres queimado em pico | ISR ou React `cache()` para dados estáveis | Sazonalidade |

---

## Security Mistakes — específicos do domínio

| Erro | Risco | Prevenção |
|---|---|---|
| Pontos descritos em GET endpoint sem auth | Atacante enumera saldo de qualquer cliente | Endpoints de leitura também precisam de session |
| ID sequencial de reserva (1, 2, 3...) | IDOR — atacante incrementa ID, vê reservas alheias | UUID v7 ou ulid (mantém ordem mas não enumerável); authorization checking sempre |
| Webhook do Resend (bounces) sem assinatura validada | Atacante "marca" emails como bounce, deslogando contas | Validar HMAC do header `Resend-Signature` |
| Endpoint de cancelar reserva aceita ID via query string | CSRF via link malicioso | POST com Server Action; validação de origem; confirmação interativa |
| Credito de pontos em endpoint exposto | Inflar saldo via replay | Crédito acontece SOMENTE em transação interna do server, disparada pela mãe — nunca via API que cliente possa chamar |
| Foto de produto upload sem MIME validation | Upload de PHP/binário malicioso | Validar magic bytes, não extensão; sharp processa = se não for imagem, falha |
| Resgate sem validação de saldo no server | Cliente manipula form pra resgatar com saldo negativo | Validar e debitar dentro de transação `FOR UPDATE` |
| Termos aceitos não versionados | Não dá pra provar qual versão cliente aceitou | `terms_version` + `accepted_at` no aceite |

---

## UX Pitfalls — específicos

| Pitfall | Impacto no usuário | Abordagem melhor |
|---|---|---|
| Dashboard admin como CRUD genérico | Mãe perde 30s/reserva pra achar onde confirmar | Home = "ações pendentes", não navegação |
| Confirmação de cancelamento técnica | "Are you sure?" sem contexto | "A Valentina pode já estar produzindo. Cancelar mesmo assim?" |
| Email transacional com layout complexo | Foto 1MB no email, lento no celular | Texto simples + 1 botão pra abrir painel |
| Validade exibida sem destaque | Cliente não vê e reclama depois | Card de produto destaca "vence em N dias" com cor (amarelo se < 3 dias) |
| Saldo de pontos sem contexto | "Você tem 47 pontos" sem saber o que dá pra fazer | "Você tem 47 pontos = 1 brigadeiro grátis OU 4 chances no sorteio" |
| Form de cadastro tudo de uma vez | Telas pequenas, longas, abandono | Email-first decision (PROJECT.md), depois dados |
| Erro de form em vermelho gritante sem ajuda | Usuária não-técnica trava | Erro com sugestão acionável: "Telefone tem 11 dígitos com DDD" |
| "Loading..." sem skeleton | Tela branca, parece quebrado | Skeleton ou progressive loading |

---

## "Looks Done But Isn't" Checklist

Verificações antes de declarar uma feature pronta:

### Reservas
- [ ] **Reserva**: Verificou que estoque não fica negativo em concorrência? (teste com 10 reservas paralelas)
- [ ] **Reserva**: Email do cliente E email da mãe disparam e chegam? (testar com Gmail, Outlook, Yahoo)
- [ ] **Reserva**: Cancelamento dentro da janela funciona? Fora da janela é bloqueado?
- [ ] **Reserva**: Cancelamento estorna corretamente o estoque do lote?

### Pontos
- [ ] **Pontos**: Crédito acontece SOMENTE após mãe marcar como retirado?
- [ ] **Pontos**: Saldo nunca pode ficar negativo? (constraint CHECK + validação)
- [ ] **Pontos**: Resgate em transação atômica (debita E reserva, ou rollback)
- [ ] **Pontos**: Histórico de pontos mostra origem clara ("ganho na reserva #123" / "gasto no resgate de X")

### Lotes & Validade
- [ ] **Validade**: Timezone correto entre admin (input), banco (storage), vitrine (display)?
- [ ] **Validade**: Lote vencido sai automaticamente da vitrine? (cron de hora em hora)
- [ ] **Custo congelado**: lote referencia `purchase_event` específico, não `ingredient`?
- [ ] **Custo congelado**: trigger ou constraint impede update destrutivo de purchase_event referenciada?

### Auth
- [ ] **Auth**: Hash de senha é argon2id ou bcrypt cost ≥ 12?
- [ ] **Auth**: Reset de senha tem token single-use, expiração 30-60min, hash do token no DB?
- [ ] **Auth**: Rate limit em login e em forgot-password?
- [ ] **Auth**: Reset de senha invalida sessões antigas?
- [ ] **Auth**: Admin tem MFA (mesmo que via email)?

### LGPD
- [ ] **LGPD**: Cliente consegue exportar dados? (rota + UI)
- [ ] **LGPD**: Cliente consegue solicitar exclusão? (rota + UI + processo)
- [ ] **LGPD**: Aceite de termos e privacidade está versionado e datado?
- [ ] **LGPD**: Logs não vazam PII?

### Infra
- [ ] **Backup**: pg_dump + upload + verificação + drill mensal? Drill foi feito 1×?
- [ ] **SSL**: Renovação automática validada (forçar renew uma vez)?
- [ ] **Domínio**: Renovado por pelo menos 2 anos?
- [ ] **Cloudflare**: Proxy laranja em todos os registros A?
- [ ] **Email**: SPF, DKIM, DMARC configurados? DMARC `p=quarantine` ou `reject`?
- [ ] **Monitoring**: SSL, uptime, disco, backup — todos com alerta externo?

### UX
- [ ] **Admin home**: prioriza "ações pendentes" sobre navegação genérica?
- [ ] **Mobile-first**: testado em celular real (não só DevTools)? Mãe testou?
- [ ] **Cliente sem código**: mãe consegue achar reserva por nome/telefone?
- [ ] **Cancelamento**: tem janela de undo de 30s?

---

## Recovery Strategies — quando o pitfall acontece

| Pitfall | Custo de recuperação | Passos |
|---|---|---|
| Backup não restaura | CATASTRÓFICO | Há backup mais antigo? Há réplica do client? Logs do Postgres? Rebuild manual última hora |
| Pontos inflados (ratio errado) | MÉDIO | Anunciar mudança com aviso prévio (30d). Não estornar pontos já dados. Recalibrar dali em diante. |
| Vazamento de dados | ALTO (legal + reputação) | Notificar ANPD em 72h. Notificar afetados. Forçar reset de senha de todos. Auditoria forense. |
| SSL expirou | BAIXO | Forçar renew (`certbot renew --force`); restartar nginx/caddy; investigar por que automação falhou |
| Domínio expirou | ALTO se em retenção | Restaurar pagando taxa premium; se foi a leilão, comprar de volta ou trocar |
| Lote com bug de custo histórico | MÉDIO-ALTO | Tabela `lot_cost_correction` com correção; relatórios mostram "v1 incorreto, v2 corrigido" |
| Email indo pra spam | MÉDIO | Pausar envios em massa; revisar SPF/DKIM/DMARC; warm-up; mensagens texto/plain |
| VPS comprometida | ALTO | Snapshot off, criar VPS nova, restaurar do backup verificado, rotacionar todas credenciais |
| N+1 em relatório | BAIXO-MÉDIO | Materialized view + refresh agendado; index apropriado; pagination |
| No-show recorrente de cliente | BAIXO | Marcar `restricted` no admin; políticas claras nos termos |

---

## Pitfall-to-Phase Mapping (input direto pro roadmap)

Tabela consolidada — para cada pitfall, em qual fase deve ser endereçado e como verificar.

| Pitfall | Severidade | Fase recomendada | Verificação |
|---|---|---|---|
| 1.1 LGPD menores | CRÍTICO | Auth & Identidade | Checkbox "+18" no cadastro + termos cobrem |
| 1.2 LGPD export/exclusão | CRÍTICO | Antes de v1 produção | Rotas de export + delete funcionando + processo manual documentado |
| 1.3 LGPD política descritiva | IMPORTANTE | Antes de v1 produção | Política versionada + Resend/Cloudflare mencionados |
| 1.4 ANVISA alegações de saúde | IMPORTANTE | Catálogo | Linter de palavras + guia na UI |
| 1.5 Validade imutável | CRÍTICO | Lotes & Reservas | Constraint impede edit após reserva ativa |
| 1.6 Cancelamento e prejuízo | IMPORTANTE | Lotes & Reservas | Janela configurável + tracking de no-show |
| 2.1 Float vs NUMERIC | BLOQUEADOR | Foundation/Schema | Toda coluna $ é numeric ou bigint cents |
| 2.2 Timezone bugs | CRÍTICO | Foundation + qualquer feature de data | Test suite passa com TZ=UTC e America/Sao_Paulo |
| 2.3 Race condition estoque | CRÍTICO | Lotes & Reservas | Stress test 10 reservas paralelas, exatamente 1 vence |
| 2.4 Migrations dolorosas | IMPORTANTE | Foundation | Drizzle/Prisma com versioning + drill de migration em staging |
| 3.1 Backup que não restaura | BLOQUEADOR | Antes de v1 produção | Drill executado 1× com sucesso documentado |
| 3.2 Email deliverability | CRÍTICO | Antes de v1 produção | DMARC `p=quarantine`, deliverability score Resend > 95% |
| 3.3 SSL expirando | CRÍTICO | Foundation/Infra | Force renew bem-sucedido + monitor externo configurado |
| 3.4 Domínio expirando | CATASTRÓFICO | Compra do domínio | Renovado 5 anos + auto-renew + calendar reminder |
| 3.5 Disco da VPS lota | IMPORTANTE → CRÍTICO | Foundation + features de upload | Pipeline sharp + monitoring de disco |
| 3.6 SPOF / DDoS na VPS | CRÍTICO | Antes de v1 produção | Cloudflare proxy + rate limit + UFW configurados |
| 4.1 Hash de senha | BLOQUEADOR | Auth | Auth.js v5 ou argon2id + cost factor verificado |
| 4.2 Reset de senha vulnerável | BLOQUEADOR | Auth | Token single-use + expiração + sessions revogadas |
| 4.3 N+1 financeiro | IMPORTANTE | Admin Financeiro | Seed com volume realista + EXPLAIN ANALYZE em queries críticas |
| 4.4 CSRF / Server Actions | CRÍTICO | Foundation + cada Server Action | `allowedOrigins` configurado, CSP no header |
| 4.5 Logs com PII | IMPORTANTE | Logging foundation | pino com redact + revisão de logs antes de produção |
| 5.1 Inflação de pontos | IMPORTANTE → CRÍTICO | Sistema de Pontos | Simulador no admin + cap por reserva + expiração |
| 5.2 Anti-farm | IMPORTANTE | Sistema de Pontos | Sem bônus de cadastro v1 + warning de telefone repetido |
| 5.3 Sorteio complexo | BOM-DE-SABER → IMPORTANTE | Sorteios | v1 simples documentado + termos claros |
| 5.4 No-show de cliente | CRÍTICO | Reservas | Histórico de no-show visível + bloqueio manual |
| 5.5 Custo congelado bug | CRÍTICO | Lotes & Custo Histórico | Test de regressão + FK pra purchase_event não ingredient |
| 6.1 Mãe perdida no admin | CRÍTICO | Admin foundation | UX testing presencial com a mãe ANTES de v1 |
| 6.2 Cliente perde código | IMPORTANTE | Painel cliente | Painel próprio funcional + busca por telefone no admin |
| 6.3 Email duplicado confuso | IMPORTANTE | Auth | Email-first flow + texto humano testado |
| 6.4 Cancelamento acidental | BOM-DE-SABER | Painel cliente | Confirm modal + janela de undo |
| 6.5 Mãe esquece confirmar | IMPORTANTE | Reservas + Pontos | Lista de retiradas do dia + lembrete automático |
| 7.1 Senha admin fraca | CRÍTICO | Auth | MFA por email + zxcvbn no setup |
| 7.2 Backup invisível | CRÍTICO | Antes de v1 produção | Email semanal de saúde + status page |
| 7.3 Bus factor 1 | IMPORTANTE | Antes de v1 produção | OPERATIONS.md + cofre de credenciais + dev secundário ciente |
| 8.1 Sazonalidade scope creep | IMPORTANTE | Cada fase (review) | PR review checklist "isso é v1 ou crescimento?" |
| 8.2 Resgate vira marketplace | IMPORTANTE | Cada fase (review) | Out of Scope expandido com parceiros |
| 8.3 Sorteio complexo (resumo) | IMPORTANTE | Cada fase (review) | Re-research obrigatório se evoluir |

---

## Sources

**Legal e Regulatório:**
- [LGPD e segurança de dados no e-commerce (E-Commerce Brasil)](https://www.ecommercebrasil.com.br/artigos/lgpd-e-seguranca-de-dados-dentro-do-e-commerce)
- [LGPD: dados sensíveis (Serpro)](https://www.serpro.gov.br/lgpd/menu/protecao-de-dados/dados-sensiveis-lgpd)
- [Procon-SP cartilha LGPD](https://www.procon.sp.gov.br/procon-sp-lanca-video-cartilha-lgpd-relacoes-consumo-orientar-consumidores/)
- [Sebrae — LGPD para empresas](https://sebrae.com.br/sites/PortalSebrae/artigos/lgpd-exige-adequacoes-de-empresas-a-dados-de-clientes-veja-o-que-muda,fe51f2520da54710VgnVCM1000004c00210aRCRD)
- [ANVISA RDC nº 727/2022 — Rotulagem](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000727&seqAto=002&valorAno=2022&orgao=RDC/DC/ANVISA/MS&codTipo=&desItem=&desItemFim=&cod_menu=1696&cod_modulo=134&pesquisa=true)
- [ANVISA RDC nº 429/2020 — Rotulagem nutricional](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RDC&numeroAto=00000429&seqAto=000&valorAno=2020&orgao=RDC/DC/ANVISA/MS&codTipo=&desItem=&desItemFim=&cod_menu=1696&cod_modulo=134&pesquisa=true)
- [Anvisa — Isenção de Registro](http://portal.anvisa.gov.br/en/registros-e-autorizacoes/alimentos/produtos/isencao-de-registro)
- [Rotulagem Nutricional Artesanal (Mundo Food Service)](https://mundofoodservice.com.br/rotulagem-nutricional-quando-o-produto-e-artesanal-mas-a-responsabilidade-e-profissional/)

**Email e Deliverability:**
- [Resend — Implementing DMARC (oficial)](https://resend.com/docs/dashboard/domains/dmarc)
- [Resend — Email Authentication Guide](https://resend.com/blog/email-authentication-a-developers-guide)
- [Resend SPF, DKIM, DMARC step-by-step (DmarcDkim.com)](https://dmarcdkim.com/setup/how-to-setup-resend-spf-dkim-and-dmarc-records)
- [DMARC Wiki — Resend setup](https://dmarc.wiki/resend)

**Backup & Disaster Recovery:**
- [How to Test PostgreSQL Backup Restoration (oneuptime)](https://oneuptime.com/blog/post/2026-01-21-postgresql-backup-testing/view)
- [PostgreSQL backup verification (DEV)](https://dev.to/piteradyson/postgresql-backup-verification-how-to-test-and-validate-your-postgresql-backups-2al8)
- [PostgreSQL Backup Best Practices (Stormatics)](https://stormatics.tech/blogs/postgresql-backup-best-practices)
- [Database Backups & Disaster Recovery (Tiger Data)](https://www.tigerdata.com/blog/database-backups-and-disaster-recovery-in-postgresql-your-questions-answered)

**PostgreSQL Patterns:**
- [PostgreSQL Date/Time Types (oficial)](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [PostgreSQL Numeric Types (oficial)](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [PostgreSQL Monetary Types (oficial)](https://www.postgresql.org/docs/current/datatype-money.html)
- [Pessimistic vs Optimistic Locking in PostgreSQL](https://samowolabi.substack.com/p/optimistic-vs-pessimistic-locking)
- [Handling Race Conditions in PostgreSQL MVCC (Bufisa)](https://bufisa.com/2025/07/17/handling-race-conditions-in-postgresql-mvcc/)
- [Working with Money in Postgres (Crunchy Data)](https://www.crunchydata.com/blog/working-with-money-in-postgres)
- [API with NestJS — Money with Drizzle ORM and PostgreSQL](https://wanago.io/2024/11/04/api-nestjs-drizzle-orm-postgresql-money/)
- [TypeScript+Drizzle+PostgreSQL Time Zones Guide (DEV)](https://dev.to/jacksonkasi/the-developers-guide-to-never-messing-up-time-zones-again-a-typescript-drizzle-and-postgresql-4970)

**Auth e Security:**
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Password Reset Vulnerabilities (Vaadata)](https://www.vaadata.com/blog/exploring-password-reset-vulnerabilities-and-security-best-practices/)
- [Password Reset Best Practices (Authgear)](https://www.authgear.com/post/authentication-security-password-reset-best-practices-and-more)
- [A Security Analysis of Email-Based Password Reset (DIMVA 2021)](https://seclab.nu/static/publications/dimva2021youvegotmail.pdf)

**Infra e VPS:**
- [Cloudflare DDoS Protection (oficial)](https://developers.cloudflare.com/ddos-protection/)
- [Cloudflare Rate Limiting (oficial)](https://www.cloudflare.com/application-services/products/rate-limiting/)
- [Let's Encrypt auto-renewal cron setup (Baeldung)](https://www.baeldung.com/linux/letsencrypt-renew-ssl-certificate-automatically)
- [Next.js Image — install sharp (oficial)](https://nextjs.org/docs/messages/install-sharp)
- [Next.js Image Optimization Guide (Strapi blog)](https://strapi.io/blog/nextjs-image-optimization-developers-guide)

**Loyalty / Pontos:**
- [Loyalty Fraud Prevention (Open Loyalty)](https://www.openloyalty.io/insider/loyalty-fraud)
- [Loyalty Program Fraud Prevention (LP Solutions)](https://lpsolutions.com/loyalty-fraud-impact-defense-and-prevention/)
- [Fraud Detection in Loyalty Programs (Antavo)](https://antavo.com/blog/fraud-detection-in-loyalty-programs/)
- [Protecting Loyalty Point Programs (F5)](https://www.f5.com/company/blog/protecting-loyalty-point-programs-fraud-5-key-tips)

**Confiança das fontes:** HIGH para legal/regulatório (fontes oficiais ANVISA, Procon, Serpro, Sebrae); HIGH para PostgreSQL (docs oficiais); HIGH para Resend (docs oficiais); HIGH para OWASP. MEDIUM para padrões de loyalty (artigos de empresas de prevenção a fraude — interesse comercial, mas alinhados entre si). MEDIUM para Cloudflare (docs oficiais mas voltadas a venda de plano paid).

---
*Pitfalls research for: Doces Valentina (reserva online + gestão de doces artesanais)*
*Researched: 2026-04-29*
