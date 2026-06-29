import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 breaking changes addressed here (vs the v6-era schema in RESEARCH.md):
 *   - `url` is no longer allowed in the `datasource` block of schema.prisma.
 *     The connection string for Migrate / Studio / introspection lives here.
 *   - The CLI no longer auto-loads `.env`; we load it explicitly below using the
 *     Node 24 built-in `process.loadEnvFile()` (no `dotenv` dependency required).
 *
 * Runtime (PrismaClient) connects via a driver adapter — see lib/db/client.ts.
 */
try {
  // Loads ./.env from the current working directory (the project root when the
  // Prisma CLI runs). Optional: in CI/prod DATABASE_URL is already in the env.
  process.loadEnvFile()
} catch {
  // No .env present — assume DATABASE_URL is already set in the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
