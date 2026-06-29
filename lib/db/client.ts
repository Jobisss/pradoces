import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * PrismaClient singleton (hot-reload-safe).
 *
 * Prisma 7 note: the Rust query engine was removed and the datasource `url` no
 * longer lives in schema.prisma. The runtime connection is supplied through a
 * driver adapter (`@prisma/adapter-pg`) built from `DATABASE_URL`.
 *
 * Why read `process.env.DATABASE_URL` directly instead of importing `lib/env`:
 * this module is imported very early and widely (including tests/scripts), and
 * routing through `lib/env` would force full t3-env validation of every server
 * secret at import time. This mirrors the sanctioned `NODE_ENV` carve-out
 * already documented in `lib/log.ts`. `lib/env` still validates `DATABASE_URL`
 * at build time via `next.config.ts`.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
