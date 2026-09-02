import { IconeSacola, IconeConversa, IconePatinha } from '@/components/home/motivos'
import type { ConfigPublica } from '@/lib/config/publica'

/**
 * "Como funciona" — o único bloco da home que serve exclusivamente o visitante
 * que nunca comprou.
 *
 * O site é de RESERVA, não de checkout (PROJECT.md), e isso nunca era explicado
 * em lugar nenhum: quem cai aqui pela primeira vez não sabe se está comprando,
 * se vai pagar agora, nem como recebe. Três passos resolvem.
 *
 * O passo 3 lê `entregaAtiva`/`pixAtivo` do config em vez de descrever o fluxo
 * padrão e pronto: os dois nascem desligados, e prometer entrega ou Pix sem que
 * a mãe tenha configurado seria vender serviço inexistente. Ligando, a home
 * passa a contar a verdade nova sem precisar de deploy.
 */
export function ComoFunciona({ config }: { config: ConfigPublica }) {
  const passos = [
    {
      Icone: IconeSacola,
      titulo: 'Escolhe e reserva',
      texto: 'Monta o pedido aqui no site. Você não paga nada agora — só segura o doce.',
    },
    {
      Icone: IconeConversa,
      titulo: 'Ela confirma no WhatsApp',
      texto: 'A Luizinha responde com o dia e a hora certinha pra você buscar.',
    },
    {
      Icone: IconePatinha,
      titulo: config.entregaAtiva ? 'Retira ou recebe' : 'Retira e paga na hora',
      texto: [
        config.entregaAtiva ? 'Busca no combinado ou pede entrega.' : 'Pega fresquinho no dia combinado.',
        config.pixAtivo ? 'Paga no Pix ou direto com ela.' : 'Acerta direto com ela.',
        'Seus pontos caem na conta.',
      ].join(' '),
    },
  ]

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-16">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        Como funciona
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        Aqui você reserva. Não é loja — é a Luizinha separando o seu.
      </p>

      <ol className="mt-5 grid gap-2.5 md:mt-7 md:grid-cols-3 md:gap-6">
        {passos.map(({ Icone, titulo, texto }, i) => (
          <li
            key={titulo}
            className="flex gap-3.5 rounded-xl bg-card p-4 shadow-doce-baixa md:flex-col md:gap-0 md:p-6"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-foreground md:size-13">
              <Icone className="size-5.5 md:size-6.5" />
            </div>
            <div className="min-w-0">
              <p className="hidden text-xs font-semibold tracking-widest text-muted-foreground uppercase md:mt-4 md:block">
                Passo {i + 1}
              </p>
              <h3 className="font-display text-lg font-semibold text-foreground md:mt-1 md:text-xl">
                <span className="md:hidden">{i + 1}. </span>
                {titulo}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground md:mt-2 md:text-[0.9375rem]">
                {texto}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
