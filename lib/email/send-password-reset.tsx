import { render } from '@react-email/render'
import { Html, Body, Container, Heading, Text, Button } from '@react-email/components'
import { resend } from './resend'

/**
 * Password-reset template + send function (AUTH-05).
 *
 * Same skeleton as send-verification.tsx; copy is the literal pt-BR voice from
 * UI-SPEC (§Auth flow copy / PATTERNS §2.11). Footer promises "1 hora",
 * consistent with `resetPasswordTokenExpiresIn = 3600` (OWASP) in
 * `lib/auth/server.ts`.
 */
function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Pediu pra trocar a senha?</Heading>
          <Text>
            Clica no botão abaixo pra escolher uma nova. Se não foi você, pode ignorar — sua
            senha continua a mesma.
          </Text>
          <Button href={url}>Criar senha nova</Button>
          <Text>O link vale por 1 hora.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export async function sendPasswordResetEmail({ to, url }: { to: string; url: string }) {
  const html = await render(<ResetPasswordEmail url={url} />)
  return resend.emails.send({
    from: 'Luizinha Confeitaria <nao-responda@luizinhaconfeitaria.com.br>',
    to,
    subject: 'Recuperar sua senha — Luizinha Confeitaria',
    html,
  })
}
