import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

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
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
