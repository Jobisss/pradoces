import { render } from '@react-email/render'
import { Html, Body, Container, Heading, Text, Button } from '@react-email/components'
import { resend } from './resend'

/**
 * Email-verification template + send function (AUTH-04).
 *
 * Copy is the literal pt-BR voice from UI-SPEC (§Auth flow copy / PATTERNS §2.10).
 * The "24 horas" promise in the footer is enforced by
 * `emailVerification.expiresIn = 60 * 60 * 24` in `lib/auth/server.ts`.
 *
 * First React Email template of the project — Phase 4 templates
 * (send-reservation-confirmed, send-points-earned) follow this same skeleton.
 */
function VerifyEmail({ url }: { url: string }) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Confirma seu email pra terminar o cadastro</Heading>
          <Text>A gente só quer ter certeza que esse email é seu mesmo.</Text>
          <Button href={url}>Confirmar email</Button>
          <Text>O link vale por 24 horas. Se já passou, é só fazer cadastro de novo.</Text>
        </Container>
      </Body>
    </Html>
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
