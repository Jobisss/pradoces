'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { dadosProducao, comprasDoIngrediente, produzirLote, type DadosProducao } from '@/lib/actions/lotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currency4 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

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

const MULTIPLICADORES = ['1', '1.5', '2']

type ReceitaOpcao = { receitaId: string; produtoId: string; nome: string }
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

/**
 * Fluxo "Produzi hoje" (D-05/06/07/08) — o form mais importante do motor
 * financeiro, onde o custo é congelado. Tudo aqui é PREVIEW (decimal.js no
 * client); quem recomputa e congela de verdade é produzirLote server-side
 * dentro de uma transação (02-07, provado por LOTE-08). O payload enviado
 * carrega só IDs e quantidades — nunca um valor de custo.
 */
export function ProduzirLoteForm({ receitas }: { receitas: ReceitaOpcao[] }) {
  const router = useRouter()
  const [receitaId, setReceitaId] = useState('')
  const [dados, setDados] = useState<DadosProducao | null>(null)
  const [linhas, setLinhas] = useState<LinhaState[]>([])
  const [multiplicador, setMultiplicador] = useState('1')
  const [rendimentoReal, setRendimentoReal] = useState('')
  const [validade, setValidade] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [, startCarregarReceita] = useTransition()

  const produtoSelecionado = receitas.find((r) => r.receitaId === receitaId)

  function selecionarReceita(id: string) {
    setReceitaId(id)
    setErro(null)
    startCarregarReceita(async () => {
      const result = await dadosProducao(id)
      if (!result) {
        setErro('Não consegui carregar essa receita.')
        return
      }
      setDados(result)
      setLinhas(
        result.linhas.map((l) => ({
          ingredienteId: l.ingredienteId,
          nome: l.nome,
          unidadeBase: l.unidadeBase,
          qtdeBase: l.qtdeBase,
          compra: l.compraSelecionada,
          trocandoCompra: false,
          opcoesCompra: [],
        })),
      )
      setRendimentoReal(String(result.receita.rendimentoPadrao))
      if (result.receita.validadeDias) {
        const d = new Date()
        d.setDate(d.getDate() + result.receita.validadeDias)
        setValidade(d.toISOString().slice(0, 10))
      } else {
        setValidade('')
      }
    })
  }

  async function abrirTrocaCompra(index: number) {
    const linha = linhas[index]
    const opcoes = await comprasDoIngrediente(linha.ingredienteId)
    setLinhas((prev) =>
      prev.map((l, i) => (i === index ? { ...l, trocandoCompra: true, opcoesCompra: opcoes } : l)),
    )
  }

  function escolherCompra(index: number, compra: OpcaoCompra) {
    setLinhas((prev) => prev.map((l, i) => (i === index ? { ...l, compra, trocandoCompra: false } : l)))
  }

  const mult = toDecimal(multiplicador) ?? new Decimal(1)
  const rendimentoSugerido = dados
    ? new Decimal(dados.receita.rendimentoPadrao).times(mult).toFixed(0)
    : ''

  let custoPreview: { total: Decimal; porUnidade: Decimal } | null = null
  if (dados && rendimentoReal && Number(rendimentoReal) > 0 && linhas.length > 0 && linhas.every((l) => l.compra)) {
    let total = new Decimal(0)
    for (const linha of linhas) {
      const qtdeEscalada = new Decimal(linha.qtdeBase).times(mult)
      total = total.plus(qtdeEscalada.times(new Decimal(linha.compra!.custoPorUnidadeBase)))
    }
    if (dados.receita.custoGas) total = total.plus(new Decimal(dados.receita.custoGas))
    custoPreview = { total, porUnidade: total.dividedBy(Number(rendimentoReal)) }
  }

  function confirmar() {
    setErro(null)
    if (!produtoSelecionado || !dados) {
      setErro('Escolhe a receita.')
      return
    }
    if (linhas.some((l) => !l.compra)) {
      setErro('Falta escolher a compra de algum ingrediente.')
      return
    }
    if (!rendimentoReal || Number(rendimentoReal) < 1) {
      setErro('Informa quantas unidades saíram.')
      return
    }
    if (!validade) {
      setErro('Informa a validade.')
      return
    }

    const payload = {
      produtoId: produtoSelecionado.produtoId,
      receitaId: produtoSelecionado.receitaId,
      multiplicador,
      rendimentoReal: Number(rendimentoReal),
      validade,
      linhas: linhas.map((l) => ({
        ingredienteCompraId: l.compra!.id,
        qtde: new Decimal(l.qtdeBase).times(mult).toFixed(3),
      })),
    }

    startTransition(async () => {
      const result = await produzirLote(payload)
      if (result.error) {
        setErro(result.error)
        return
      }
      toast('Lote registrado! O custo ficou guardado do jeitinho que foi hoje.')
      router.push('/admin/lotes')
    })
  }

  return (
    <div className="space-y-6 pb-40 md:pb-0">
      {erro && (
        <p role="alert" className="text-sm text-muted-foreground">
          {erro}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="receita">Qual receita você fez</Label>
        <Select value={receitaId} onValueChange={selecionarReceita}>
          <SelectTrigger id="receita" className="w-full">
            <SelectValue placeholder="Escolhe a receita" />
          </SelectTrigger>
          <SelectContent>
            {receitas.map((r) => (
              <SelectItem key={r.receitaId} value={r.receitaId}>
                {r.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dados && (
        <>
          <div className="space-y-1.5">
            <Label>Quantas receitas</Label>
            <div className="flex flex-wrap gap-2">
              {MULTIPLICADORES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex h-11 items-center rounded-lg px-4 text-sm font-medium ${
                    multiplicador === m
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground'
                  }`}
                  onClick={() => setMultiplicador(m)}
                >
                  {m.replace('.', ',')}×
                </button>
              ))}
              <Input
                inputMode="decimal"
                value={multiplicador}
                onChange={(e) => setMultiplicador(e.target.value)}
                className="h-11 w-24"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Ingredientes que você usou</h2>
            {linhas.map((linha, index) => {
              const qtdeEscalada = new Decimal(linha.qtdeBase).times(mult)
              return (
                <div key={linha.ingredienteId} className="space-y-2 rounded-lg border border-border p-3">
                  {linha.compra ? (
                    <p className="tabular-nums text-sm">
                      {linha.nome} · {qtdeEscalada.toFixed(0)}
                      {linha.unidadeBase} — {linha.compra.marca}, compra de{' '}
                      {dataPorExtenso(linha.compra.dataCompra)} (
                      {currency4.format(Number(linha.compra.custoPorUnidadeBase))}/{linha.unidadeBase})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {linha.nome} ainda não tem compra registrada
                    </p>
                  )}

                  {linha.trocandoCompra ? (
                    <Select
                      onValueChange={(id) => {
                        const c = linha.opcoesCompra.find((o) => o.id === id)
                        if (c) escolherCompra(index, c)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Qual compra você usou?" />
                      </SelectTrigger>
                      <SelectContent>
                        {linha.opcoesCompra.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.marca} — {dataPorExtenso(o.dataCompra)} (
                            {currency4.format(Number(o.custoPorUnidadeBase))}/{linha.unidadeBase})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-medium underline underline-offset-2"
                      onClick={() => abrirTrocaCompra(index)}
                    >
                      Trocar compra
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rendimentoReal">Quantas unidades saíram de verdade</Label>
            <Input
              id="rendimentoReal"
              inputMode="numeric"
              value={rendimentoReal}
              onChange={(e) => setRendimentoReal(e.target.value)}
              placeholder={rendimentoSugerido}
            />
            <p className="text-sm text-muted-foreground">
              a receita diz {rendimentoSugerido}, mas vale o que saiu
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="validade">Vence em</Label>
            <Input
              id="validade"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
            {validade && (
              <p className="text-sm text-muted-foreground">
                vence {dataPorExtenso(validade)} — confere com a etiqueta que você cola no doce
              </p>
            )}
          </div>

          {custoPreview && (
            <p className="tabular-nums text-base">
              Esse lote custou {currency.format(custoPreview.total.toNumber())} —{' '}
              {currency.format(custoPreview.porUnidade.toNumber())} por unidade.
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto w-full max-w-md">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={pending || linhas.some((l) => !l.compra)}
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
