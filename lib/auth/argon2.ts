import { hash, verify } from '@node-rs/argon2'

/**
 * argon2id password hashing — OWASP "profile 2" parameters (T-Hash-01).
 *
 * Locked at this layer so the whole project shares one tuning. Profile 2
 * (m=19 MiB, t=2, p=1) matches the ~R$30/mo Hostinger VPS RAM budget
 * (RESEARCH.md A4); bumping to a heavier profile when the VPS upgrades touches
 * ONLY this file.
 *
 * NOTE: `algorithm: 2` === `Algorithm.Argon2id` in @node-rs/argon2. We pass the
 * literal so this stays a plain data object (no enum import at the hot path).
 */
const argon2Opts = {
  memoryCost: 19456, // OWASP profile 2: 19 MiB
  timeCost: 2,
  parallelism: 1,
  algorithm: 2 as const, // Argon2id
}

export const hashPassword = (pwd: string): Promise<string> => hash(pwd, argon2Opts)

export const verifyPassword = (storedHash: string, pwd: string): Promise<boolean> =>
  verify(storedHash, pwd, argon2Opts)
