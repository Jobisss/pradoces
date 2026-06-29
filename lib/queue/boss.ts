import PgBoss from 'pg-boss'
import { env } from '@/lib/env'

/**
 * pg-boss singleton (INFRA-11) — Postgres-backed job queue, no Redis.
 *
 * Uses a dedicated `pgboss` schema so its tables (pgboss.job/archive/schedule/
 * subscription, created automatically by boss.start()) never pollute `public`
 * and Prisma migrations ignore them.
 *
 * The global cache survives HMR in dev so we don't open a new pool on every
 * reload; in production a fresh module load is fine.
 */
const globalForBoss = globalThis as unknown as { boss: PgBoss | undefined }

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
  })

if (process.env.NODE_ENV !== 'production') globalForBoss.boss = boss
