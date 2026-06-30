import crypto from 'node:crypto'
import { prisma } from '@/lib/db/client'
import { env } from '@/lib/env'

/**
 * Append-only audit-log writer (AUTH-11 foundation — first-instance).
 *
 * The whole phase writes through this helper. It "absorbs" the hashing of
 * IP/User-Agent so call sites can pass the raw values and never have to
 * remember to hash them: IP/UA are persisted ONLY as a keyed HMAC-SHA256 hex,
 * never as plaintext (T-01-04-02 / Pitfall #9 mitigation).
 *
 * ME-01: a keyed HMAC (server pepper `AUDIT_HASH_PEPPER`) is used instead of a
 * bare sha256 — the IPv4 space (~4.3B) and the common-UA set are small enough
 * that an attacker with DB read access could exhaustively reverse a plain hash.
 * The pepper makes the mapping not brute-forceable without the server secret.
 *
 * `actorId` maps to an `@db.Uuid` column — pass a valid UUID for a real actor
 * or `null` for system/CLI events (e.g. `admin_seed_via_cli`).
 *
 * Phase 1 actions: admin_login, admin_seed_via_cli,
 * admin_password_reset_via_cli, customer_signup, customer_email_verified,
 * customer_password_reset, customer_account_deleted. Phase 2+ adds actions
 * without a schema migration (action is a free String).
 */
export async function logAudit(input: {
  actorType: 'admin' | 'customer' | 'system' | 'cli'
  actorId: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown>
  /** Pre-computed HMAC hex (use `hashPii`); takes precedence over rawIp. */
  ipHash?: string
  /** Pre-computed HMAC hex (use `hashPii`); takes precedence over rawUa. */
  uaHash?: string
  /** Raw client IP — hashed here, NEVER stored plaintext (Pitfall #9). */
  rawIp?: string
  /** Raw User-Agent — hashed here, NEVER stored plaintext. */
  rawUa?: string
}) {
  const ipHash = input.ipHash ?? (input.rawIp ? hashPii(input.rawIp) : undefined)
  const uaHash = input.uaHash ?? (input.rawUa ? hashPii(input.rawUa) : undefined)

  return prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata as never,
      ipHash,
      uaHash,
    },
  })
}

/**
 * Keyed HMAC-SHA256 of a low-entropy PII value (IP / User-Agent). The server
 * pepper (`AUDIT_HASH_PEPPER`) makes the hash non-reversible by exhaustive
 * search (ME-01). Every audit hash — here and at call sites (e.g. the
 * /api/me/delete route) — MUST route through this single helper so the keying
 * stays consistent.
 */
export function hashPii(s: string): string {
  return crypto.createHmac('sha256', env.AUDIT_HASH_PEPPER).update(s).digest('hex')
}
