import crypto from 'node:crypto'
import { prisma } from '@/lib/db/client'
import { logAudit } from '@/lib/audit/log'

/**
 * LGPD-05 — account deletion by ANONYMIZATION (never a hard DELETE).
 *
 * Why UPDATE and not DELETE (T-01-11-02): the fiscal/reservation history must be
 * retained for 5 years. The user ROW is kept (preserving the id and all FK
 * references) but the PII is overwritten: email -> opaque `@anon.invalid`
 * placeholder, name -> '[anonimizado]', telefone -> null, plus deletedAt /
 * anonymizedAt timestamps. Because the original email is replaced (not just
 * flagged), the address is freed for re-registration, and `checkEmailExists`
 * (Plan 08) already treats a `deletedAt` row as non-existent.
 *
 * Within the same transaction we delete the user's `account` rows (credentials —
 * so the password can no longer authenticate) and `session` rows (so any
 * existing session is revoked immediately — Pitfall #8 / T-01-11-03).
 *
 * The audit write runs AFTER the transaction commits (Architecture B6: audit is
 * append-only and must not be rolled back with the business TX). IP/UA arrive
 * already sha256-hashed from the route.
 */
export async function anonymizeUser(userId: string, ipHash?: string, uaHash?: string) {
  await prisma.$transaction(async (tx) => {
    const placeholderEmail = `deleted-${crypto.randomUUID()}@anon.invalid`

    await tx.user.update({
      where: { id: userId },
      data: {
        email: placeholderEmail,
        name: '[anonimizado]',
        telefone: null,
        deletedAt: new Date(),
        anonymizedAt: new Date(),
      },
    })

    // Apaga credenciais (não dá pra logar depois).
    await tx.account.deleteMany({ where: { userId } })

    // Apaga sessões — revoga qualquer sessão antiga ainda aberta (Pitfall #8).
    await tx.session.deleteMany({ where: { userId } })
  })

  // Audit FORA da TX (append-only, não rola back junto — Architecture B6).
  await logAudit({
    actorType: 'customer',
    actorId: userId,
    action: 'customer_account_deleted',
    metadata: { reason: 'self-service-lgpd' },
    ipHash,
    uaHash,
  })
}
