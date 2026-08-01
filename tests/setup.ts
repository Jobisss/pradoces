import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { prisma } from '@/lib/db/client'

/**
 * Global test setup — runs for every test file.
 *
 * Wave 0 (Plan 02) wires the real Prisma DB reset here. After each test we
 * truncate the Phase 1 tables inside a single transaction so no rows leak
 * across tests. Child tables (FK referencing users) are deleted before users.
 *
 *   - Plan 03 (Better Auth) will add Better Auth test-client init here so
 *     auth-dependent suites can mint sessions via the conftest helpers
 *     (signInAsCustomer / signInAsAdmin).
 *
 * NOTE: Phase 2+ adds new tables — append their deleteMany() calls to this list
 * (children first) so the harness keeps every test isolated.
 */
afterEach(async () => {
  await prisma.$transaction([
    // Phase 2 (motor financeiro) models — children first (FK order).
    prisma.loteUsoIngrediente.deleteMany(),
    prisma.lote.deleteMany(),
    prisma.produtoKitItem.deleteMany(),
    prisma.produto.deleteMany(),
    prisma.receitaIngrediente.deleteMany(),
    prisma.receita.deleteMany(),
    prisma.ingredienteCompra.deleteMany(),
    prisma.ingrediente.deleteMany(),
    prisma.configuracao.deleteMany(),
    // Phase 1 (foundation) models.
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ])
})
