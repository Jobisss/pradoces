import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Load .env into process.env BEFORE test workers fork. The Prisma driver adapter
// (lib/db/client.ts) reads DATABASE_URL at module-import time, which happens
// before any per-test hook runs — so the env must already be present here.
// Vitest does not auto-load .env into process.env; Node 24's built-in loader does.
try {
  process.loadEnvFile()
} catch {
  // No .env (e.g. CI) — assume DATABASE_URL is already in the environment.
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    reporters: ['default'],
    // Single-instance Postgres test DB → run files sequentially in one fork to
    // avoid cross-test DB races. (Vitest 4 removed poolOptions.forks.singleFork;
    // fileParallelism:false is the supported equivalent.)
    pool: 'forks',
    fileParallelism: false,
    // Postgres test DB url from env; resolved via dotenv when present
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next aliases `server-only` to a no-op for server bundles; vitest has
      // no bundler-side client/server split, so every test is "server".
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only-stub.ts'),
    },
  },
})
