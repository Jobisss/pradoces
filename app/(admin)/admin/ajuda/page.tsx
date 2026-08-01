import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ajuda — Luizinha Confeitaria',
}

const PALAVRAS_A_EVITAR = [
  'emagrece',
  'detox',
  'fortalece a imunidade',
  'cura',
  'trata',
  'previne doença',
  'medicinal',
  'terapêutico',
  'zero risco',
  'faz bem pra saúde',
]

/**
 * Página de ajuda estática — aviso ANVISA (PROD-10).
 *
 * v1 completa: só a página informativa. Linter no campo de descrição é
 * SEC-02, deferido pra v1.x (não implementar aqui — UI-SPEC "Out of Scope").
 */
export default function AjudaPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 text-foreground">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold md:text-3xl">Cuidados com o que escrever</h1>
      </header>

      <p className="text-base">
        Na descrição dos doces, evita prometer saúde — a ANVISA não permite alegação de benefício em
        alimento. Escreve o que ele É, não o que ele CURA.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Palavras pra evitar</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          {PALAVRAS_A_EVITAR.map((palavra) => (
            <li key={palavra}>{palavra}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Exemplo</h2>
        <p className="text-base">
          ✗ &ldquo;Brigadeiro fit que fortalece a imunidade&rdquo; → ✓ &ldquo;Brigadeiro com cacau
          70%, menos doce&rdquo;
        </p>
      </section>
    </article>
  )
}
