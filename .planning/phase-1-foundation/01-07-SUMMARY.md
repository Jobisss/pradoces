---
phase: 01-foundation
plan: 07
subsystem: ui
tags: [shadcn, tailwind-v4, radix-ui, sonner, fraunces, next-font, lgpd, rsc, csp, design-system]

# Dependency graph
requires:
  - phase: 01-foundation (Plan 03)
    provides: "lib/auth/server.ts (auth.api.getSession + admin plugin), app/(admin)/admin/layout.tsx + app/minha-conta/layout.tsx role gates, proxy.ts (CSP nonce + cookie-presence guards)"
  - phase: 01-foundation (Plan 06)
    provides: "proxy.ts boundary (CSP header construction) onde o fix de unsafe-eval em dev foi aplicado"
provides:
  - "Design system: shadcn (preset radix-nova) inicializado + 10 componentes oficiais em components/ui/*"
  - "app/globals.css — paleta pink-bordô da UI-SPEC mapeada sobre os tokens shadcn (--primary #9D2D7A, --background #FFF6FB), dark mode desabilitado, --font-display (Fraunces), --color-accent-soft, --color-success"
  - "app/layout.tsx — root pt-BR com Fraunces wired, metadata real, viewport (viewport-fit=cover, zoom permitido), Toaster global"
  - "components/header.tsx — header RSC com CTAs por sessão (D-01/D-02/D-04) + logout via server action"
  - "components/footer.tsx — footer global D-03 com DPO (LGPD-06)"
  - "components/toaster.tsx — provider sonner (top-center, dismissable)"
  - "app/(public)/ — shell de grupo (Header+Footer) + landing 3-variant + /termos (LGPD-02) + /privacidade (LGPD-03, operadores reais)"
affects: [01-08 (auth UI forms herdam o shell + componentes shadcn form), 01-10 (admin login UI), 01-11 (LGPD meus-dados/excluir herdam shell + sonner), 03 (vitrine substitui a landing), 06 (sazonalidade sobrescreve tokens de cor via CSS vars)]

# Tech tracking
tech-stack:
  added: ["shadcn (radix-nova preset)", "radix-ui@1.6", "lucide-react@1.22", "sonner@2.0.7", "date-fns@4.1.0", "class-variance-authority", "clsx", "tailwind-merge", "tw-animate-css", "next-themes", "jsdom (dev)"]
  patterns: [shadcn-tokens-overridden-by-brand-palette, route-group-shell-for-d03-footer-isolation, rsc-header-session-read, server-action-logout, jsdom-docblock-for-rsc-render-tests, dev-only-csp-unsafe-eval]

key-files:
  created:
    - components.json
    - lib/utils.ts
    - "components/ui/{button,input,label,checkbox,card,alert,sonner,separator,skeleton,table}.tsx"
    - components/header.tsx
    - components/footer.tsx
    - components/toaster.tsx
    - "app/(public)/layout.tsx"
    - "app/(public)/page.tsx"
    - "app/(public)/termos/page.tsx"
    - "app/(public)/privacidade/page.tsx"
    - tests/lgpd/footer-dpo.test.tsx
    - tests/lgpd/privacy-content.test.tsx
  modified:
    - app/globals.css
    - app/layout.tsx
    - proxy.ts
    - package.json

key-decisions:
  - "Landing e minha-conta movidas para o route group app/(public)/ (Header+Footer vivem no layout do grupo, NÃO no root) — o group (admin) é irmão e tem shell próprio sem footer, então D-03 (footer ausente em /admin/*) é garantido pela árvore de layouts, sem checagem de pathname no server"
  - "Tokens da UI-SPEC mapeados SOBRE o sistema shadcn (UI-SPEC 'accent' #9D2D7A = shadcn --primary; UI-SPEC 'surface' = --card/--popover) — os 10 componentes oficiais herdam a marca sem patch e Phase 6 sobrescreve via CSS vars"
  - "shadcn v3 (CLI nova) usa preset por nome (escolhido Nova: Lucide/Geist, baseColor neutral) e pacote unificado radix-ui — não existe mais --base-color/style new-york da spec; componentes importam de 'radix-ui'"
  - "unsafe-eval no CSP SÓ em dev (NODE_ENV!=production): React dev mode exige eval(); produção continua estrita (nonce + strict-dynamic) — T-01-07-01 intacto"
  - "Dark mode confirmado FORA de escopo Phase 1 (UI-SPEC §Color): paleta light-only pink-bordô, reativação em Phase 6"

patterns-established:
  - "Route-group shell: app/(public)/layout.tsx detém o chrome global (Header/Footer); novos segmentos públicos/cliente (auth dos Plans 08/10, LGPD do Plan 11) vivem sob (public) para herdar o shell; /admin/* fica em (admin) sem footer"
  - "Header RSC lê auth.api.getSession server-side e troca CTAs por role (sem flicker, T-01-07-02); logout via inline server action chamando auth.api.signOut"
  - "Testes de render de RSC estático: docblock // @vitest-environment jsdom no topo do arquivo sobrepõe o environment:'node' global; @testing-library/react renderiza componentes/páginas síncronas"

requirements-completed: [LGPD-02, LGPD-03, LGPD-06]

# Metrics
duration: 99min
completed: 2026-06-29
---

# Phase 1 Plan 07: Shell Visual (Design System + Landing + LGPD shell) Summary

**shadcn (preset radix-nova) inicializado com a paleta pink-bordô da UI-SPEC mapeada sobre seus tokens, mais o shell global pt-BR (header com CTAs por sessão, footer com DPO, toaster sonner) e a landing 3-variant + /termos e /privacidade com operadores reais — tudo isolado num route group (public) para o footer nunca aparecer no admin (D-03).**

## Performance

- **Duration:** 99 min (wall-clock; inclui a espera do checkpoint visual humano — execução ativa ~45 min)
- **Started:** 2026-06-29T17:43:47Z
- **Completed:** 2026-06-29T19:23Z
- **Tasks:** 2 funcionais (Task 1 + Task 2 TDD) + 1 checkpoint human-verify (aprovado: "visual ok")
- **Files created/modified:** 22 (18 criados, 4 modificados; 2 movidos via route group)

## Accomplishments
- **Design system no ar:** `shadcn init` não-interativo (preset Nova — Lucide/Geist, baseColor neutral, CSS vars) + 10 componentes oficiais (`button input label checkbox card alert sonner separator skeleton table`). `globals.css` reescrito: os 12 tokens da UI-SPEC §Color mapeados sobre o sistema shadcn (accent vinho `#9D2D7A` → `--primary`, fundo creme `#FFF6FB` → `--background`), dark mode desabilitado, `--font-display` (Fraunces), `--color-accent-soft`, `--color-success`.
- **Shell global pt-BR:** root layout com `lang="pt-BR"`, Fraunces wired (`--font-fraunces`), metadata real, `viewport` com `viewport-fit=cover` (zoom permitido — a11y 50+), e `Toaster` global. `components/header.tsx` (RSC) lê a sessão e troca os CTAs (D-01 visitante / D-02 cliente / D-04 admin) com logout via server action `auth.api.signOut`. `components/footer.tsx` (D-03/LGPD-06) com `dpo@docesvalentina.com.br` + Termos/Privacidade. `components/toaster.tsx` (sonner, top-center, dismissable).
- **Surfaces públicas + isolamento D-03:** landing 3-variant ("Em breve: reserva os doces caseiros da Valentina" + 2 parágrafos voz-vizinha), `/termos` (intro literal + `v1.0-shell`) e `/privacidade` (conteúdo verbatim RESEARCH §LGPD-03 — Resend EUA, Cloudflare EUA, Hostinger Lituânia, retenção 5 anos, direitos art. 18, DPO). Tudo no route group `app/(public)/` cujo layout detém Header+Footer; o group `(admin)` é irmão sem footer → **footer nunca aparece em /admin/\*** (D-03) sem hack de pathname.
- **TDD verde + sem regressão:** RED→GREEN com 2 testes LGPD (jsdom); suíte completa **44 passed / 2 todo / 0 failed** (era 41/43), `tsc --noEmit` limpo.
- **Checkpoint visual aprovado:** o usuário validou paleta/copy/layout em http://localhost:3000 e respondeu "visual ok" após o fix de CSP.

## Task Commits

1. **Task 1: shadcn init + 10 componentes + tokens pink-bordô** — `7910184` (feat)
2. **Task 2 (TDD): layout/header/footer/toaster + landing + termos/privacidade**
   - `dadff8d` (test — RED: footer DPO + privacidade operadores, + jsdom devDep)
   - `31f78e5` (feat — GREEN: shell pt-BR + (public) group + páginas)
3. **Deviação (durante o checkpoint): fix CSP dev** — `591cc71` (fix — `unsafe-eval` só em dev)

**Plan metadata:** _(commit final de docs — abaixo)_

## Files Created/Modified
- `components.json` — config shadcn (style radix-nova, baseColor neutral, aliases @/components, @/lib/utils)
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- `components/ui/*.tsx` (10) — primitivas oficiais (importam do pacote unificado `radix-ui`)
- `app/globals.css` — paleta UI-SPEC sobre tokens shadcn; dark mode removido; `--font-display`/`--color-accent-soft`/`--color-success`
- `app/layout.tsx` — root pt-BR, Fraunces, metadata, viewport, Toaster (sem Header/Footer — ficam no grupo)
- `components/header.tsx` — header RSC, CTAs por sessão, logout server action
- `components/footer.tsx` — footer global D-03 + DPO (RSC estático)
- `components/toaster.tsx` — provider sonner ('use client')
- `app/(public)/layout.tsx` — shell de grupo (Header + main + Footer)
- `app/(public)/page.tsx` — landing 3-variant (movida de app/page.tsx)
- `app/(public)/termos/page.tsx` — termos shell versionado (LGPD-02)
- `app/(public)/privacidade/page.tsx` — política descritiva (LGPD-03, operadores reais)
- `app/(public)/minha-conta/layout.tsx` — role gate (movido para o grupo p/ herdar o footer)
- `proxy.ts` — `unsafe-eval` no CSP só em dev (deviation)
- `tests/lgpd/{footer-dpo,privacy-content}.test.tsx` — testes de render jsdom
- `package.json` — +shadcn deps (radix-ui, lucide-react, sonner, date-fns, cva, clsx, tailwind-merge, tw-animate-css, next-themes) + jsdom (dev)

## Decisions Made
- **Route-group shell para D-03:** Header/Footer no `app/(public)/layout.tsx` (não no root) + admin no group `(admin)` irmão = footer ausente em /admin/* pela árvore de layouts, sem ler pathname no server. Landing e minha-conta movidas para `(public)` (URLs inalteradas — route groups não afetam path).
- **Tokens UI-SPEC sobre shadcn:** o "accent" da UI-SPEC (#9D2D7A) vira o `--primary` do shadcn (CTA), e "surface" vira `--card`/`--popover`; assim os componentes oficiais já saem na marca e Phase 6 sobrescreve via CSS vars.
- **Dark mode fora de escopo:** confirmado pela UI-SPEC (light-only Phase 1), reativação em Phase 6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSP de dev bloqueava `eval()` do React dev mode**
- **Found during:** Checkpoint human-verify (Task 3) — o usuário viu o overlay "eval() is not supported … make sure unsafe-eval is included".
- **Issue:** `proxy.ts` emitia `script-src 'self' 'nonce-…' 'strict-dynamic'` sem `'unsafe-eval'`; React em dev exige eval() (Fast Refresh / reconstrução de callstack), quebrando a renderização que o usuário tentava verificar.
- **Fix:** `'unsafe-eval'` entra no `script-src` SÓ em desenvolvimento (`NODE_ENV !== 'production'`); produção mantém o CSP estrito (nonce + strict-dynamic, sem eval) — a mitigação T-01-07-01 fica intacta em prod.
- **Files modified:** proxy.ts
- **Verification:** header servido confirmado com `'unsafe-eval'` em dev; `tests/proxy-auth-ratelimit.test.ts` continua verde (6/6); usuário aprovou ("visual ok").
- **Committed in:** `591cc71`

**2. [Rule 3 - Blocking] Estrutura de layouts para satisfazer D-03 (acceptance grep em app/page.tsx superada)**
- **Found during:** Task 2 (montagem do shell)
- **Issue:** Os critérios de aceite referenciavam `app/page.tsx`, mas renderizar Header/Footer no root layout faria o footer aparecer em `/admin/*` (viola D-03, um must-have truth). Footer condicional por pathname não é trivial em RSC.
- **Fix:** Landing movida para `app/(public)/page.tsx` e o chrome global para `app/(public)/layout.tsx`; o group `(admin)` (shell próprio, sem footer) não herda o footer. Conteúdo/variants da landing entregues 1:1 ("Criar minha conta" etc.).
- **Files modified:** app/(public)/page.tsx (movida), app/(public)/layout.tsx, app/(public)/minha-conta/ (movida)
- **Verification:** `grep 'Criar minha conta' app/(public)/page.tsx` == 1; SSR confirmado em /, /termos, /privacidade; footer presente nas públicas e ausente no segmento (admin).
- **Committed in:** `31f78e5`

**3. [Rule 3 - Blocking] jsdom ausente para testes de render de componente**
- **Found during:** Task 2 RED (test infra)
- **Issue:** vitest global usa `environment: 'node'`; os testes LGPD precisam renderizar RSC estático com @testing-library/react (jsdom não instalado).
- **Fix:** `npm install -D jsdom` + docblock `// @vitest-environment jsdom` no topo dos 2 testes.
- **Files modified:** package.json, tests/lgpd/*.test.tsx
- **Verification:** os 2 testes passam (3 asserts); suíte completa 44/2-todo.
- **Committed in:** `dadff8d`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking). **Impact:** nenhum scope creep — o fix de CSP restaura o dev mode (prod intacto), a estrutura de route group é a forma idiomática de cumprir o D-03 must-have, e o jsdom é infra de teste. Os critérios de aceite `app/page.tsx` foram cumpridos em `app/(public)/page.tsx` (mesma URL).

## Issues Encountered
- **shadcn CLI v3 ≠ spec:** o flag `--base-color`/style "new-york" da UI-SPEC não existe mais; a CLI nova usa presets por nome (escolhido **Nova** = Lucide/Geist, baseColor neutral) e o pacote unificado `radix-ui`. Sem impacto funcional — `components.json` registra `baseColor: neutral` e os componentes saem corretos.
- **`npx` interceptado pelo hook rtk:** `npx shadcn@latest …` falhava com "Unknown command"; resolvido invocando o binário `npx` por caminho absoluto.
- **`.next/types` stale após mover arquivos:** validadores gerados referenciavam `app/page.js`/`minha-conta` antigos e quebravam o `tsc`; removidos (`.next` é gitignored, regenera no dev/build) → tsc limpo.

## Known Stubs
- **Componente shadcn `form` adiado:** o item `form` do registry radix-nova é um no-op silencioso nesta versão da CLI e **não é usado por nenhum arquivo do 01-07** (os forms de auth/cliente são Plans 08/10). Será adicionado com `react-hook-form` + `@hookform/resolvers` nesses planos. Não bloqueia o objetivo deste plano.
- **`/termos` e `/privacidade` são shell v1.0-shell:** conteúdo placeholder pt-BR (operadores reais já corretos p/ cumprir a lei); revisão jurídica leve é item v1.x (CONTEXT.md "Claude's Discretion"). Intencional.

## User Setup Required
None — nenhuma configuração de serviço externo. (O dev server foi iniciado/encerrado só para o checkpoint visual.)

## Next Phase Readiness
- **Plan 08 (auth UI cliente):** shell + componentes shadcn prontos; colocar as páginas de auth sob `app/(public)/` p/ herdar Header/Footer; adicionar `shadcn add form` (+ react-hook-form) quando montar os formulários.
- **Plan 10 (admin login):** vive no group `(admin)` (sem footer global, correto).
- **Plan 11 (LGPD meus-dados/excluir):** sob `(public)`; `Toaster`/sonner pronto p/ os toasts de export/exclusão.
- **Phase 6 (Sazonalidade):** sobrescreve os tokens de cor via CSS vars (a paleta default já está isolada em `:root`).

## Self-Check: PASSED
Os 18 arquivos criados (components.json, lib/utils.ts, 10 componentes ui, header/footer/toaster, (public)/{layout,page,termos,privacidade}, minha-conta/layout, 2 testes LGPD) existem em disco; os 4 commits (7910184, dadff8d, 31f78e5, 591cc71) estão no histórico git.

---
*Phase: 01-foundation*
*Completed: 2026-06-29*
