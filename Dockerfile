# syntax=docker/dockerfile:1
# Luizinha Confeitaria — Next.js 16 standalone multi-stage build (INFRA-01).
#
# node:20-alpine is musl + OpenSSL 3 → matches prisma binaryTargets
# "linux-musl-openssl-3.0.x" (schema.prisma) and the @node-rs/argon2 prebuilt
# musl variant (RESEARCH §Assumption A8). Three stages keep the runner image
# minimal (only .next/standalone + static + prisma engine).

# ---------- Stage 1: deps (install node_modules from lockfile) ----------
FROM node:20-alpine AS deps
WORKDIR /app
# libc6-compat smooths over musl/glibc edge cases for native addons.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage 2: builder (prisma generate + next build standalone) ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.ts imports lib/env, which validates env at build time (INFRA-06).
# These are BUILD-TIME placeholders only: server-only vars are never inlined into
# the bundle, so dummy values are safe here — real values come from env_file at
# runtime (docker-compose). NEXT_PUBLIC_URL *is* inlined, so it defaults to the
# real production URL and can be overridden with --build-arg.
ARG NEXT_PUBLIC_URL=https://luizinhaconfeitaria.com.br
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV BETTER_AUTH_SECRET=build_time_placeholder_secret_min_32_chars
ENV BETTER_AUTH_URL=https://luizinhaconfeitaria.com.br
ENV AUDIT_HASH_PEPPER=build_time_placeholder_pepper_min_32_chars
ENV RESEND_API_KEY=re_build_time_placeholder
ENV RESEND_WEBHOOK_SECRET=whsec_build_time_placeholder
ENV ADMIN_EMAIL=build@luizinhaconfeitaria.com.br
ENV NEXT_PUBLIC_URL=${NEXT_PUBLIC_URL}

# Generate the Prisma client (musl engine) before building.
RUN npx prisma generate
RUN npm run build

# ---------- Stage 3: runner (minimal standalone image) ----------
FROM node:20-alpine AS runner
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

USER node
EXPOSE 3000
# Standalone entrypoint: node server.js
CMD ["node", "server.js"]
