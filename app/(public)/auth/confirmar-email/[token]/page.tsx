import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/client'
import { logAudit } from '@/lib/audit/log'
import { Button } from '@/components/ui/button'

/**
 * Landing de confirmação de email (AUTH-04 / AUTH-11, F2).
 *
 * RSC: `await params` (Next 16 async), chama auth.api.verifyEmail({ query }) e:
 *   - sucesso -> mensagem de boas-vindas + grava o evento de verificação no audit.
 *   - token expirado/inválido -> "Esse link expirou..." + CTA pra reenviar.
 *
 * verifyEmail retorna apenas { status }, então o actorId do audit é derivado do
 * claim `email` do token (JWT Better Auth) — best-effort; cai pra null se o
 * formato mudar, sem nunca quebrar a confirmação.
 */

function emailFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: unknown
    }
    return typeof json.email === 'string' ? json.email : null
  } catch {
    return null
  }
}

export default async function ConfirmarEmailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const h = await nextHeaders()

  let verified = false
  try {
    const res = await auth.api.verifyEmail({ query: { token }, headers: h })
    verified = (res as { status?: boolean } | void)?.status !== false
  } catch {
    verified = false
  }

  if (verified) {
    // Stamp our own emailVerifiedAt + audit (AUTH-11). actorId best-effort from token.
    const email = emailFromToken(token)
    const user = email
      ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      : null
    if (user && !user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      })
    }
    await logAudit({
      actorType: 'customer',
      actorId: user?.id ?? null,
      action: 'customer_email_verified',
      rawIp: h.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      rawUa: h.get('user-agent') ?? undefined,
    })
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      {verified ? (
        <div className="space-y-6 text-center">
          <h1 className="text-2xl font-semibold md:text-3xl">Email confirmado. Bem-vinda(o)!</h1>
          <p className="text-base text-muted-foreground">
            Tudo certo com sua conta. Agora é só entrar pra começar a reservar.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/entrar">Entrar agora</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6 text-center">
          <h1 className="text-2xl font-semibold md:text-3xl">Esse link expirou</h1>
          <p className="text-base text-muted-foreground">
            Esse link expirou. Sem problema — pede um novo.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/cadastro">Reenviar email de confirmação</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
