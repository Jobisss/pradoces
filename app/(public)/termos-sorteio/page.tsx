import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos do sorteio — Luizinha Confeitaria',
}

/**
 * SORT-08 — shell estrutural, MESMO padrão do /termos (LGPD-02): cobre a
 * estrutura exigida pela Lei 5.768/71 pra sorteio promocional vinculado a
 * técnica de venda, mas é um placeholder — revisão jurídica leve (contador/
 * advogado) é bloqueio explícito antes de abrir sorteio pro público de
 * verdade (ROADMAP.md Phase 5 Pitfalls). Não é assessoria jurídica.
 */
export default function TermosSorteioPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-6 py-12 text-foreground">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold md:text-3xl">Termos do sorteio</h1>
        <p className="text-base text-muted-foreground">
          Como funcionam os sorteios da Luizinha Confeitaria.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Sem custo direto em dinheiro</h2>
        <p className="text-base">
          Participar de um sorteio nunca custa dinheiro. Você troca pontos ganhos ao reservar doces
          por chances — os pontos não podem ser comprados, só ganhos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Como o vencedor é escolhido</h2>
        <p className="text-base">
          No prazo final, o sistema sorteia aleatoriamente entre quem comprou chance. Quanto mais
          chances, maior a probabilidade — nunca menos que isso. O sorteio guarda um código de
          auditoria (seed) e a lista completa de participantes daquele momento, então o resultado
          pode ser conferido depois.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">O vencedor</h2>
        <p className="text-base">
          O vencedor é avisado assim que o sorteio encerra e combina a retirada do prêmio direto com
          a Luizinha.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
        <h2 className="text-lg font-semibold">Aviso</h2>
        <p className="text-sm text-muted-foreground">
          Esta página é um modelo estrutural e não substitui orientação jurídica. Antes de abrir
          qualquer sorteio para o público, a Luizinha Confeitaria confirma o enquadramento com um
          contador ou advogado (Lei 5.768/71).
        </p>
      </section>
    </article>
  )
}
