# Research Synthesis — Doces Valentina

**Project:** Doces Valentina — reserva online de doces caseiros (sem checkout) com fidelização por pontos, sorteios, resgate e admin completo de pricing/financeiro com tracking de marca.
**Researched:** 2026-04-29
**Confidence:** HIGH para stack/architecture (verificados em docs oficiais Next.js 16 + npm + ANPD/ANVISA); MEDIUM-HIGH para features/pitfalls (cruza padrões de mercado consolidados com inferência sobre operadora não-técnica).
**Scope deste documento:** sintetizar STACK.md + FEATURES.md + ARCHITECTURE.md + PITFALLS.md em uma fonte única para definição de requirements e roadmap. Não duplica os 4 docs — cruza, prioriza e marca o que precisa decisão.

---

## TL;DR

Pontos críticos cruzando os 4 docs. Uma tela.

1. **Stack mudou em 2 lugares importantes desde o PROJECT.md:** **Better Auth** substitui Lucia (deprecated mar/2025); **Docker Compose direto** substitui Coolify (11 CVEs CVSS 10.0 em jan/2026). Decisões fechadas.
2. **Next.js 16 quebra com training data**: `middleware.ts` virou `proxy.ts`, `cookies()/headers()/params/searchParams` são async, `revalidateTag` exige `cacheLife`, `unstable_cache` foi removido, `next lint` removido. Cada feature precisa abrir `node_modules/next/dist/docs/` antes de codar.
3. **Cinco BLOQUEADORES não-negociáveis antes de v1 ir pra produção:** (a) hash de senha argon2id/bcrypt cost ≥ 12; (b) reset de senha OWASP-compliant (token single-use, hash no DB, expiração, revogação de sessão); (c) backup com drill de restore executado pelo menos 1× e documentado; (d) money em `numeric(19,4)` ou `bigint` centavos — NUNCA float; (e) Cloudflare proxy + rate limit + UFW (a VPS não pode ter IP exposto).
4. **Três gates legais não-negociáveis (LGPD/ANVISA):** (i) cliente pode exportar e excluir dados (rotas + UI funcionando, anonimização em vez de DELETE em cascata); (ii) política de privacidade descreve operadores reais (Resend/Cloudflare/Hostinger), versionada com `terms_version` + `accepted_at`; (iii) descrição de produto sem alegações de saúde (linter de palavras "diet/light/saudável/sem conservantes/imunidade").
5. **PROJECT.md tem 19 features faltando que são piso operacional**, não vaidade. Críticas: lista de separação do dia (#1), observação livre (#2), janela de retirada (#3), `wa.me` com mensagem pré-formatada (#4), estado "retirado" explícito (#5), `/r/<id>` de comprovante (#9), recuperação de senha (#13), alergênicos (#16), endereço com Maps (#17). Sem isso o sistema vira "captador de pedido", não ferramenta.
6. **Modelo de dados tem decisões irreversíveis na fase 0:** `ingrediente_compras` append-only com `qtde_restante`; `lote_uso_ingredientes` denormaliza `marca_snapshot` + `custo_congelado` (NÃO JSON, FK pra **compra específica** não pro ingrediente abstrato); `pontos_transacoes` ledger imutável (saldo derivado por SUM); `delivery_mode` desde v1 com UI escondida; `produtos.tipo` enum (UNITARIO|KIT) na mesma tabela.
7. **Estoque com 2 colunas (`qtde_disponivel` + `qtde_reservada`)**: reserva PENDENTE incrementa `qtde_reservada` (soft hold via `SELECT FOR UPDATE`); confirmação decrementa `qtde_disponivel` e libera `qtde_reservada`; cancelamento só libera. Sem isso, race condition + reserva pendente come estoque que poderia ser vendido.
8. **Email NUNCA dentro de transação SQL.** Resend lento ou caído trava confirmação. Padrão: `TX COMMIT` → enfileirar com pg-boss → worker dispara via Resend. Webhooks Resend (bounces) em Route Handler com validação `svix`.
9. **Background jobs em pg-boss (não BullMQ, não Inngest, não cron + endpoint).** Postgres já existe, `FOR UPDATE SKIP LOCKED` resolve duplicação, `instrumentation.ts` boot do worker no mesmo container. Casos v1: sortear ao expirar; expirar lote vencido (de hora em hora — não 1×/dia — por causa de timezone); lembrete de retirada; retry de email.
10. **Timezone bug é risco de SAÚDE PÚBLICA, não só bug.** Validade em UTC vs BRT pode fazer cliente reservar achando que dá tempo e doce vencer antes da retirada. `timestamptz` em todas colunas, `TZ=America/Sao_Paulo` no app E `timezone='America/Sao_Paulo'` no postgres.conf, `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` no front.
11. **Custo congelado precisa de ENFORCE no schema, não só convenção.** FK `lote_uso_ingredientes.ingrediente_compra_id` (não `ingrediente_id`); trigger `BEFORE UPDATE` em `ingrediente_compras` que bloqueia mudança se referenciada por lote; teste de regressão "muda preço corrente → relatório do lote antigo permanece".
12. **UX da mãe é critério de produção, não polish.** Home admin = lista de "ações pendentes" (não CRUD genérico); botão "confirmar reserva" sem dialog de "tem certeza"; undo de 30s em ações destrutivas; UX testing presencial com a mãe ANTES de v1.
13. **Anti-features confirmadas (18 itens)** — destaque: chat ao vivo, push agressivo, gamificação com badges, cashback monetário, sugestão automática de preço, conta sem cadastro, cupom genérico, marketplace, login social, estrelas públicas, sazonalidade WYSIWYG, bônus de cadastro.
14. **Build order tem dependência hard:** Foundation → Custo de produção → Catálogo → Reserva + pontos → Engagement (resgate/sorteio) → Sazonalidade → Relatórios → Hardening de produção. Custo ANTES de catálogo (produto sem custo é inútil); reserva ANTES de pontos; relatórios POR ÚLTIMO.
15. **Inflação de pontos é risco existencial silencioso.** Mãe define ratio sem intuição → resgates custam mais que receita. Defesas: simulador no admin ("nos últimos 30 dias, esse ratio teria custado R$ X"); cap de pontos por reserva; expiração 12m nos termos.

---

## Stack Final (consolidação prescritiva)

| Camada | Escolha | Versão | Por quê |
|---|---|---|---|
| Framework | Next.js 16 App Router | 16.2.4 | Travado pelo PROJECT.md. Habilitar `reactCompiler: true`. |
| Runtime | React 19.2 + TS 5+ strict | — | Pinned pelo Next 16. |
| ORM | **Prisma 7 ORM + Prisma Migrate + Prisma Studio** | 7.x (latest) | Decisão revisada 2026-04-30 (era Drizzle): DX superior, Studio polido para a mãe inspecionar dados, Prisma 7 removeu Rust query engine (TS puro, mais leve). Better Auth tem adapter Prisma oficial estável. Postgres-only features (`numeric(19,4)`, triggers, CHECK XOR) usam `prisma.$queryRaw` quando necessário. **Atenção:** Prisma 7 tem mudanças vs v6 — consultar docs oficiais e `node_modules/@prisma/client/` antes de codar. |
| Banco | PostgreSQL 16 (`postgres:16-alpine`) | 16+ | Travado. |
| Auth | **Better Auth + adapter Prisma + argon2** | 1.6.9 / 0.44.0 | Lucia deprecated; Auth.js v5 desencoraja sessions DB com credentials; Better Auth tem flow email-first, sessions DB, Next 16-ready. Adapter Prisma oficial. |
| Forms server | `<form action={serverAction}>` + `useActionState` + Zod | Zod 4.3.6 | Padrão oficial Next 16. Progressive enhancement. |
| Forms admin complexos | react-hook-form + @hookform/resolvers + Zod | 7.74.0 / 5.2.2 | Array fields dinâmicos. Mesmo schema cliente+server. |
| Email | Resend + @react-email/components + render + svix | 6.12.2 / 1.0.12 / 2.0.8 | Travado. svix valida webhooks. |
| Imagens v1 | next/image + sharp + Route Handler `/api/img/[...path]` | sharp 0.34.5 | Filesystem local até 5GB. |
| Imagens v2 | + @aws-sdk/client-s3 + presigned URL → R2 | 3.1038.0 | Migrar atrás de interface `StorageProvider`. |
| UI | shadcn/ui CLI 4.6 + Radix + lucide-react + sonner | 4.6.0 | Tailwind v4 + React 19 compatível. |
| Datas pt-BR | date-fns com `locale: ptBR` | 4.1.0 | Tree-shakeable. |
| Background jobs | **pg-boss + instrumentation.ts** | 12.18.1 | Postgres já existe; `FOR UPDATE SKIP LOCKED`; idempotência. |
| Validação env | @t3-oss/env-nextjs + Zod | 0.13.11 | Erro em build, não runtime. |
| Logging | pino + pino-pretty (dev) + redact paths | 10.x | JSON estruturado; sem PII. |
| Deploy | **Docker Compose + `output: 'standalone'`** | — | Coolify NÃO (11 CVEs jan/2026). |
| Reverse proxy + TLS | **Caddy no host** | — | Auto-renew SSL zero-config. |
| Edge / DDoS | **Cloudflare Proxy laranja** | — | IP da VPS NUNCA exposto. |
| Backup | `pg_dump --format=custom` + rclone → R2 + cron host | — | NÃO em pg-boss (precisa rodar mesmo se app cair). |
| Monitoring externo | Better Stack free + `/api/health` | — | Externo é mandatório (monitor na mesma VPS não avisa quando VPS cai). |
| Testes | Vitest para lógica financeira; Playwright depois | — | Custo unitário, margem, sorteio, conversão de pontos = não-negociável testar. |
| Domínio | `.com.br` Registro.br renovado 5 anos + débito automático + calendar reminder externo | — | Email do Registro.br não é confiável. |

---

## Features que precisam entrar em v1 (não estavam em PROJECT.md)

### A. Mandatórias (legal/segurança)

| # | Feature | Pitfall ancora |
|---|---|---|
| #11 | Página "Meus dados" + **botão de exclusão** (anonimização) | 1.2 LGPD CRÍTICO |
| novo | **Botão de exportação** (JSON cadastro+reservas+pontos) | 1.2 LGPD CRÍTICO |
| novo | **Aceite versionado** (`terms_version`, `terms_accepted_at`, `privacy_*`) | 1.2+1.3 LGPD |
| novo | **Checkbox "+18" no cadastro** + termos cobrindo menores | 1.1 LGPD CRÍTICO |
| novo | Política descreve **Resend (EUA)/Cloudflare/Hostinger** + retenção | 1.3 LGPD |
| #12 | **Verificação de email no cadastro** | 6.3 + 4.2 |
| #13 | **Recuperação de senha** OWASP-compliant | 4.2 BLOQUEADOR |
| #16 | **Lista de alergênicos por produto** no card | 1.4 ANVISA |
| novo | **Linter de palavras suspeitas** (saudável/diet/sem conservantes) | 1.4 ANVISA |
| novo | **Validade do lote imutável após primeira reserva** | 1.5 CRÍTICO |
| novo | **MFA por email para admin** | 7.1 CRÍTICO |
| #19 | **Auditoria mínima** (preço/lote/reserva) | 4.4 + LGPD |

### B. Operacionalmente críticas

| # | Feature |
|---|---|
| #1 | Lista de separação do dia agrupada por cliente/horário |
| #2 | Observação livre na reserva |
| #3 | Janela/horário preferencial de retirada |
| #4 | `wa.me` com mensagem pré-formatada |
| #5 | Estados "aguardando retirada" e "retirado" explícitos |
| #7 | Resumo do dia (faturamento + custo + lucro + retiradas pendentes) |
| #8 | Snapshot de estoque agregado com flag de validade |
| #9 | Comprovante acessível (`/r/<id>` ou painel) |
| #10 | Barra de progresso visual de pontos |
| #14 | Mensagens claras: esgotado vs fora de temporada vs 404 |
| #15 | "Vence em X dias" no card |
| #17 | Endereço de retirada com Google Maps + observação de referência |
| #21 | Alerta de preço-piso (custo absoluto) — linha vermelha |
| #30 | Histórico do cliente na tela do pedido |
| novo | **Onboarding guiado** ("1º ingrediente → 1ª receita → 1º lote → 1º produto") |
| novo | **Histórico de no-show visível na confirmação** + bloqueio manual |
| novo | **Simulador de pontos no admin** + cap por reserva + expiração 12m |

### C. Defensáveis adiar (v1.x)

#6 política de no-show automatizada • #18 status de backup visível • #20 sub-receitas • #23 gráfico histórico de preço de ingrediente • #24 custo "sombra" de reposição • #25 referral • #27 bônus de aniversário • #28 winback • #29 "avisem-me quando voltar" • #31 nota interna do admin sobre cliente • #34 promoção automática de lote próximo do vencimento • #35 PWA installable.

---

## Anti-features confirmadas

| # | Anti-feature | Razão |
|---|---|---|
| A1 | Chat ao vivo | Mãe sozinha não mantém. WhatsApp já cumpre. |
| A2 | Push notifications agressivas | Clientela mais velha desinstala. |
| A3 | Gamificação badges/níveis | Loyalty research: complexidade desengaja. |
| A4 | Pontos por engajamento (login diário) | Passivo sem receita correspondente. |
| A5 | Cashback monetário | Vira cost direto; difícil sair sem revolta. |
| A6 | Sugestão automática de preço | PROJECT já recusou; mãe perde sensibilidade. |
| A7 | Múltiplos endereços de entrega | v1 só retirada. |
| A8 | Carrinho persistente longo + checkout multi-step | Reserva é simples; one-page vence. |
| A9 | Conta sem cadastro / "comprar como visitante" | Quebra programa de pontos + cliente conhecido. |
| A10 | Cupons de desconto livre ("PASCOA10") | Clientela de bairro não responde; canibaliza margem. |
| A11 | WhatsApp Business API | Custo + cognitivo. |
| A12 | Marketplace / produtos de terceiros no resgate | Quebra controle de qualidade. |
| A13 | Tradução / multilíngue | pt-BR único. |
| A14 | Integração iFood / Rappi | Quebra modelo; taxa destrói margem. |
| A15 | Login social (Google/Facebook) | Política complexifica; clientela mais velha pode não ter conta. |
| A16 | Estrelas públicas entre clientes | Em clientela íntima vira problema pessoal direto. |
| A17 | Sazonalidade virando engine WYSIWYG | v1 hardcoded: 4-5 temporadas com banner único + paleta presets. |
| A18 | Bônus de pontos por cadastro | Vetor de farm. |

---

## Build Order recomendado

```
FASE 0 — Foundation (infra + schema + auth)
  Entrega: VPS, schema versionado, login mãe + cliente, audit log, email infra
  Pitfalls que afetam:
    BLOQUEADORES: 2.1 float vs numeric, 4.1 hash de senha, 4.2 reset de senha
    CRÍTICOS: 2.2 timezone, 2.4 migrations versionadas, 3.3 SSL, 3.4 domínio,
              3.6 SPOF/DDoS (Cloudflare+UFW+rate limit), 4.4 CSRF, 7.1 senha admin (MFA email)
    IMPORTANTES: 1.1 LGPD menores, 1.3 política descritiva, 4.5 logs sem PII
  Phase research necessária: SIM (Better Auth + Next 16 proxy.ts; Cloudflare config; Prisma 7 expand-then-contract com `prisma migrate`)

FASE 1 — Custo de produção (motor financeiro)
  Entrega: ingredientes, compras (evento imutável), receitas, produtos (mínimo),
           lotes (consome compras → congela custo) + alerta de margem
  Pitfalls:
    BLOQUEADOR: 2.1 float vs numeric (toda coluna $)
    CRÍTICOS: 5.5 custo congelado bug (FK pra ingrediente_compra_id, trigger, teste de regressão)
    IMPORTANTES: 1.4 ANVISA alegações de saúde, 4.3 N+1 desde já
  Phase research necessária: NÃO

FASE 2 — Catálogo público
  Entrega: vitrine, detalhe, fotos (sharp obrigatório), categorias, kits, validade visível
  Pitfalls:
    IMPORTANTE→CRÍTICO: 3.5 disco lota (sharp: max 1920px, WebP, 3 tamanhos, NUNCA original)
    CRÍTICO: 1.5 validade exibida vs impressa (PDF de etiquetas)
    IMPORTANTE: 1.4 alergênicos no card (#16 mandatório)
  Phase research necessária: NÃO

FASE 3 — Reserva e fidelização
  Entrega: reserva com qtde_reservada (soft hold), ledger de pontos, painel cliente
           (#10 progresso), painel admin do dia (#1 + #5), wa.me (#4), histórico do cliente (#30)
  Pitfalls:
    CRÍTICOS: 2.3 race condition estoque, 5.4 no-show, 6.1 mãe perdida no admin (UX testing OBRIGATÓRIO)
    IMPORTANTES: 1.6 cancelamento e prejuízo, 5.1 inflação de pontos (simulador + cap + 12m),
                 5.2 anti-farm, 6.2 cliente perde código, 6.3 email duplicado, 6.5 mãe esquece confirmar
                 BOM-DE-SABER: 6.4 cancelamento acidental
  Phase research necessária: SIM (calibração de janela de cancelamento + ratio de pontos com a mãe)

FASE 4 — Engagement (resgate + sorteio)
  Entrega: catálogo de resgate (XOR via CHECK), resgate (pontos → reserva especial),
           sorteios (abrir/inscrever/sortear), cron sorteio expirado, cron lotes vencidos (de hora em hora)
  Pitfalls:
    IMPORTANTE→CRÍTICO: 5.1 inflação (cap por sorteio), 8.2 resgate vira marketplace
    BOM-DE-SABER→IMPORTANTE: 5.3 sorteio simples (random_seed auditado; termos cobrindo)
  Phase research necessária: SIM (Lei 5.768/71 — zona cinzenta sobre sorteio com pontos não-comprados-direto)

FASE 5 — Sazonalidade visual
  Entrega: campanhas (paleta JSON), CampanhaResolver, banner sazonal + CSS vars
  Pitfalls: 8.1 scope creep (v1 hardcoded; PR review checklist)
  Phase research: NÃO

FASE 6 — Relatórios
  Entrega: faturamento, top produtos, lucro real, análise por marca, sazonalidade no histórico
  Pitfalls: IMPORTANTE→CRÍTICO 4.3 N+1 (Prisma `include`/`select` explícito + materialized view 1×/dia + seed realista + EXPLAIN)
  Phase research: NÃO

FASE 7 — Hardening de produção (gates pré-launch)
  Entrega: backup com drill manual executado 1× + drill mensal automático;
           monitoring (Better Stack + /api/health + email semanal);
           hardening final (Cloudflare granular + UFW); OPERATIONS.md em PT-BR + Bitwarden + dev secundário;
           LGPD final (export + exclusão + termos versionados + checkbox +18 + política descritiva)
  Pitfalls:
    BLOQUEADORES: 3.1 backup que não restaura, 3.2 email deliverability (DMARC quarantine + warm-up)
    CRÍTICOS: 1.2 LGPD export/exclusão, 7.2 backup invisível, 7.3 bus factor 1
    IMPORTANTES: 1.3 LGPD política
  Phase research: SIM (DMARC warm-up + procedimento de drill exigem checklist)
```

**Por que essa ordem:** Custo antes de catálogo (produto sem custo é inútil). Reserva antes de pontos (pontos derivam de reserva confirmada). Engagement antes de sazonalidade (skin cosmético). Relatórios por último (sem dados, engana). Hardening BLOQUEIA launch.

---

## Decisões fechadas vs decisões abertas

| Já travado pela research | Ainda precisa de decisão do user |
|---|---|
| Better Auth (não Lucia/NextAuth) | **Ratio de pontos default** (research: 1pt = R$ 1, brigadeiro custa ≥ 3× margem em pts) — aceitar? |
| Docker Compose direto (não Coolify/Dokploy v1) | **Janela de cancelamento default** (research: 24h) — confirmar? |
| Caddy no host (não Nginx + certbot) | **Threshold de margem para alerta** (PROJECT diz 30%) — confirmar? |
| Prisma 7 + Prisma Migrate (revisado de Drizzle em 2026-04-30) | **Política de retenção** ("5 anos para fins fiscais, depois anonimizado")? |
| pg-boss para jobs | **Expiração de pontos** (research: 12m declarada nos termos)? |
| Cloudflare Proxy laranja em todos os subdomínios | **Onboarding guiado da mãe** entra em v1? (research: SIM) |
| money em `numeric(19,4)` OU `bigint` centavos | **Quem opera o admin nas 2 primeiras semanas — mãe ou filho?** (afeta UX testing) |
| `timestamptz` + TZ=America/Sao_Paulo no app E postgres.conf | **Critério de "v1 pronto pra produção"** — inclui Fase 7? |
| `delivery_mode` enum desde v1 com UI escondida | **Plano B de email** se Resend cair (SendGrid/SES)? Investir? |
| `pontos_transacoes` ledger imutável | **MFA admin**: email-code (recomendado) ou TOTP? |
| `lote_uso_ingredientes` denormaliza marca + custo congelado em colunas tipadas, FK pra `ingrediente_compra_id` | **Hospedagem do Postgres** — mesmo container Compose ou managed Hostinger? |
| `produtos.tipo` enum (UNITARIO\|KIT) | **Frequência de email "extrato de pontos"** (PROJECT: após cada confirmação; research: pode virar PDF v2) |
| `qtde_disponivel` + `qtde_reservada` (soft hold + decremento atômico) | **Linter ANVISA**: alerta visual ou bloqueio? (research: alerta amarelo) |
| Sub-receitas FORA da v1 | **Status "retirado" como swipe-right (1 tap)** — confirmar? |
| Email FORA de transação SQL | **"Dev secundário ciente do projeto"** (Pitfall 7.3) — quem é? Identificar antes de v1? |
| `instrumentation.ts` boot do worker pg-boss | |
| Resgate v1 = só produtos da mãe | |
| Sorteio v1 = simples (custo fixo, sem ponderação, prêmio único, random_seed auditado) | |
| Sazonalidade v1 = 4-5 temporadas hardcoded | |
| Catálogo de resgate XOR (`produto_id` OR `nome_custom`) via CHECK | |
| `audit_log` chamado explicitamente no service | |
| Anti-farm v1 = sem bônus de cadastro + warning de telefone repetido + confirmação manual | |
| Sem login social v1 | |
| Sem WhatsApp Business API v1 (só `wa.me`) | |

---

## Riscos & gates de produção

### 5 BLOQUEADORES antes de v1 ir pra produção

1. **Backup com drill de restore executado 1×** (Pitfall 3.1) — `pg_dump --format=custom` + rclone → R2 + drill manual documentado em OPERATIONS.md.
2. **Hash + reset de senha OWASP-compliant** (Pitfalls 4.1+4.2) — argon2id, token single-use 32-byte, hash no DB, expiração 30-60min, revoga sessões, mensagens genéricas, rate limit.
3. **Money em `numeric(19,4)` OU `bigint` centavos schema-wide** (Pitfall 2.1) — zero `real`/`double`/`float`; lib decimal.js no app; teste "1/3 × 3 = inteiro".
4. **Cloudflare proxy + UFW + rate limit** (Pitfall 3.6) — proxy laranja em todos subdomínios; portas 80/443 só de IPs Cloudflare; SSH só do dev; rate limit em `/api/auth/*` e `/api/reservas`; Server Actions `allowedOrigins` + CSP.
5. **LGPD baseline funcional** (Pitfalls 1.1+1.2+1.3) — checkbox "+18", export + exclusão (anonimização), aceite versionado, política descrevendo Resend/Cloudflare/Hostinger.

### Riscos contínuos (vigiar)

- **Email deliverability**: DMARC warm-up para `quarantine` em 2 semanas; deliverability score Resend semanal.
- **N+1 em relatórios**: Prisma `include`/`select` explícito desde já + materialized view + seed realista (12 meses × 50 reservas) antes de produção.
- **Disco lotando**: pipeline sharp obrigatório; logrotate; cron cleanup `.next/cache/images`; alerta `df -h > 80%`.
- **Inflação de pontos**: simulador no admin; cap por reserva; expiração 12m; revisão mensal automática.
- **Bus factor 1**: OPERATIONS.md PT-BR + Bitwarden compartilhado + dev secundário ciente.

---

## Open Questions para discutir antes do roadmap

1. **Onboarding guiado da mãe** entra em v1? (research recomenda: SIM)
2. **Quem opera o admin nas 2 primeiras semanas — mãe ou filho?** (afeta gate de UX testing presencial)
3. **Ratio de pontos default**: aceitar 1pt = R$ 1 ou começar 1pt = R$ 2?
4. **Janela de cancelamento default**: 24h (research) ou 48h?
5. **Expiração de pontos**: 12m (research) ou 24m?
6. **MFA admin**: email-code (research recomenda) ou TOTP?
7. **Política de retenção**: 5 anos para fins fiscais, depois anonimizado — aceitar?
8. **Critério de "v1 pronto"**: só fluxo principal, ou inclui Fase 7 hardening? (research recomenda: incluir Fase 7)
9. **Hospedagem do Postgres**: mesmo container Compose (research) ou managed Hostinger?
10. **Plano B de email** se Resend cair: investir documentação SendGrid/SES upfront?
11. **Dev secundário** (Pitfall 7.3 bus factor): quem? Identificar antes de v1?
12. **Linter ANVISA**: alerta visual amarelo (research) ou bloqueio rígido?
13. **Status "retirado"** como swipe-right 1-tap (research) ou confirmação leve?

---

## Confidence Assessment

| Área | Confiança | Notas |
|---|---|---|
| Stack | HIGH | npm view + docs Next 16 + issue #5263 + CVE Coolify multi-source. |
| Architecture | HIGH | Modelo derivado direto do PROJECT.md; Next 16 patterns verificados em docs locais; event-sourcing parcial é padrão clássico. |
| Features | MEDIUM-HIGH | Padrões consolidados de loyalty/food-cost; calibrar com dado real do nicho. |
| Pitfalls (legal) | HIGH | Fontes oficiais ANPD/ANVISA/Procon/Sebrae. |
| Pitfalls (técnico) | HIGH | Postgres docs, OWASP, Resend/Cloudflare oficiais. |
| Pitfalls (operacional/UX) | MEDIUM | Inferência sobre operadora não-técnica + clientela mais velha; calibrar nos primeiros 60-90 dias. |

**Overall: HIGH para escopo prescritivo; MEDIUM-HIGH para calibração específica (ratio de pontos, janela de cancelamento, frequência de email).**

### Gaps a endereçar

- Comportamento real de cancelamento/no-show em doceria de bairro brasileira — medir 60 dias.
- Limite saudável de saldo cumulativo de pontos — medir 90 dias + simulador.
- Aceitação de PWA em clientela 50+ — adiar v1.x e testar.
- Frequência ideal de email lifecycle — calibrar com dado real cedo.
- Lei 5.768/71 (Loterias) aplicada a sorteio com pontos não-comprados-direto — revisão jurídica leve antes de Fase 4.
