import { prisma } from '@/lib/db/client'

/**
 * LGPD-04 — portability export of a customer's own data.
 *
 * Phase 1 covers only the auth/cadastro record; Phase 4 adds reservas + pontos,
 * Phase 5 adds sorteios + resgates (the empty arrays are the forward-compatible
 * envelope shape, so the JSON schema stays stable across phases).
 *
 * Security (T-01-11-04): the `select` is an EXPLICIT whitelist — never
 * `select: undefined` and never `include`. Password hashes, tokens and the
 * Better Auth admin/ban fields can therefore never leak into the export. The
 * caller passes `session.user.id` (route enforces auth) so a user can only ever
 * export their own record (T-01-11-01).
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      telefone: true,
      isAdult: true,
      termsVersion: true,
      termsAcceptedAt: true,
      privacyVersion: true,
      privacyAcceptedAt: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    versao_export: '1.0',
    gerado_em: new Date().toISOString(),
    cadastro: user,
    reservas: [] as unknown[], // Phase 4
    pontos: [] as unknown[], // Phase 4
  }
}
