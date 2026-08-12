import { render } from '@react-email/render'
import { resend } from './resend'
import { EmailLayout, EmailBodyText, EmailButton, EmailFinePrint } from './components/layout'

/**
 * Password-reset template + send function (AUTH-05).
 *
 * Copy é a voz pt-BR literal da UI-SPEC (§Auth flow copy / PATTERNS §2.11).
 * Rodapé promete "1 hora", consistente com `resetPasswordTokenExpiresIn = 3600`
 * (OWASP) em `lib/auth/server.ts`. Visual usa `EmailLayout` (paleta do brand
 * kit) — mesmo shell de `send-verification.tsx`.
 */
function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Link pra criar uma senha nova" heading="Pediu pra trocar a senha?">
      <EmailBodyText>
        Clica no botão abaixo pra escolher uma nova. Se não foi você, pode ignorar — sua senha
        continua a mesma.
      </EmailBodyText>
      <EmailButton href={url}>Criar senha nova</EmailButton>
      <EmailFinePrint>O link vale por 1 hora.</EmailFinePrint>
    </EmailLayout>
  )
}

export async function sendPasswordResetEmail({ to, url }: { to: string; url: string }) {
  const html = await render(<ResetPasswordEmail url={url} />)
  return resend.emails.send({
    from: 'Luizinha Confeitaria <nao-responda@luizinha-confeitaria.com.br>',
    to,
    subject: 'Recuperar sua senha — Luizinha Confeitaria',
    html,
  })
}
