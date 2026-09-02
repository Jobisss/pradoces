import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TexturaMotivos } from '@/components/home/motivos'
import type { ConfigPublica } from '@/lib/config/publica'

const pontosFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/**
 * Faixa de fidelidade (PT-01/05) — o único lugar onde o programa de pontos
 * aparece pra quem ainda não entrou.
 *
 * Antes disso, pontos/resgates/sorteios viviam inteiramente atrás do login, em
 * `/minha-conta/*`: quem nunca criou conta não tinha como saber que existiam —
 * apesar de fidelizar a clientela do bairro ser o core value do projeto
 * (.planning/PROJECT.md).
 *
 * Só pontos, de propósito. Sorteio tem regulamento, prazo e termos próprios
 * (`/termos-sorteio`) e não cabe em três linhas sem virar promessa mal
 * explicada.
 *
 * A taxa e a validade NUNCA são escritas na mão: a mãe edita as duas em Ajustes,
 * e um número congelado no JSX vira mentira no dia em que ela mexer.
 */
export function Fidelidade({ config, logado }: { config: ConfigPublica; logado: boolean }) {
  const taxa = Number(config.pontosPorReal)
  if (taxa <= 0) return null // programa desligado — não promete o que não paga

  const pontos = pontosFmt.format(taxa)
  const meses = config.pontosExpiracaoMeses

  return (
    <section className="relative overflow-hidden border-y border-primary/45 bg-muted">
      <TexturaMotivos
        id="motivos-fidelidade"
        cor="var(--color-foreground)"
        opacidade={0.07}
        className="absolute inset-0 size-full"
      />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8 md:py-14">
        <div className="md:flex-1">
          <h2 className="max-w-[18ch] font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-balance text-foreground md:text-4xl">
            Cada real vira ponto. Ponto vira doce.
          </h2>
          <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-foreground md:mt-4 md:text-[1.0625rem]">
            A cada <strong className="font-semibold">R$ 1</strong> reservado você junta{' '}
            <strong className="font-semibold">
              {pontos} {taxa === 1 ? 'ponto' : 'pontos'}
            </strong>
            . Quando der, troca por doce de graça — sem sorteio, sem pegadinha. Os pontos valem por{' '}
            <strong className="font-semibold">
              {meses} {meses === 1 ? 'mês' : 'meses'}
            </strong>
            .
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 md:items-center">
          {logado ? (
            <Button
              asChild
              variant="outline"
              className="h-12 border-foreground/25 bg-card px-6 text-base font-semibold"
            >
              <Link href="/minha-conta/pontos">Ver meus pontos</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                className="h-12 bg-foreground px-6 text-base font-semibold text-background hover:bg-foreground/90"
              >
                <Link href="/cadastro">Criar minha conta</Link>
              </Button>
              <span className="text-center text-sm text-muted-foreground">Leva menos de um minuto</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
