import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de uso — Luizinha Confeitaria',
}

/** Versão do aceite (LGPD-02) — espelha User.termsVersion. */
const TERMS_VERSION = 'v1.0-shell'
const VIGENCIA = '30 de abril de 2026'

/**
 * Termos de uso (LGPD-02) — shell estrutural versionado.
 *
 * Phase 1 entrega o shell pt-BR; revisão jurídica leve fica para v1.x antes do launch
 * público (CONTEXT.md "Claude's Discretion"). O fluxo de cadastro não bloqueia por
 * causa do placeholder — o checkbox + versionamento (TERMS_VERSION) funcionam normal.
 */
export default function TermosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-6 py-12 text-foreground">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold md:text-3xl">Termos de uso</h1>
        <p className="text-base text-muted-foreground">
          Estes são os termos que valem desde {VIGENCIA}. Se mudar, a gente avisa por email.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">O que é a Luizinha Confeitaria</h2>
        <p className="text-base">
          A Luizinha Confeitaria é um site de reserva dos doces caseiros que a Luizinha produz. Você
          reserva com antecedência e combina a retirada — não é uma loja com pagamento online.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Sua conta</h2>
        <p className="text-base">
          Você precisa ter 18 anos ou mais (ou autorização de quem cuida de você) e dar dados
          verdadeiros pra que a Luizinha consiga te avisar quando o pedido estiver pronto.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Reservas e pontos</h2>
        <p className="text-base">
          Reservar é um combinado de boa-fé: a Luizinha separa os doces e te chama no WhatsApp.
          Os pontos de fidelidade são um agrado e podem mudar de regra — a gente sempre avisa antes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Seus dados</h2>
        <p className="text-base">
          A gente cuida dos seus dados como descrito na{' '}
          <a href="/privacidade" className="text-primary underline underline-offset-2">
            política de privacidade
          </a>
          . Dúvidas? Escreve pra dpo@luizinhaconfeitaria.com.br.
        </p>
      </section>

      <footer className="border-t border-border pt-4 text-sm text-muted-foreground">
        Versão {TERMS_VERSION} · vigente desde {VIGENCIA}
      </footer>
    </article>
  )
}
