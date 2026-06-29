/**
 * Shared test fixtures.
 *
 * Wave 0 (Plan 01) ships EXPORTED stubs so downstream test files can import these
 * helpers by name without TypeScript errors. The real implementations land later:
 *   - Plan 02 (Prisma): createTestUser, truncateAll
 *   - Plan 03 (Better Auth): signInAsCustomer, signInAsAdmin, generateResetToken
 *
 * Each stub throws if invoked before its owning plan implements it, so a test that
 * accidentally relies on an unimplemented fixture fails loudly instead of silently.
 */

export async function createTestUser(opts?: {
  email?: string
  role?: 'admin' | 'customer'
}): Promise<{ id: string; email: string }> {
  throw new Error('Plan 02 implements this once Prisma client + schema land')
}

export async function signInAsCustomer(userId: string): Promise<{ cookie: string }> {
  throw new Error('Plan 03 implements this once Better Auth lands')
}

export async function signInAsAdmin(userId: string): Promise<{ cookie: string }> {
  throw new Error('Plan 03 implements this once Better Auth lands')
}

export async function generateResetToken(userId: string): Promise<string> {
  throw new Error('Plan 03 implements this once Better Auth lands')
}

export async function truncateAll(): Promise<void> {
  throw new Error('Plan 02 implements this once Prisma client lands')
}
