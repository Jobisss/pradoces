<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Luizinha Confeitaria

Site de **reserva** (não checkout) dos doces caseiros que a mãe do dono produz, com fidelização por pontos, sorteios, catálogo de resgate e admin completo de pricing/financeiro com tracking por marca/compra de ingredientes.

**Core value:** A mãe enxerga lucro real por produto (custo rastreado até a marca do ingrediente) e fideliza a clientela do bairro com pontos — sem perder o contato pessoal via WhatsApp.

<!-- BEGIN:gsd-context -->
## GSD Workflow Context

This project uses [Get Shit Done](https://github.com/anthropics/get-shit-done-cc) for spec-driven development. Always read these files before suggesting work:

- `.planning/PROJECT.md` — project context, core value, validated/active/out-of-scope requirements, key decisions
- `.planning/REQUIREMENTS.md` — 129 v1 requirements with REQ-IDs (INFRA-*, AUTH-*, LGPD-*, ING-*, REC-*, LOTE-*, PROD-*, CAT-*, RES-*, PT-*, RESG-*, SORT-*, SAZON-*, ADM-*, FIN-*, NOTIF-*)
- `.planning/ROADMAP.md` — 7 phases with success criteria and pitfalls
- `.planning/STATE.md` — current phase / plan / wave
- `.planning/research/SUMMARY.md` — research synthesis (stack, features, architecture, pitfalls)
- `.planning/config.json` — workflow preferences (mode, granularity, parallelization, model profile)

**Locked stack decisions** (do not relitigate without `/gsd-discuss-phase` raising it):
- Next.js 16 App Router + React 19 (constraint from PROJECT.md — read `node_modules/next/dist/docs/` before coding)
- Prisma 7 ORM (revised 2026-04-30 — was Drizzle). Schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`. Use `prisma.$queryRaw` for Postgres-only features (numeric(19,4), triggers, CHECK XOR, custo congelado event-sourcing). **Read Prisma 7 official docs + `node_modules/@prisma/client/` before coding — Prisma 7 has breaking changes vs v6 (Rust query engine removed).**
- Better Auth + argon2id (not Lucia — deprecated; not NextAuth — see SUMMARY.md)
- Resend + React Email + svix
- pg-boss for background jobs (no Redis)
- Docker Compose direct on VPS + host nginx reverse proxy (not Coolify — 11 CVEs jan/2026; no Cloudflare/Caddy — direct Hostinger DNS, nginx already serves other domains on this host; no PM2 — app runs as a Docker container, not a native process)
- Money in `numeric(19,4)`, dates in `timestamptz` with `TZ=America/Sao_Paulo`
- Custom cost frozen per `ingrediente_compra_id` (event-sourcing parcial)

**To advance the project:**
- `/gsd-progress` — see current state
- `/gsd-plan-phase <N>` — plan a phase
- `/gsd-execute-phase <N>` — execute a phase
- `/gsd-discuss-phase <N>` — clarify a phase before planning

Always commit `.planning/` artifacts (config: `commit_docs: true`).
<!-- END:gsd-context -->

