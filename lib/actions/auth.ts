'use server'

import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { logAudit } from '@/lib/audit/log'
import { rateLimitAuth, rateLimitForgotEmail } from '@/lib/ratelimit/memory'
import { SignupSchema, SigninSchema, ForgotSchema, ResetSchema } from '@/lib/validation/auth'

/**
 * Auth Server Actions (first-instance — PATTERNS §2.18, 7-step skeleton).
 *
 * Every mutating action: derive client context (Next 16 async headers) → consume
 * the in-process rate limiter as DEFENSE IN DEPTH (the PRIMARY limit against the
 * directly-reachable /api/auth catch-all is in proxy.ts / Plan 06 — do NOT remove
 * the consume here) → Zod parse → Better Auth API in try/catch with a GENERIC,
 * non-enumerating error (AUTH-07) → side effects (LGPD stamp, audit) → redirect.
 *
 * The shared `RateLimiterMemory` instances are the same ones the proxy uses, so a
 * brute-force flood is counted across both the boundary and the action.
 */

const RATE_LIMIT_COPY = 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.'
const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
// NOTA W3 — copy padrão de credencial inválida (não-enumerante, idêntica p/ email
// inexistente e senha errada). Literal compartilhado com o Plan 10 — não alterar.
const INVALID_CREDENTIALS = 'Email ou senha não conferem'
const FORGOT_GENERIC =
  'Se esse email estiver cadastrado, você vai receber um link em alguns minutos. Verifique também o spam.'
const LINK_EXPIRED = 'Esse link expirou. Pede um novo abaixo.'

const TERMS_VERSION = 'v1.0-shell'
const PRIVACY_VERSION = 'v1.0-shell'

export type AuthActionState = {
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  message?: string
  ok?: boolean
}

async function clientContext() {
  const h = await nextHeaders()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ua = h.get('user-agent') ?? undefined
  return { h, ip, ua }
}

/**
 * AUTH-01 / LGPD-01 / LGPD-02 / AUTH-11 — create the customer account.
 * role stays `customer` (Better Auth defaultRole); admin is CLI-only (Plan 09).
 */
export async function signupCustomer(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const { ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  const parsed = SignupSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    nome: String(formData.get('nome') ?? ''),
    telefone: String(formData.get('telefone') ?? ''),
    isAdult: formData.get('isAdult') === 'on' || formData.get('isAdult') === 'true',
    termsAccepted: formData.get('termsAccepted') === 'on' || formData.get('termsAccepted') === 'true',
  })
  if (!parsed.success) {
    return { error: 'Confere os campos abaixo.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.nome,
      },
    })
  } catch {
    // Generic — never reveal whether the email already exists (AUTH-07). The
    // intentional AUTH-03 "talvez digitou errado" leak lives in the UI step 1
    // (checkEmailExists), not here.
    return { error: GENERIC_SERVER_ERROR }
  }

  // Stamp telefone + versioned LGPD consent (LGPD-01/02). signUpEmail only writes
  // email/password/name, so the consent capture happens here on the fresh row.
  const now = new Date()
  const user = await prisma.user.update({
    where: { email: parsed.data.email },
    data: {
      telefone: parsed.data.telefone,
      isAdult: true,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
      privacyAcceptedAt: now,
    },
  })

  await logAudit({
    actorType: 'customer',
    actorId: user.id,
    action: 'customer_signup',
    rawIp: ip,
    rawUa: ua,
  })

  redirect('/cadastro/verifique-seu-email')
}

/**
 * AUTH-02 / AUTH-03 (F1) — email-first existence probe for cadastro step 1.
 * An anonymized account (deletedAt set) is reported as non-existent so the
 * customer can re-register with the same email. This is the ONE intentional,
 * documented enumeration surface (threat T-01-08-01) — it exists to reduce
 * duplicate accounts in a 50+ clientele.
 */
export async function checkEmailExists(email: string): Promise<{ exists: boolean }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { exists: false }
  const user = await prisma.user.findUnique({ where: { email: normalized } })
  if (!user || user.deletedAt) return { exists: false }
  return { exists: true }
}

/** AUTH-08 — customer login. Anti-enumeration generic error (AUTH-07). */
export async function signinUser(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const { h, ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  const parsed = SigninSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) return { error: INVALID_CREDENTIALS }

  try {
    await auth.api.signInEmail({
      headers: h,
      body: { email: parsed.data.email, password: parsed.data.password },
    })
  } catch {
    return { error: INVALID_CREDENTIALS }
  }

  redirect('/')
}

/**
 * AUTH-10 / AUTH-11 — admin login. Identical credential handling to signinUser,
 * plus: only an actual `role=admin` user is accepted, and a successful admin
 * sign-in writes an admin-login audit event (D-08: no email persisted, IP hashed).
 */
export async function signinAdmin(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const { h, ip, ua } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  const parsed = SigninSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) return { error: INVALID_CREDENTIALS }

  let result: Awaited<ReturnType<typeof auth.api.signInEmail>> | undefined
  try {
    result = await auth.api.signInEmail({
      headers: h,
      body: { email: parsed.data.email, password: parsed.data.password },
    })
  } catch {
    return { error: INVALID_CREDENTIALS }
  }

  const user = (result as { user?: { id: string; role?: string } } | undefined)?.user
  if (!user || user.role !== 'admin') {
    // Don't leak that the credentials were valid for a non-admin (anti-enum).
    return { error: INVALID_CREDENTIALS }
  }

  await logAudit({
    actorType: 'admin',
    actorId: user.id,
    action: 'admin_login',
    rawIp: ip,
    rawUa: ua,
  })

  redirect('/admin')
}

/**
 * AUTH-05 / AUTH-07 — password-reset request. ALWAYS returns the same generic
 * confirmation regardless of whether the email exists. Rate limited per-email
 * (3/15min) as anti-flood defense in depth.
 */
export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const rl = await rateLimitForgotEmail.consume(email || 'unknown').catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  const parsed = ForgotSchema.safeParse({ email })
  if (parsed.success) {
    try {
      await auth.api.requestPasswordReset({
        body: { email: parsed.data.email, redirectTo: '/redefinir-senha' },
      })
    } catch {
      // Swallow — never reveal whether the email exists (AUTH-07).
    }
  }

  // Same message for valid/invalid/existing/non-existing input.
  return { ok: true, message: FORGOT_GENERIC }
}

/** AUTH-05 — set a new password from a reset token (revokes sessions via Better Auth). */
export async function resetPassword(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const { ip } = await clientContext()
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: RATE_LIMIT_COPY }

  const parsed = ResetSchema.safeParse({
    token: String(formData.get('token') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? LINK_EXPIRED,
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.newPassword },
    })
  } catch {
    return { error: LINK_EXPIRED }
  }

  redirect('/entrar?reset=ok')
}
