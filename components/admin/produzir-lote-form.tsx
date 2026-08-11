'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { dadosProducao, comprasDoIngrediente, produzirLotes, type DadosProducao } from '@/lib/actions/lotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dataCivilFmtBR as dateFmt } from '@/lib/format/date'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currency4 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })

function toDecimal(raw: string): Decimal | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed || Number.isNaN(Number(trimmed))) return null
  try {
    return new Decimal(trimmed)
  } catch {
    return null
  }
}

function dataPorExtenso(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`))
}

type ProdutoOpcao = { produtoId: string; nome: string }
type OpcaoCompra = { id: string; marca: string; dataCompra: string; custoPorUnidadeBase: string }

type LinhaState = {
  ingredienteId: string
  nome: string
  unidadeBase: string
  qtdeBase: string
  compra: OpcaoCompra | null
  trocandoCompra: boolean
  opcoesCompra: OpcaoCompra[]
}

type VariacaoState = {
  id: string
  nome: string
  rendimentoReal: string
  recheio: {
    id: string
    nome: string
    gramasUsadas: string
    pesoTotalG: string
    custoGas: string | null
    linhas: LinhaState[]
  } | null
}

function toLinhaState(l: {
  ingredienteId: string
  nome: string
  unidadeBase: string
  qtdeBase: string
  compraSelecionada: OpcaoCompra | null
}): LinhaState {
  return {
    ingredienteId: l.ingredienteId,
    nome: l.nome,
    unidadeBase: l.unidadeBase,
    qtdeBase: l.qtdeBase,
    compra: l.compraSelecionada,
    trocandoCompra: false,
    opcoesCompra: [],
  }
}

/**
 * Fluxo "Produzi hoje" (D-05..08/13) — produto-cêntrico: escolhe o produto,
 * os ingredientes da BASE aparecem uma vez, e cada variação ativa ganha um
 * campo de quantidade (0/vazio = não fez essa hoje, sem criar lote pra ela).
 * O multiplicador da base é DERIVADO da soma das quantidades (não pedido
 * separado) — "fiz 5 desse, 3 desse" é tudo que a mãe precisa digitar.
 * Tudo aqui é PREVIEW (decimal.js no client); quem recomputa e congela de
 * verdade é produzirLotes server-side dentro de uma transação (02-07/D-13).
 */
export function ProduzirLoteForm({ produtos }: { produtos: ProdutoOpcao[] }) {
  const router = useRouter()
  const [produtoId, setProdutoId] = useState('')
  const [dados, setDados] = useState<DadosProducao | null>(null)
  const [linhasBase, setLinhasBase] = useState<LinhaState[]>([])
  const [variacoes, setVariacoes] = useState<VariacaoState[]>([])
  const [validade, setValidade] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [, startCarregarProduto] = useTransition()

  function selecionarProduto(id: string) {
    setProdutoId(id)
    setErro(null)
    startCarregarProduto(async () => {
      const result = await dadosProducao(id)
      if (!result) {
        setErro('Não consegui carregar esse produto.')
        return
      }
      setDados(result)
      setLinhasBase(result.linhasBase.map(toLinhaState))
      setVariacoes(
        result.variacoes.map((v) => ({
          id: v.id,
          nome: v.nome,
          rendimentoReal: '',
          recheio: v.recheio ? { ...v.recheio, linhas: v.recheio.linhas.map(toLinhaState) } : null,
        })),
      )
      if (result.receita.validadeDias) {
        const d = new Date()
        d.setDate(d.getDate() + result.receita.validadeDias)
        setValidade(d.toISOString().slice(0, 10))
      } else {
        setValidade('')
      }
    })
  }

  async function abrirTrocaCompraBase(index: number) {
    const linha = linhasBase[index]
    const opcoes = await comprasDoIngrediente(linha.ingredienteId)
    setLinhasBase((prev) =>
      prev.map((l, i) => (i === index ? { ...l, trocandoCompra: true, opcoesCompra: opcoes } : l)),
    )
  }
  function escolherCompraBase(index: number, compra: OpcaoCompra) {
    setLinhasBase((prev) => prev.map((l, i) => (i === index ? { ...l, compra, trocandoCompra: false } : l)))
  }

  async function abrirTrocaCompraRecheio(variacaoIndex: number, index: number) {
    const linha = variacoes[variacaoIndex].recheio!.linhas[index]
    const opcoes = await comprasDoIngrediente(linha.ingredienteId)
    setVariacoes((prev) =>
      prev.map((v, vi) =>
        vi !== variacaoIndex || !v.recheio
          ? v
          : {
              ...v,
              recheio: {
                ...v.recheio,
                linhas: v.recheio.linhas.map((l, i) =>
                  i === index ? { ...l, trocandoCompra: true, opcoesCompra: opcoes } : l,
                ),
              },
            },
      ),
    )
  }
  function escolherCompraRecheio(variacaoIndex: number, index: number, compra: OpcaoCompra) {
    setVariacoes((prev) =>
      prev.map((v, vi) =>
        vi !== variacaoIndex || !v.recheio
          ? v
          : {
              ...v,
              recheio: {
                ...v.recheio,
                linhas: v.recheio.linhas.map((l, i) => (i === index ? { ...l, compra, trocandoCompra: false } : l)),
              },
            },
      ),
    )
  }

  function setRendimentoReal(variacaoIndex: number, value: string) {
    setVariacoes((prev) => prev.map((v, i) => (i === variacaoIndex ? { ...v, rendimentoReal: value } : v)))
  }

  const somaRendimento = variacoes.reduce((soma, v) => soma + (Number(v.rendimentoReal) || 0), 0)
  const multEfetivo =
    dados && somaRendimento > 0
      ? new Decimal(somaRendimento).dividedBy(dados.receita.rendimentoPadrao)
      : new Decimal(0)

  function escalarBase(linha: LinhaState): Decimal {
    return new Decimal(linha.qtdeBase).times(multEfetivo)
  }
  function fracaoRecheioDe(v: VariacaoState): Decimal {
    if (!v.recheio) return new Decimal(0)
    const pesoTotalG = new Decimal(v.recheio.pesoTotalG)
    return pesoTotalG.isZero() ? new Decimal(0) : new Decimal(v.recheio.gramasUsadas).dividedBy(pesoTotalG)
  }
  function escalarRecheio(v: VariacaoState, linha: LinhaState): Decimal {
    const rendimento = toDecimal(v.rendimentoReal) ?? new Decimal(0)
    return new Decimal(linha.qtdeBase).times(fracaoRecheioDe(v)).times(rendimento)
  }

  /** Mesma conta do server: fatia da base (rendimentoReal_i ÷ soma) + recheio inteiro dessa variação. */
  function custoPreviewDe(v: VariacaoState): { total: Decimal; porUnidade: Decimal } | null {
    const rendimento = Number(v.rendimentoReal) || 0
    if (rendimento <= 0 || !dados) return null
    if (linhasBase.length === 0 || linhasBase.some((l) => !l.compra)) return null
    if (v.recheio && v.recheio.linhas.some((l) => !l.compra)) return null

    const fracao = somaRendimento > 0 ? new Decimal(rendimento).dividedBy(somaRendimento) : new Decimal(0)
    let totalBase = new Decimal(0)
    for (const linha of linhasBase) {
      totalBase = totalBase.plus(escalarBase(linha).times(new Decimal(linha.compra!.custoPorUnidadeBase)))
    }
    if (dados.receita.custoGas) totalBase = totalBase.plus(new Decimal(dados.receita.custoGas))
    const fatiaBase = totalBase.times(fracao)

    let totalRecheio = new Decimal(0)
    if (v.recheio) {
      for (const linha of v.recheio.linhas) {
        totalRecheio = totalRecheio.plus(escalarRecheio(v, linha).times(new Decimal(linha.compra!.custoPorUnidadeBase)))
      }
      if (v.recheio.custoGas) totalRecheio = totalRecheio.plus(new Decimal(v.recheio.custoGas))
    }

    const total = fatiaBase.plus(totalRecheio)
    return { total, porUnidade: total.dividedBy(rendimento) }
  }

  function confirmar() {
    setErro(null)
    if (!dados) {
      setErro('Escolhe o produto.')
      return
    }
    if (linhasBase.some((l) => !l.compra)) {
      setErro('Falta escolher a compra de algum ingrediente da base.')
      return
    }
    const ativas = variacoes.filter((v) => (Number(v.rendimentoReal) || 0) > 0)
    if (ativas.length === 0) {
      setErro('Informa quantas unidades saíram de pelo menos uma variação.')
      return
    }
    for (const v of ativas) {
      if (v.recheio && v.recheio.linhas.some((l) => !l.compra)) {
        setErro(`Falta escolher a compra de algum ingrediente do recheio de "${v.nome}".`)
        return
      }
      if (v.recheio && new Decimal(v.recheio.pesoTotalG).isZero()) {
        setErro(`"${v.nome}" tem recheio mas ele não tem peso configurado — edita o produto antes.`)
        return
      }
    }
    if (!validade) {
      setErro('Informa a validade.')
      return
    }

    const multiplicadorGlobal = new Decimal(somaRendimento).dividedBy(dados.receita.rendimentoPadrao).toDecimalPlaces(3)

    const payload = {
      produtoId,
      receitaId: dados.receita.id,
      multiplicador: multiplicadorGlobal.toFixed(3),
      validade,
      linhasBase: linhasBase.map((l) => ({
        ingredienteCompraId: l.compra!.id,
        qtde: new Decimal(l.qtdeBase).times(multiplicadorGlobal).toFixed(3),
      })),
      variacoes: ativas.map((v) => {
        const rendimentoReal = Number(v.rendimentoReal)
        const fracaoRecheio = fracaoRecheioDe(v)
        return {
          variacaoId: v.id,
          rendimentoReal,
          linhasRecheio: v.recheio
            ? v.recheio.linhas.map((l) => ({
                ingredienteCompraId: l.compra!.id,
                qtde: new Decimal(l.qtdeBase).times(fracaoRecheio).times(rendimentoReal).toFixed(3),
              }))
            : [],
        }
      }),
    }

    startTransition(async () => {
      const result = await produzirLotes(payload)
      if (result.error) {
        setErro(result.error)
        return
      }
      toast(`${result.lotes?.length ?? 0} lote(s) registrado(s)! O custo ficou guardado do jeitinho que foi hoje.`)
      router.push('/admin/lotes')
    })
  }

  function linhaIngrediente(
    linha: LinhaState,
    qtdeEscalada: Decimal,
    onAbrirTroca: () => void,
    onEscolherCompra: (compra: OpcaoCompra) => void,
  ) {
    return (
      <div key={linha.ingredienteId} className="space-y-2 rounded-lg border border-border p-3">
        {linha.compra ? (
          <p className="tabular-nums text-sm">
            {linha.nome} · {qtdeEscalada.toFixed(0)}
            {linha.unidadeBase} — {linha.compra.marca}, compra de {dataPorExtenso(linha.compra.dataCompra)} (
            {currency4.format(Number(linha.compra.custoPorUnidadeBase))}/{linha.unidadeBase})
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{linha.nome} ainda não tem compra registrada</p>
        )}

        {linha.trocandoCompra ? (
          <Select onValueChange={(id) => {
            const c = linha.opcoesCompra.find((o) => o.id === id)
            if (c) onEscolherCompra(c)
          }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Qual compra você usou?" />
            </SelectTrigger>
            <SelectContent>
              {linha.opcoesCompra.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.marca} — {dataPorExtenso(o.dataCompra)} ({currency4.format(Number(o.custoPorUnidadeBase))}/
                  {linha.unidadeBase})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <button type="button" className="text-sm font-medium underline underline-offset-2" onClick={onAbrirTroca}>
            Trocar compra
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-40 md:pb-0">
      {erro && (
        <p role="alert" className="text-sm text-muted-foreground">
          {erro}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="produto">Qual produto você fez</Label>
        <Select value={produtoId} onValueChange={selecionarProduto}>
          <SelectTrigger id="produto" className="w-full">
            <SelectValue placeholder="Escolhe o produto" />
          </SelectTrigger>
          <SelectContent>
            {produtos.map((p) => (
              <SelectItem key={p.produtoId} value={p.produtoId}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dados && (
        <>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Ingredientes da massa (base)</h2>
            {linhasBase.map((linha, index) =>
              linhaIngrediente(
                linha,
                escalarBase(linha),
                () => abrirTrocaCompraBase(index),
                (compra) => escolherCompraBase(index, compra),
              ),
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Quantas unidades de cada variação</h2>
            {variacoes.map((v, index) => {
              const custoPreview = custoPreviewDe(v)
              const rendimento = Number(v.rendimentoReal) || 0
              return (
                <div key={v.id} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`rendimento-${v.id}`}>{v.nome}</Label>
                    <Input
                      id={`rendimento-${v.id}`}
                      inputMode="numeric"
                      value={v.rendimentoReal}
                      onChange={(e) => setRendimentoReal(index, e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-sm text-muted-foreground">Deixa em branco (ou 0) se não fez essa hoje.</p>
                  </div>

                  {v.recheio && rendimento > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Recheio: {v.recheio.nome}</h3>
                      {v.recheio.linhas.map((linha, li) =>
                        linhaIngrediente(
                          linha,
                          escalarRecheio(v, linha),
                          () => abrirTrocaCompraRecheio(index, li),
                          (compra) => escolherCompraRecheio(index, li, compra),
                        ),
                      )}
                    </div>
                  )}

                  {custoPreview && (
                    <p className="tabular-nums text-sm">
                      Custou {currency.format(custoPreview.total.toNumber())} — {currency.format(custoPreview.porUnidade.toNumber())} por unidade.
                    </p>
                  )}
                </div>
              )
            })}
            {somaRendimento > 0 && (
              <p className="tabular-nums text-sm text-muted-foreground">
                Isso equivale a {multEfetivo.toFixed(3).replace('.', ',')}× a receita base ({somaRendimento} unidades
                no total).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="validade">Vence em</Label>
            <Input id="validade" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            {validade && (
              <p className="text-sm text-muted-foreground">
                vence {dataPorExtenso(validade)} — confere com a etiqueta que você cola no doce
              </p>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto w-full max-w-md">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={pending || linhasBase.some((l) => !l.compra)}
                onClick={confirmar}
              >
                {pending ? 'Registrando...' : 'Registrar produção'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
