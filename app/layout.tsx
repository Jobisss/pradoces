import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Fraunces } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/toaster'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Fraunces (variable) — usado SÓ no wordmark "Luizinha Confeitaria" (UI-SPEC §Typography),
// exposto como `--font-fraunces` → `--font-display` em globals.css (utilitário font-display).
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Luizinha Confeitaria',
  description: 'Reserve os doces caseiros da Luizinha — feitos em casa, com carinho de vizinha.',
}

// viewport-fit=cover trata as safe areas do iOS. Sem maximumScale/userScalable:
// a11y exige permitir zoom (clientela 50+, UI-SPEC §Interaction).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/**
 * Root layout — só html/body + fontes + Toaster global. O shell visual (Header/Footer)
 * vive no route group (public) (D-03): assim o group (admin) tem shell próprio sem
 * footer. Idioma pt-BR (PROJECT.md "pt-BR único").
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
