import { render } from '@react-email/render'
import { resend } from './resend'
import { EmailLayout, EmailBodyText, EmailButton, EmailFinePrint } from './components/layout'

/**
 * Email-verification template + send function (AUTH-04).
 *
 * Copy é a voz pt-BR literal da UI-SPEC (§Auth flow copy / PATTERNS §2.10).
 * O "24 horas" no rodapé é garantido por `emailVerification.expiresIn =
 * 60 * 60 * 24` em `lib/auth/server.ts`. Visual usa `EmailLayout` (paleta do
 * brand kit) — mesmo shell de `send-password-reset.tsx`.
 */
function VerifyEmail({ url }: { url: string }) {
  return (
    <EmailLayout
      preview="Confirma seu email pra terminar o cadastro"
      heading="Confirma seu email pra terminar o cadastro"
    >
      <EmailBodyText>A gente só quer ter certeza que esse email é seu mesmo.</EmailBodyText>
      <EmailButton href={url}>Confirmar email</EmailButton>
      <EmailFinePrint>
        O link vale por 24 horas. Se já passou, é só fazer cadastro de novo.
      </EmailFinePrint>
    </EmailLayout>
  )
}

/**
 * O `url` que o Better Auth monta aqui aponta pro PRÓPRIO endpoint dele
 * (`/api/auth/verify-email?token=...`), que ao confirmar redireciona pra
 * `callbackURL` (default `/`, já que `signUpEmail` não passa um) — cai na
 * home sem contexto nenhum, sem dizer que já pode entrar. Já existe uma
 * landing pronta em `/auth/confirmar-email/[token]` (chama
 * `auth.api.verifyEmail` ela mesma e mostra "Entrar agora"), só nunca foi
 * usada — o link do email troca pra apontar direto pra ela.
 */
function linkDeConfirmacao(urlBetterAuth: string): string {
  const token = new URL(urlBetterAuth).searchParams.get('token')
  if (!token) return urlBetterAuth // formato inesperado — nunca deveria acontecer, mas não quebra o envio
  return `${new URL(urlBetterAuth).origin}/auth/confirmar-email/${token}`
}

export async function sendVerificationEmail({ to, url }: { to: string; url: string }) {
  const html = await render(<VerifyEmail url={linkDeConfirmacao(url)} />)
  return resend.emails.send({
    from: 'Luizinha Confeitaria <nao-responda@luizinha-confeitaria.com.br>',
    to,
    subject: 'Confirma seu email — Luizinha Confeitaria',
    html,
  })
}
