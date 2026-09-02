import { WhatsappButton } from '@/components/whatsapp-button'
import { TexturaMotivos } from '@/components/home/motivos'

/**
 * Faixa de abertura da home.
 *
 * NÃO repete o nome da marca. O `Header` é sticky e já carrega o wordmark
 * (`logo-header.png` — que é a marca desenhada, melhor do que qualquer fonte
 * consegue imitar) durante a rolagem inteira; imprimir "Luizinha Confeitaria"
 * de novo 100px abaixo entulha em vez de reforçar. Aqui vai só a promessa.
 *
 * Fina de propósito: a leitora principal é a vizinha recorrente, que chega pelo
 * WhatsApp querendo saber o que tem hoje. Um hero de tela cheia empurraria o
 * produto pra fora da primeira dobra dela toda visita.
 */
export function Abertura() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-card/45 to-background">
      {/* Caramelo, não rosa: rosa a 8% sobre o creme é invisível. */}
      <TexturaMotivos id="motivos-abertura" cor="var(--color-caramelo)" className="absolute inset-0 size-full" />

      <div className="relative mx-auto max-w-5xl px-4 py-9 md:px-8 md:py-16">
        <h1 className="max-w-[15ch] font-display text-[2.125rem] leading-[1.1] font-semibold tracking-tight text-balance text-foreground md:text-5xl md:leading-[1.06]">
          Doce de verdade, feito na cozinha da Luizinha.
        </h1>
        <p className="mt-3.5 max-w-[46ch] text-base leading-relaxed text-muted-foreground md:mt-5 md:text-lg">
          Brownie, brigadeiro e bolo saindo do forno em quantidade pequena — do jeito que dá pra caprichar
          em cada um.
        </p>
        <WhatsappButton className="mt-5 h-12 w-full text-base font-semibold sm:w-auto sm:px-6 md:mt-7" />
      </div>
    </section>
  )
}
