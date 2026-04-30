---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source de verdade: `01-RESEARCH.md` §Validation Architecture (linha 2175+) — esta VALIDATION.md é o resumo prescritivo consumido pelos task `<verify>` blocks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (Wave 0 install) — unit + integration |
| **E2E framework** | Playwright (deferido — só smoke E2E manual em Wave 7) |
| **Config file** | `vitest.config.ts` (criar Wave 0) |
| **Test setup** | `tests/setup.ts` (Prisma test DB reset entre testes; Better Auth init com test DB) |
| **Test fixtures** | `tests/conftest.ts` (helpers compartilhados — criar user limpo, gerar token, etc.) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Quick area run** | `npx vitest run tests/<area>/*.test.ts --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30-60s full suite Phase 1 (cresce com phases — Vitest paraleliza) |

---

## Sampling Rate (Nyquist)

- **After every task commit:** `npx vitest run tests/<area>/*.test.ts --reporter=dot` — só área relevante (~< 10s)
- **After every plan wave merge:** `npx vitest run` — full suite (~30-60s)
- **Before `/gsd-verify-work` (phase gate):** Full suite green + smoke manual de:
  - Auth E2E (cadastro → email-verify → login → reset)
  - LGPD E2E (export JSON + anonimização preserva ID + revoga sessões)
  - Origin hidden (curl direto VPS IP retorna refused/blocked de fora)
  - Headers presentes (CSP, HSTS, Referrer-Policy via `curl -I`)
- **Max feedback latency:** < 60 segundos (suite full); < 10s (área individual)

---

## Per-Task Verification Map

> Mapeamento REQ-ID → test file + comando. Plans devem incluir `<automated>` blocks referenciando estes arquivos. Tasks com `Wave 0` em "File Exists" dependem do setup de framework feito no primeiro plan da Wave 0.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-vitest | TBD | 0 | (infra) | — | Framework instalado e setup | install | `npx vitest --version` | ❌ W0 | ⬜ pending |
| 01-INFRA-01 | TBD | 6 | INFRA-01 | — | App + DB sobem via docker-compose | smoke (manual) | `docker-compose up -d && curl localhost:3000` | ❌ W0 | ⬜ pending |
| 01-INFRA-02 | TBD | 7 | INFRA-02 | T-DDoS-01 | IP origin não responde direto de fora | smoke (manual ext) | `curl -k https://<VPS_IP>/` retorna refused/blocked | ❌ W7 | ⬜ pending |
| 01-INFRA-03 | TBD | 6 | INFRA-03 | T-DDoS-01 | UFW rules ativos (CF v4/v6 + dev SSH) | smoke (host) | `ufw status numbered` | ❌ W6 | ⬜ pending |
| 01-INFRA-04 | TBD | 4 | INFRA-04 | T-BruteForce-01 | Rate limit 11ª req em 60s falha | unit | `npx vitest run tests/ratelimit.test.ts` | ❌ W0 | ⬜ pending |
| 01-INFRA-05 | TBD | 1 | INFRA-05 | T-CSRF-01 | CSRF Server Action de origem inválida rejeitada | integration | `npx vitest run tests/serveraction-csrf.test.ts` | ❌ W0 | ⬜ pending |
| 01-INFRA-06 | TBD | 0 | INFRA-06 | — | Build falha sem DATABASE_URL | build-test | `DATABASE_URL= npm run build` retorna exit !=0 | ❌ W0 | ⬜ pending |
| 01-INFRA-07 | TBD | 0 | INFRA-07 | T-PII-01 | pino redact PII | unit | `npx vitest run tests/log-redact.test.ts` | ❌ W0 | ⬜ pending |
| 01-INFRA-08 | TBD | 0 | INFRA-08 | — | `prisma migrate deploy` aplica sem error | smoke | `npx prisma migrate deploy` em CI | ❌ W0 | ⬜ pending |
| 01-INFRA-09 | TBD | 0 | INFRA-09 | T-Float-01 | `Decimal @db.Decimal(19,4)` round-trip preserva precisão | unit | (Phase 2 implementa real money columns; Phase 1 só doc convenção) | Phase 2 | ⬜ deferred |
| 01-INFRA-10 | TBD | 0 | INFRA-10 | — | `DateTime @db.Timestamptz(6)` insert+read mantém TZ | unit | `npx vitest run tests/timezone.test.ts` | ❌ W0 | ⬜ pending |
| 01-INFRA-11 | TBD | 5 | INFRA-11 | — | `instrumentation.ts` chama `boss.start()` exatamente 1× | integration | `npx vitest run tests/instrumentation.test.ts` (mock boss.start, boot Next) | ❌ W0 | ⬜ pending |
| 01-INFRA-12 | TBD | 0 | INFRA-12 | — | `next.config.ts` tem `reactCompiler: true` | snapshot/static | `grep "reactCompiler: true" next.config.ts` em CI | ❌ W0 | ⬜ pending |
| 01-AUTH-01 | TBD | 1 | AUTH-01 | T-AuthBypass-01 | Cadastro completo cria User + Account com all required fields | integration | `npx vitest run tests/auth/signup.test.ts` (com test DB) | ❌ W0 | ⬜ pending |
| 01-AUTH-02 | TBD | 1 | AUTH-02 | T-Enum-01 | Email-first detecta existência (sem leak) | integration | `npx vitest run tests/auth/email-first.test.ts` | ❌ W0 | ⬜ pending |
| 01-AUTH-03 | TBD | 3 | AUTH-03 | — | UI mostra "talvez tenha digitado errado" para email existente | UI manual | smoke browser | manual | ⬜ pending |
| 01-AUTH-04 | TBD | 1 | AUTH-04 | T-AuthBypass-02 | Verification token criado, email enviado, click confirma | integration | `npx vitest run tests/auth/email-verify.test.ts` (mock Resend) | ❌ W0 | ⬜ pending |
| 01-AUTH-05 | TBD | 1 | AUTH-05 | T-Reset-01 | Reset flow OWASP completo (token gen, expira em 60min, single-use, revoga sessões) | integration | `npx vitest run tests/auth/password-reset.test.ts` | ❌ W0 | ⬜ pending |
| 01-AUTH-06 | TBD | 1 | AUTH-06 | T-Hash-01 | argon2id hash produz output válido + params OWASP profile 2 | unit | `npx vitest run tests/auth/argon2.test.ts` | ❌ W0 | ⬜ pending |
| 01-AUTH-07 | TBD | 1 | AUTH-07 | T-Enum-01 | Mensagens genéricas em /esqueci-senha (existente vs não-existente retornam mesma string + timing similar) | integration | `npx vitest run tests/auth/anti-enum.test.ts` | ❌ W0 | ⬜ pending |
| 01-AUTH-08 | TBD | 1 | AUTH-08 | T-Session-01 | Login cliente cria sessão DB | integration | `npx vitest run tests/auth/signin.test.ts` | ❌ W0 | ⬜ pending |
| 01-AUTH-09 | TBD | 3 | AUTH-09 | — | Cliente acessa `/minha-conta/meus-dados` autenticado | smoke (manual W7) | curl com cookie | manual | ⬜ pending |
| 01-AUTH-10 | TBD | 1 | AUTH-10 | T-PrivEsc-01 | Sem sessão admin, `/admin/*` redireciona via proxy.ts + layout | integration | `npx vitest run tests/auth/admin-guard.test.ts` | ❌ W0 | ⬜ pending |
| 01-AUTH-11 | TBD | 4 | AUTH-11 | — | Admin login grava AuditLog | integration | `npx vitest run tests/audit/admin-login.test.ts` | ❌ W0 | ⬜ pending |
| 01-LGPD-01 | TBD | 4 | LGPD-01 | T-LGPD-01 | Cadastro sem isAdult=true rejeita | integration | `npx vitest run tests/lgpd/+18.test.ts` | ❌ W0 | ⬜ pending |
| 01-LGPD-02 | TBD | 4 | LGPD-02 | T-LGPD-02 | termsAcceptedAt + termsVersion gravados | integration | `npx vitest run tests/lgpd/consent.test.ts` | ❌ W0 | ⬜ pending |
| 01-LGPD-03 | TBD | 3 | LGPD-03 | T-LGPD-03 | `/privacidade` contém Resend, Cloudflare, Hostinger | snapshot | `npx vitest run tests/lgpd/privacy-content.test.ts` (regex contains) | ❌ W0 | ⬜ pending |
| 01-LGPD-04 | TBD | 4 | LGPD-04 | T-LGPD-04 | `/api/me/export` retorna JSON com cadastro | integration | `npx vitest run tests/lgpd/export.test.ts` | ❌ W0 | ⬜ pending |
| 01-LGPD-05 | TBD | 4 | LGPD-05 | T-LGPD-05 | Anonimização preserva ID, troca email/name/telefone, revoga sessões | integration | `npx vitest run tests/lgpd/anonymize.test.ts` | ❌ W0 | ⬜ pending |
| 01-LGPD-06 | TBD | 3 | LGPD-06 | — | Footer renderiza dpo@docesvalentina.com.br | snapshot | `npx vitest run tests/lgpd/footer-dpo.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Plan column TBD — preenchido quando planner gerar PLAN.md files (cada PLAN ID vira referência aqui).*

---

## Wave 0 Requirements

Setup que TODA task subsequente depende. Primeiro plan da Wave 0 deve cobrir TUDO abaixo:

- [ ] `vitest.config.ts` — config Vitest com Postgres test DB connection (Docker test container ou .env.test com DB separado)
- [ ] `tests/setup.ts` — Prisma test DB reset entre testes (truncate or re-migrate); Better Auth init com test DB; cleanup de jobs pg-boss test
- [ ] `tests/conftest.ts` — fixtures compartilhadas (`createTestUser()`, `signInAsCustomer()`, `signInAsAdmin()`, `generateResetToken()`, `truncateAll()`)
- [ ] Test directory structure criada:
  - `tests/auth/` — signup, signin, email-verify, password-reset, anti-enum, argon2, admin-guard
  - `tests/lgpd/` — +18, consent, privacy-content, export, anonymize, footer-dpo
  - `tests/audit/` — admin-login (e expandir Phase 2+)
  - `tests/ratelimit.test.ts`
  - `tests/instrumentation.test.ts`
  - `tests/log-redact.test.ts`
  - `tests/timezone.test.ts`
  - `tests/serveraction-csrf.test.ts`
- [ ] Framework install — `npm install -D vitest@latest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx`
- [ ] CI script básico: `package.json` com `"test": "vitest run"` e `"test:area": "vitest run tests/$AREA"` (CI completo via GitHub Actions fica deferido v1.x — single-dev v1)
- [ ] `package.json` script `test:build-fail` que valida `DATABASE_URL= npm run build` falha (INFRA-06)

---

## Manual-Only Verifications

Verificações que ferramenta automatizada não cobre — devem rodar antes do phase gate Wave 7.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Origin VPS IP não responde direto de fora | INFRA-02 | Precisa rede externa fora da CF; automatizar implicaria CI ter IP fora — overhead pra v1 single-dev | De máquina externa: `curl -k --resolve doces-valentina.com.br:443:<VPS_IP> https://doces-valentina.com.br/` deve falhar (timeout/refused). De `https://doces-valentina.com.br/` normal (via CF) deve responder 200 |
| UFW rules corretas no host VPS | INFRA-03 | Comandos host-side; não roda em test runner | SSH no VPS: `ufw status numbered` deve listar regras CF v4 + v6 + dev SSH; `iptables -L INPUT` confirma |
| Cliente cadastro → email confirma → login (flow real) | AUTH-01..04, AUTH-08 | UX em browser real; email real chegando | Browser: criar conta com email pessoal real; receber email Resend; clicar link; logar; verificar sessão persiste F5 |
| UI "talvez tenha digitado errado" aparece em email já cadastrado | AUTH-03 | Validação visual + copy literal pt-BR | Browser: digitar email já existente em /cadastro → mensagem aparece com copy do UI-SPEC |
| Cliente acessa "Meus dados" e vê painel | AUTH-09 | Auth protegido em browser | Login cliente → navegar `/minha-conta/meus-dados` → ver dados próprios |
| Headers presentes na resposta | INFRA-04 (relacionado) + V9 | Verificação operacional pós-deploy | `curl -I https://doces-valentina.com.br/` deve mostrar: `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| Caddy auto-LE issued cert | INFRA-01 | Cert lifecycle externo | SSH VPS: `caddy list-modules`; checar log Caddy mostra "obtained certificate"; `openssl s_client -connect doces-valentina.com.br:443` mostra LE issuer |
| Migration drill em staging antes de PROD | INFRA-08 (Pitfall 2.4) | Drill manual recomendado pré-launch | Restaurar dump PROD em staging → `npx prisma migrate deploy` → smoke test auth/LGPD endpoints → comparar antes/depois |

---

## Validation Sign-Off

- [ ] All Phase 1 tasks têm `<automated>` verify ou estão em Manual-Only Verifications acima
- [ ] Sampling continuity: nenhum bloco de 3 tasks consecutivas sem verify automatizado
- [ ] Wave 0 cobre todos os arquivos referenciados em "❌ W0" da Per-Task Verification Map
- [ ] Sem watch-mode flags em comandos automatizados (sempre `vitest run`, nunca `vitest` sem `run`)
- [ ] Feedback latency < 60s full suite; < 10s área individual
- [ ] `nyquist_compliant: true` set in frontmatter quando todos os items acima estiverem ✅
- [ ] `wave_0_complete: true` set em frontmatter quando primeiro plan Wave 0 (test framework setup) for completado e todos arquivos da Wave 0 Requirements existirem

**Approval:** pending (will be approved by `gsd-plan-checker` after Wave 0 plan exists with all framework setup tasks).

---

## Cross-References

- **Source detail:** `.planning/phase-1-foundation/01-RESEARCH.md` §Validation Architecture (line 2175+) e §Security Domain (line 2242+)
- **CONTEXT decisions impacting tests:** D-05 (CLI seed admin — testar em integration), D-06 (role enum — testar guard), D-07 (CLI reset — testar break-glass), D-08 (sem email proativo admin — assert NÃO disparou), D-09 (Prisma 7 — Decimal/Timestamptz handling)
- **REQ-IDs cobertas:** 29 (INFRA-01..12, AUTH-01..11, LGPD-01..06)
- **REQ-IDs deferred:** INFRA-09 (Decimal precision — Phase 2 quando money columns existirem)
- **Threat refs (T-*):** definidos em `01-RESEARCH.md` §Security Domain — tasks devem citar `threat: T-XXX-NN` quando aplicável

---

*Phase: 01-foundation*
*Validation strategy created: 2026-04-30*
*Mode: Nyquist-compliant per `.planning/config.json` `workflow.nyquist_validation: true`*
