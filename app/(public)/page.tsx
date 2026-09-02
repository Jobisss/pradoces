import { headers as nextHeaders } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { listarProdutosAtivos, listarCategoriasAtivas } from '@/lib/catalogo/produtos'
import { configPublica } from '@/lib/config/publica'
import { campanhaAtiva } from '@/lib/campanhas/definicoes'
import { ProdutoCard } from '@/components/produto-card'
import { Abertura } from '@/components/home/abertura'
import { Filtros } from '@/components/home/filtros'
import { Fidelidade } from '@/components/home/fidelidade'
import { ComoFunciona } from '@/components/home/como-funciona'
import { OndeRetirar } from '@/components/home/onde-retirar'
import { TambemVendemos } from '@/components/home/tambem-vendemos'
import { IconeCupcake } from '@/components/home/motivos'

/**
 * Vitrine pública (CAT-01/04/08).
 *
 * A ordem das seções é a decisão central da página: PRODUTO PRIMEIRO. A leitora
 * principal é a vizinha que já compra e chega pelo link do WhatsApp querendo ver
 * o que tem hoje — ela encontra o estoque sem rolar. O visitante que nunca
 * comprou rola naturalmente e encontra, abaixo, o que precisa pra decidir:
 * fidelidade, como funciona a reserva, e onde retirar. Duas audiências em
 * camadas, sem obrigar a primeira a passar pelo discurso da segunda toda visita.
 *
 * SAZON-04: o filtro de campanha é opt-in (`?campanha=1`) — nunca esconde o
 * resto do catálogo por conta própria.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; campanha?: string }>
}) {
  const { categoria, campanha: filtroCampanhaParam } = await searchParams
  const campanha = campanhaAtiva()
  const filtroCampanha = filtroCampanhaParam === '1' && campanha ? campanha.id : undefined

  // Tudo em paralelo: são quatro idas independentes ao banco e serializar
  // atrasaria o TTFB da página mais visitada do site sem ganho nenhum.
  const [produtos, categorias, config, session] = await Promise.all([
    listarProdutosAtivos(categoria, filtroCampanha),
    listarCategoriasAtivas(),
    configPublica(),
    auth.api.getSession({ headers: await nextHeaders() }),
  ])

  // Esgotado não fica misturado no meio dos outros — a vitrine principal só
  // mostra o que dá pra reservar agora; o resto vira lista compacta no pé.
  const disponiveis = produtos.filter((p) => p.disponivel)
  const esgotados = produtos.filter((p) => !p.disponivel)

  const filtrando = Boolean(categoria || filtroCampanha)

  return (
    <>
      <Abertura />

      <section className="mx-auto max-w-5xl px-4 pt-6 md:px-8 md:pt-8">
        <Filtros
          categorias={categorias}
          categoriaAtiva={categoria}
          campanhaNome={campanha?.nome ?? null}
          filtroCampanhaLigado={Boolean(filtroCampanha)}
        />

        {produtos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <IconeCupcake className="size-14 text-accent-soft" />
            <p className="text-base font-medium text-foreground">
              {filtroCampanha
                ? `Nenhum doce de ${campanha?.nome} por enquanto`
                : categoria
                  ? 'Nada nessa categoria por enquanto'
                  : 'Ainda não tem doces por aqui'}
            </p>
            <p className="text-sm text-muted-foreground">
              Volta mais tarde — a Luizinha tá sempre cozinhando.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-baseline justify-between gap-4 md:mt-8">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {filtrando ? 'O que encontramos' : 'O que tem hoje'}
              </h2>
              {disponiveis.length > 0 && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  {disponiveis.length} {disponiveis.length === 1 ? 'doce' : 'doces'}
                  <span className="hidden sm:inline"> pra reservar</span>
                </span>
              )}
            </div>

            {disponiveis.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:grid-cols-3 md:gap-6">
                {disponiveis.map((p) => (
                  <li key={p.id}>
                    <ProdutoCard p={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <IconeCupcake className="size-12 text-accent-soft" />
                <p className="text-sm text-muted-foreground">
                  Tudo esgotado por agora — dá uma olhada no que a Luizinha também faz, mais abaixo.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <div className="mt-12 md:mt-16">
        <Fidelidade config={config} logado={Boolean(session)} />
      </div>

      <ComoFunciona config={config} />
      <OndeRetirar />
      <TambemVendemos produtos={esgotados} />
    </>
  )
}
