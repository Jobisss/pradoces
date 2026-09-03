# syntax=docker/dockerfile:1
# Luizinha Confeitaria — Next.js 16 standalone multi-stage build (INFRA-01).
#
# node:22-alpine is musl + OpenSSL 3 → matches prisma binaryTargets
# "linux-musl-openssl-3.0.x" (schema.prisma) and the @node-rs/argon2 prebuilt
# musl variant (RESEARCH §Assumption A8). Three stages keep the runner image
# minimal (only .next/standalone + static + prisma engine).
#
# Era node:20 e precisou subir: pg-boss@12 exige node >=22.12.0, e
# @prisma/streams-local (Prisma 7) e kysely exigem >=22. Com Node 20 o
# `npm ci` só avisava EBADENGINE e seguia — a conta chegava em runtime.
# Alpine 22 continua musl + OpenSSL 3, então o binaryTarget não muda.

# ---------- Stage 1: deps (install node_modules from lockfile) ----------
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat smooths over musl/glibc edge cases for native addons.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# A rede da VPS derruba tarball grande no meio (ETIMEDOUT em yargs, set/2026).
# Os defaults do npm são 2 tentativas e 5min de timeout — aqui a conexão é
# lenta o bastante pra estourar os dois. Mais paciência, menos rebuild.
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000

# ---------- Stage 2: builder (prisma generate + next build standalone) ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.ts imports lib/env, which validates env at build time (INFRA-06).
# These are BUILD-TIME placeholders only: server-only vars are never inlined into
# the bundle, so dummy values are safe here — real values come from env_file at
# runtime (docker-compose). NEXT_PUBLIC_URL *is* inlined, so it defaults to the
# real production URL and can be overridden with --build-arg.
ARG NEXT_PUBLIC_URL=https://luizinha-confeitaria.com.br
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV BETTER_AUTH_SECRET=build_time_placeholder_secret_min_32_chars
ENV BETTER_AUTH_URL=https://luizinha-confeitaria.com.br
ENV AUDIT_HASH_PEPPER=build_time_placeholder_pepper_min_32_chars
ENV RESEND_API_KEY=re_build_time_placeholder
ENV RESEND_WEBHOOK_SECRET=whsec_build_time_placeholder
ENV ADMIN_EMAIL=build@luizinha-confeitaria.com.br
ENV NEXT_PUBLIC_URL=${NEXT_PUBLIC_URL}

# Generate the Prisma client (musl engine) before building.
RUN npx prisma generate
RUN npm run build

# ---------- Stage 3: runner (minimal standalone image) ----------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The standalone output bundles a minimal node_modules + server.js. static/ and
# public/ are NOT included by the tracer and must be copied explicitly.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Prisma needs the schema + generated engine at runtime (migrate deploy + client).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# PROD-04/05: fotos de produto vivem num volume nomeado montado aqui (ver
# docker-compose.yml) — precisa existir e pertencer ao "node" ANTES do mount,
# senão o Docker cria o mountpoint como root e o server não consegue escrever.
RUN mkdir -p ./public/uploads && chown node:node ./public/uploads

# .next/cache não vem no output standalone (COPY acima é root-owned por
# padrão) — Next tenta criar/escrever nele em runtime (cache de otimização de
# imagem) e o usuário "node" sem dono do diretório toma EACCES ao dar mkdir.
RUN mkdir -p ./.next/cache && chown -R node:node ./.next

USER node
EXPOSE 3000
# Standalone entrypoint: node server.js
CMD ["node", "server.js"]
