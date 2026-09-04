import Link from 'next/link'
import type Decimal from 'decimal.js'
import { TriangleAlert, CakeSlice, Gift, ChevronRight } from 'lucide-react'
import { margensCorrentesBatch } from '@/lib/custo/corrente'
import { Button } from '@/components/ui/button'
import { PageHeader, SegmentedNav, SurfaceCard, Meter, Chip, EmptyState } from '@/components/admin/ui'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type LinhaMargem = Awaited<ReturnType<typeof margensCorrentesBatch>>[number]

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'doces', label: 'Doces' },
  { value: 'kits', label: 'Kits' },
  { value: 'margem-baixa', label: 'Margem baixa' },
] as const

type Filtro = (typeof FILTROS)[number]['value']

function abaixoDoMinimo(l: LinhaMargem) {
  return l.margem !== null && l.margem.lessThan(l.minima)
}

/**
 * `margensCorrentesBatch` devolve UMA LINHA POR VARIAÇÃO. Renderizar isso
 * direto repetia o nome do produto uma vez por sabor — um brigadeiro com 8
 * recheios virava 8 linhas dizendo "Brigadeiro gourmet", e a lista deixava de
 * ser varrível. Aqui as linhas voltam a ser agrupadas pelo produto: o card é
 * o produto, os sabores são sub-linhas, e o cabeçalho resume a faixa de
 * margem pra ela não precisar ler sabor por sabor pra saber se tem problema.
 */
type Grupo = {
  produtoId: string
  nome: string
  tipo: 'UNITARIO' | 'KIT'
  linhas: LinhaMargem[]
}

function agrupar(margens: LinhaMargem[]): Grupo[] {
  const porProduto = new Map<string, Grupo>()
  for (const linha of margens) {
    const atual = porProduto.get(linha.produtoId)
    if (atual) {
      atual.linhas.push(linha)
    } else {
      porProduto.set(linha.produtoId, {
        produtoId: linha.produtoId,
        nome: linha.produtoNome,
        tipo: linha.tipo,
        linhas: [linha],
      })
    }
  }
  return [...porProduto.values()]
}

/** Faixa de margem do produto — "de 18% a 62%" diz mais que uma média. */
function faixaDeMargem(linhas: LinhaMargem[]): { min: Decimal; max: Decimal } | null {
  const comMargem = linhas.flatMap((l) => (l.margem !== null ? [l.margem] : []))
  if (comMargem.length === 0) return null
  return comMargem.reduce(
    (acc, m) => ({
      min: m.lessThan(acc.min) ? m : acc.min,
      max: m.greaterThan(acc.max) ? m : acc.max,
    }),
    { min: comMargem[0], max: comMargem[0] }
  )
}

/** Linha de números de um sabor (ou do kit inteiro). */
function LinhaSabor({ linha, nome }: { linha: LinhaMargem; nome: string }) {
  const semCusto = linha.custo === null || linha.margem === null
  const abaixo = abaixoDoMinimo(linha)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{nome}</span>

      <span className="w-24 shrink-0 text-sm tabular-nums">
        {currency.format(linha.precoVenda.toNumber())}
      </span>

      {/* Preço sugerido ao lado do fixo: o que esse doce PRECISARIA custar pra
          cada minuto de trabalho render o lucro/hora alvo. Só aparece quando
          há tempo medido e lucro/hora configurado. */}
      <span className="w-28 shrink-0 text-sm tabular-nums">
        {linha.precoSugerido === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={
              linha.precoSugerido.greaterThan(linha.precoVenda)
                ? 'font-semibold text-warn'
                : 'text-muted-foreground'
            }
            title={
              linha.precoSugerido.greaterThan(linha.precoVenda)
                ? 'O preço atual está abaixo do que o tempo de trabalho pede'
                : 'O preço atual já cobre o lucro/hora alvo'
            }
          >
            {currency.format(linha.precoSugerido.toNumber())}
          </span>
        )}
      </span>

      <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
        {semCusto ? '—' : currency.format(linha.custo!.toNumber())}
      </span>

      {semCusto ? (
        <span className="flex min-w-[230px] flex-1 items-center gap-2 text-[13px] text-warn">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          Custo incompleto — falta compra de ingrediente
        </span>
      ) : (
        <span className="flex min-w-[230px] flex-1 items-center gap-3">
          <Meter
            value={linha.margem!.toNumber()}
            min={linha.minima.toNumber()}
            tone={abaixo ? 'danger' : 'ok'}
            className="max-w-[130px]"
          />
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums ${abaixo ? 'text-destructive' : ''}`}
          >
            {linha.margem!.toFixed(0)}%
          </span>
          {abaixo && (
            <Chip tone="danger" icon={TriangleAlert}>
              mínima {linha.minima.toFixed(0)}%
            </Chip>
          )}
        </span>
      )}
    </div>
  )
}

/**
 * FIN/PROD — catálogo com a margem CORRENTE de cada sabor. A margem sozinha
 * ("62%") não diz nada: o que importa é onde ela cai em relação à mínima
 * configurada, então a barra carrega o traço da mínima.
 */
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro: filtroParam } = await searchParams
  const filtro: Filtro = FILTROS.some((f) => f.value === filtroParam)
    ? (filtroParam as Filtro)
    : 'todos'

  const margens = await margensCorrentesBatch()
  const grupos = agrupar(margens)

  const gruposFiltrados = grupos.filter((g) => {
    if (filtro === 'doces') return g.tipo === 'UNITARIO'
    if (filtro === 'kits') return g.tipo === 'KIT'
    if (filtro === 'margem-baixa') return g.linhas.some(abaixoDoMinimo)
    return true
  })

  const contagem = {
    todos: grupos.length,
    doces: grupos.filter((g) => g.tipo === 'UNITARIO').length,
    kits: grupos.filter((g) => g.tipo === 'KIT').length,
    'margem-baixa': grupos.filter((g) => g.linhas.some(abaixoDoMinimo)).length,
  }

  const saboresAbaixo = margens.filter(abaixoDoMinimo).length
  const semCusto = margens.filter((l) => l.custo === null).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        subtitle={
          grupos.length === 0
            ? 'Nenhum produto cadastrado ainda'
            : `${grupos.length} ${grupos.length === 1 ? 'produto' : 'produtos'} · ${margens.length} ${margens.length === 1 ? 'sabor' : 'sabores'}${saboresAbaixo > 0 ? ` · ${saboresAbaixo} abaixo da mínima` : ''}${semCusto > 0 ? ` · ${semCusto} sem custo completo` : ''}`
        }
      >
        <Button asChild className="h-11 px-5 text-base">
          <Link href="/admin/produtos/novo">Novo produto</Link>
        </Button>
      </PageHeader>

      {grupos.length === 0 ? (
        <EmptyState
          icon={CakeSlice}
          title="Nenhum produto ainda"
          description="Produto é o que vai pra vitrine: um doce (ligado a uma receita) ou um kit com vários."
        >
          <Button asChild className="h-11 px-5 text-base">
            <Link href="/admin/produtos/novo">Criar o primeiro</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <SegmentedNav
            items={FILTROS.map((f) => ({
              href: `/admin/produtos?filtro=${f.value}`,
              label: f.label,
              count: contagem[f.value],
              active: filtro === f.value,
            }))}
          />

          {gruposFiltrados.length === 0 ? (
            <EmptyState
              icon={CakeSlice}
              title="Nada nesse filtro"
              description={
                filtro === 'margem-baixa'
                  ? 'Nenhum sabor está abaixo da margem mínima agora — é uma boa notícia.'
                  : 'Troca o filtro acima pra ver os outros produtos.'
              }
            />
          ) : (
            <ul className="space-y-3">
              {gruposFiltrados.map((grupo) => {
                const kit = grupo.tipo === 'KIT'
                const abaixo = grupo.linhas.filter(abaixoDoMinimo).length
                const incompletos = grupo.linhas.filter((l) => l.custo === null).length
                const faixa = faixaDeMargem(grupo.linhas)
                // Kit e produto de um sabor só não ganham sub-linha: os números
                // cabem na própria linha do cabeçalho.
                const linhaUnica = grupo.linhas.length === 1

                return (
                  <li key={grupo.produtoId}>
                    <SurfaceCard className="p-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background">
                          {kit ? (
                            <Gift className="size-5 text-caramelo" aria-hidden />
                          ) : (
                            <CakeSlice className="size-5 text-caramelo" aria-hidden />
                          )}
                        </span>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/produtos/${grupo.produtoId}/editar`}
                              className="text-base font-semibold underline-offset-2 hover:underline"
                            >
                              {grupo.nome}
                            </Link>
                            {kit && <Chip tone="creme">Kit</Chip>}
                          </p>
                          {!linhaUnica && (
                            <p className="text-[13px] tabular-nums text-muted-foreground">
                              {grupo.linhas.length} sabores
                              {faixa &&
                                ` · margem de ${faixa.min.toFixed(0)}% a ${faixa.max.toFixed(0)}%`}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {abaixo > 0 && (
                            <Chip tone="danger" icon={TriangleAlert}>
                              {abaixo} abaixo da mínima
                            </Chip>
                          )}
                          {incompletos > 0 && (
                            <Chip tone="warn" icon={TriangleAlert}>
                              {incompletos} sem custo
                            </Chip>
                          )}
                          <Button asChild variant="outline" className="h-10 gap-1.5">
                            <Link href={`/admin/produtos/${grupo.produtoId}/editar`}>
                              Editar
                              <ChevronRight className="size-4" aria-hidden />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {/* Sub-linhas por sabor: o nome do produto não se repete. */}
                      <div className="border-t border-border px-5 pb-1">
                        {linhaUnica ? (
                          <LinhaSabor
                            linha={grupo.linhas[0]}
                            nome={grupo.linhas[0].variacaoNome ?? 'Preço e margem'}
                          />
                        ) : (
                          <>
                            <div className="hidden items-center gap-x-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-caramelo md:flex">
                              <span className="min-w-0 flex-1">Sabor</span>
                              <span className="w-24 shrink-0">Preço</span>
                              <span className="w-24 shrink-0">Custo</span>
                              <span className="min-w-[230px] flex-1">Margem hoje</span>
                            </div>
                            <ul className="divide-y divide-border">
                              {grupo.linhas.map((linha) => (
                                <li key={linha.variacaoId ?? linha.produtoId}>
                                  <LinhaSabor
                                    linha={linha}
                                    nome={linha.variacaoNome ?? grupo.nome}
                                  />
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </SurfaceCard>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
