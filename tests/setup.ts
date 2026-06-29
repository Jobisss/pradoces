import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

/**
 * Global test setup — runs before every test file.
 *
 * This file is the canonical hook point for test-suite-wide initialization.
 * It is intentionally minimal in Wave 0 (Plan 01):
 *
 *   - Plan 02 (Prisma) wires DB reset here:
 *       `await prisma.$executeRaw\`TRUNCATE TABLE "users", "sessions", ... CASCADE\``
 *     (or calls `truncateAll()` from tests/conftest.ts once the Prisma client + schema land).
 *   - Plan 03 (Better Auth) wires Better Auth test-client init here so auth-dependent
 *     tests can mint sessions via the conftest helpers (signInAsCustomer / signInAsAdmin).
 */
beforeEach(async () => {
  // TODO(Plan 02): reset Prisma test DB between tests (TRUNCATE ... CASCADE).
  // TODO(Plan 03): initialize Better Auth test client for auth-dependent suites.
})
