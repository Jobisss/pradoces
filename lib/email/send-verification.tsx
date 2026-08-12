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

export async function sendVerificationEmail({ to, url }: { to: string; url: string }) {
  const html = await render(<VerifyEmail url={url} />)
  return resend.emails.send({
    from: 'Luizinha Confeitaria <nao-responda@luizinha-confeitaria.com.br>',
    to,
    subject: 'Confirma seu email — Luizinha Confeitaria',
    html,
  })
}
