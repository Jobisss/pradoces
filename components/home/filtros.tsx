import Link from 'next/link'
import { SparklesIcon } from 'lucide-react'

/**
 * Filtros da vitrine (CAT-01 + SAZON-04) numa faixa ÚNICA, rolável na horizontal.
 *
 * Antes eram duas fileiras de botão empilhadas — a da campanha e a das
 * categorias — antes do primeiro doce: três blocos de peso visual igual, e
 * nenhum deles o produto. A faixa rolável é o padrão que a clientela já usa
 * todo dia (iFood, Iaí, Instagram) e devolve altura pro que interessa.
 *
 * A campanha vem em primeiro e com o preenchimento mais forte (chocolate) —
 * único elemento com esse peso na faixa, então lê como destaque sem precisar de
 * uma linha só pra ela.
 *
 * Renderiza mesmo com 1 categoria só quando existe campanha: sem o chip, não
 * haveria como sair do filtro `?campanha=1`.
 */
export function Filtros({
  categorias,
  categoriaAtiva,
  campanhaNome,
  filtroCampanhaLigado,
}: {
  categorias: string[]
  categoriaAtiva?: string
  campanhaNome: string | null
  filtroCampanhaLigado: boolean
}) {
  if (categorias.length <= 1 && !campanhaNome) return null

  const base =
    'flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors'

  return (
    <nav aria-label="Filtrar a vitrine" className="relative">
      {/*
        `-mx-4 px-4` estende o trilho de rolagem até a borda da tela e devolve o
        respiro por dentro: assim o último chip encosta na borda ao rolar, em vez
        de parar 16px antes e parecer que a faixa acabou.
      */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1.5 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {campanhaNome && (
          <Link
            href={filtroCampanhaLigado ? '/' : '/?campanha=1'}
            aria-pressed={filtroCampanhaLigado}
            className={`${base} ${
              filtroCampanhaLigado
                ? 'bg-foreground text-background'
                : 'border border-foreground/25 bg-card text-foreground hover:bg-accent'
            }`}
          >
            <SparklesIcon className="size-4" aria-hidden />
            {campanhaNome}
          </Link>
        )}

        {categorias.length > 1 && (
          <>
            <Link
              href="/"
              aria-current={!categoriaAtiva && !filtroCampanhaLigado ? 'true' : undefined}
              className={`${base} ${
                !categoriaAtiva && !filtroCampanhaLigado
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              Todas
            </Link>
            {categorias.map((c) => (
              <Link
                key={c}
                href={`/?categoria=${encodeURIComponent(c)}`}
                aria-current={categoriaAtiva === c ? 'true' : undefined}
                className={`${base} ${
                  categoriaAtiva === c
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'border border-border bg-card text-foreground hover:bg-accent'
                }`}
              >
                {c}
              </Link>
            ))}
          </>
        )}
      </div>

      {/*
        Sinaliza que a faixa continua sem gastar altura com seta. `-right-4`
        acompanha o `-mx-4` do trilho: ancorado em `right-0` o fade pararia
        16px antes da borda da tela e deixaria uma tira nítida no canto.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -right-4 w-14 bg-linear-to-r from-transparent to-background md:hidden"
      />
    </nav>
  )
}
