import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de privacidade — Luizinha Confeitaria',
}

/** Versão do aceite (LGPD-02) — espelha User.privacyVersion. */
const PRIVACY_VERSION = 'v1.0-shell'
const VIGENCIA = '30 de abril de 2026'

/**
 * Política de privacidade descritiva (LGPD-03 — art. 9 + 18) — conteúdo verbatim de
 * RESEARCH §LGPD-03. Lista os OPERADORES REAIS com acesso aos dados (Resend EUA,
 * Cloudflare EUA, Hostinger Lituânia) + base legal (art. 7) + retenção fiscal de 5 anos
 * + direitos (art. 18) + DPO (LGPD-06). Sem operadores reais a política violaria a lei
 * (T-01-07-03). Links internos usam <a> simples (navegação completa de página legal).
 */
export default function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-6 py-12 text-foreground">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold md:text-3xl">
          Política de Privacidade — Luizinha Confeitaria
        </h1>
        <p className="text-base text-muted-foreground">
          A gente coleta o mínimo pra fazer a reserva e te avisar quando tá pronto. Aqui tá quem
          tem acesso ao quê.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">O que coletamos</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>Nome, email, telefone (no cadastro)</li>
          <li>Histórico de reservas e pontos (quando você usar o site)</li>
          <li>IP e user-agent (em logs de acesso, hasheados — não plaintext)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Por que coletamos (base legal — LGPD art. 7)</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>Consentimento (cadastro voluntário)</li>
          <li>Execução de contrato (atender sua reserva)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          Quem mais tem acesso (operadores reais — LGPD art. 5 inc. VII)
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>
            <strong>Resend Inc. (Estados Unidos)</strong> — envia nossos emails. Transferência
            internacional baseada em cláusulas contratuais padrão (LGPD art. 33 inc. II).
          </li>
          <li>
            <strong>Cloudflare, Inc. (Estados Unidos)</strong> — protege o site contra ataques.
            Mesmas garantias.
          </li>
          <li>
            <strong>Hostinger International Ltd. (Lituânia)</strong> — hospeda o servidor. Mesmas
            garantias.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Por quanto tempo guardamos</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>5 anos para fins fiscais (Decreto 9.580/2018 art. 195).</li>
          <li>
            Depois desse prazo, anonimizamos (seus dados pessoais viram placeholders; o histórico
            de venda permanece anônimo).
          </li>
          <li>Você pode pedir exclusão antes — ver &ldquo;Seus direitos&rdquo;.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Seus direitos (LGPD art. 18)</h2>
        <ul className="list-disc space-y-1 pl-5 text-base">
          <li>
            Saber o que temos sobre você → botão &ldquo;Baixar meus dados em JSON&rdquo; em{' '}
            <a
              href="/minha-conta/meus-dados"
              className="text-primary underline underline-offset-2"
            >
              /minha-conta/meus-dados
            </a>
          </li>
          <li>
            Apagar seus dados → botão &ldquo;Excluir minha conta&rdquo; em{' '}
            <a href="/minha-conta/excluir" className="text-primary underline underline-offset-2">
              /minha-conta/excluir
            </a>
          </li>
          <li>Corrigir → escreva pra dpo@luizinha-confeitaria.com.br</li>
          <li>
            Reclamar à ANPD →{' '}
            <a
              href="https://www.gov.br/anpd"
              className="text-primary underline underline-offset-2"
            >
              www.gov.br/anpd
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">DPO (Encarregada de Tratamento)</h2>
        <p className="text-base">
          <a
            href="mailto:dpo@luizinha-confeitaria.com.br"
            className="text-primary underline underline-offset-2"
          >
            dpo@luizinha-confeitaria.com.br
          </a>{' '}
          — responde em até 15 dias.
        </p>
      </section>

      <footer className="border-t border-border pt-4 text-sm text-muted-foreground">
        Versão {PRIVACY_VERSION} · vigente desde {VIGENCIA}
      </footer>
    </article>
  )
}
