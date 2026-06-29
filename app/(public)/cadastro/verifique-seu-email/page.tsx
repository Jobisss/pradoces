import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Confira seu email — Doces Valentina',
}

/**
 * Tela genérica pós-signup (F1): o cadastro disparou o email de confirmação
 * (Better Auth -> Resend). Não revela nada sensível — só orienta o cliente a
 * abrir o link. A confirmação de fato acontece em /auth/confirmar-email/[token].
 */
export default function VerifiqueSeuEmailPage() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold md:text-3xl">Confere seu email pra terminar</h1>
        <p className="text-base text-muted-foreground">
          A gente acabou de mandar um link de confirmação pro endereço que você cadastrou. Abre o
          email e clica no botão — aí sua conta fica prontinha.
        </p>
        <p className="text-sm text-muted-foreground">
          Não chegou em alguns minutos? Dá uma olhada na caixa de spam. O link vale por 24 horas.
        </p>
      </div>
    </div>
  )
}
