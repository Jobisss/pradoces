import { redirect } from 'next/navigation'

/**
 * Ponte pro link do email (AUTH-05 bugfix). O Better Auth valida o token no
 * seu próprio endpoint (`/api/auth/reset-password/:token`) e SÓ DEPOIS
 * redireciona pra cá com `?token=` (ou `?error=INVALID_TOKEN` se expirou) —
 * nunca com o token no path. A página que sabe montar o form fica em
 * `/redefinir-senha/[token]`, então essa rota existe só pra pegar o token da
 * query string e completar o redirect. Sem ela, todo link de email caía em
 * 404 (não existia `page.tsx` neste segmento).
 */
export default async function RedefinirSenhaEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams

  if (!token || error) {
    redirect('/esqueci-minha-senha?erro=1')
  }

  redirect(`/redefinir-senha/${token}`)
}
