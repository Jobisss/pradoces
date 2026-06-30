import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Link enviado — Doces Valentina',
}

/**
 * Confirmação genérica pós-pedido de reset (AUTH-07). Mesma mensagem para
 * qualquer email — não revela existência de conta (anti-enumeração). Destino
 * único de /esqueci-minha-senha, independentemente do input.
 */
export default function EnviadoPage() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <div className="space-y-4 text-center">
        <h1 className="font-display text-3xl font-semibold">Verifique seu email</h1>
        <p className="text-base text-muted-foreground">
          Se esse email estiver cadastrado, você vai receber um link em alguns minutos. Verifique
          também o spam.
        </p>
      </div>
    </div>
  )
}
