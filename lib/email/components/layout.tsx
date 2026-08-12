import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'

/**
 * Shell visual compartilhado pelos emails transacionais (AUTH-04/05, Phase 4
 * notificações). Paleta 1:1 com `app/globals.css` (brand kit Luizinha
 * Confeitaria) — não importa Tailwind aqui porque clientes de email ignoram
 * `<style>`/classes externas; tudo inline via os componentes do React Email.
 *
 * Logo via URL absoluta (`NEXT_PUBLIC_URL`) porque clientes de email não
 * resolvem caminhos relativos — mesmo arquivo usado no header do site
 * (`components/header.tsx`).
 */
const COLORS = {
  background: '#FFF3E6', // creme
  card: '#FFFFFF',
  text: '#6B3E26', // chocolate
  textMuted: '#7A5138',
  border: '#FFD6E2', // rosa-claro
  primary: '#F7B6C6', // rosa
  primaryText: '#6B3E26',
}

const siteUrl = (process.env.NEXT_PUBLIC_URL ?? 'https://luizinha-confeitaria.com.br').replace(
  /\/$/,
  '',
)

export function EmailLayout({
  preview,
  heading,
  children,
  footerNote,
}: {
  preview: string
  heading: string
  children: ReactNode
  footerNote?: string
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.background,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          padding: '32px 16px',
        }}
      >
        <Container style={{ maxWidth: 480, margin: '0 auto' }}>
          <Section style={{ textAlign: 'center', marginBottom: 20 }}>
            <Img
              src={`${siteUrl}/logo/logo-header.png`}
              alt="Luizinha Confeitaria"
              width={72}
              style={{ margin: '0 auto', display: 'block' }}
            />
          </Section>

          <Section
            style={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              padding: '36px 32px',
              textAlign: 'center',
            }}
          >
            <Heading
              as="h1"
              style={{
                color: COLORS.text,
                fontSize: 22,
                fontWeight: 600,
                margin: '0 0 12px',
                lineHeight: 1.3,
              }}
            >
              {heading}
            </Heading>

            {children}
          </Section>

          <Section style={{ textAlign: 'center', marginTop: 24 }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 13, margin: '0 0 4px' }}>
              {footerNote ?? 'Doces caseiros feitos com carinho — Luizinha Confeitaria'}
            </Text>
            <Hr style={{ borderColor: COLORS.border, margin: '12px 0' }} />
            <Text style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>
              Recebeu esse email sem pedir? Pode ignorar, nada muda na sua conta.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailBodyText({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: COLORS.text, fontSize: 15, lineHeight: 1.6, margin: '0 0 20px' }}>
      {children}
    </Text>
  )
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{
        backgroundColor: COLORS.primary,
        color: COLORS.primaryText,
        display: 'inline-block',
        padding: '14px 36px',
        borderRadius: 999,
        fontSize: 15,
        fontWeight: 600,
        textDecoration: 'none',
        margin: '4px 0 20px',
      }}
    >
      {children}
    </a>
  )
}

export function EmailFinePrint({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: COLORS.textMuted, fontSize: 13, margin: 0 }}>{children}</Text>
  )
}
