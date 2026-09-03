'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { ChefHat, TriangleAlert, Layers } from 'lucide-react'
import { dadosProducao, comprasDoIngrediente, produzirLotes, type DadosProducao } from '@/lib/actions/lotes'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { dataCivilFmtBR as dateFmt } from '@/lib/format/date'
import {
  FormLayout,
  FormSection,
  Field,
  FieldRow,
  AdminInput,
  AdminSelectTrigger,
  InputWithSuffix,
  FormAlert,
  CostCard,
  RailNote,
  Checklist,
  FormActions,
} from '@/components/admin/form'

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
 *
 * É a tela mais difícil do painel, então o trilho da direita mostra o custo
 * se formando e uma lista do que ainda falta — antes o botão só ficava
 * desabilitado, sem dizer por quê.
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

  const ativas = variacoes.filter((v) => (Number(v.rendimentoReal) || 0) > 0)
  const faltaCompraBase = linhasBase.filter((l) => !l.compra)
  const faltaCompraRecheio = ativas.flatMap((v) => (v.recheio ? v.recheio.linhas.filter((l) => !l.compra) : []))
  const semCompra = [...faltaCompraBase, ...faltaCompraRecheio]
  const custoTotalLote = ativas.reduce((soma, v) => {
    const preview = custoPreviewDe(v)
    return preview ? soma.plus(preview.total) : soma
  }, new Decimal(0))

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

  /** Linha de ingrediente com a compra congelada que vai valer nesse lote. */
  function linhaIngrediente(
    linha: LinhaState,
    qtdeEscalada: Decimal,
    onAbrirTroca: () => void,
    onEscolherCompra: (compra: OpcaoCompra) => void,
  ) {
    const custo = linha.compra
      ? qtdeEscalada.times(new Decimal(linha.compra.custoPorUnidadeBase))
      : null

    return (
      <div
        key={linha.ingredienteId}
        className={`flex flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center ${
          linha.compra ? 'bg-background' : 'border border-warn/25 bg-caramelo/15'
        }`}
      >
        <div className="w-full shrink-0 space-y-0.5 sm:w-52">
          <p className="text-sm font-semibold">{linha.nome}</p>
          <p className="text-[13px] tabular-nums text-muted-foreground">
            {qtdeEscalada.toFixed(0)}
            {linha.unidadeBase}
          </p>
        </div>

        {linha.trocandoCompra ? (
          <div className="min-w-0 flex-1">
            <Select
              onValueChange={(id) => {
                const c = linha.opcoesCompra.find((o) => o.id === id)
                if (c) onEscolherCompra(c)
              }}
            >
              <AdminSelectTrigger>
                <SelectValue placeholder="Qual compra você usou?" />
              </AdminSelectTrigger>
              <SelectContent>
                {linha.opcoesCompra.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.marca} — {dataPorExtenso(o.dataCompra)} (
                    {currency4.format(Number(o.custoPorUnidadeBase))}/{linha.unidadeBase})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : linha.compra ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="inline-flex h-6 items-center rounded-full bg-card px-2.5 text-xs font-semibold ring-1 ring-border">
              {linha.compra.marca}
            </span>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              compra de {dataPorExtenso(linha.compra.dataCompra)} ·{' '}
              {currency4.format(Number(linha.compra.custoPorUnidadeBase))}/{linha.unidadeBase}
            </span>
          </div>
        ) : (
          <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-warn">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            Sem compra registrada — não dá pra congelar o custo desse lote
          </p>
        )}

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[15px] font-semibold tabular-nums">
            {custo ? currency.format(custo.toNumber()) : '—'}
          </span>
          {!linha.trocandoCompra && (
            <button
              type="button"
              className="text-[13px] font-medium underline underline-offset-2 hover:text-warn"
              onClick={onAbrirTroca}
            >
              {linha.compra ? 'Trocar' : 'Escolher'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const rail = dados ? (
    <>
      <CostCard
        label="Esse lote vai custar"
        value={currency.format(custoTotalLote.toNumber())}
        sub={
          somaRendimento > 0
            ? `${somaRendimento} unidade${somaRendimento === 1 ? '' : 's'} · ${multEfetivo.toFixed(3).replace('.', ',')}× a receita base`
            : 'preenche a quantidade de pelo menos um sabor'
        }
        icon={Layers}
        rows={ativas.map((v) => {
          const preview = custoPreviewDe(v)
          return {
            label: v.nome,
            value: preview ? currency.format(preview.porUnidade.toNumber()) + '/un' : 'incompleto',
            tone: preview ? ('default' as const) : ('warn' as const),
          }
        })}
      >
        {semCompra.length > 0 && (
          <RailNote>
            Falta a compra de {semCompra.map((l) => l.nome).join(', ')} — o custo real vai ser maior
            que isso.
          </RailNote>
        )}
      </CostCard>

      <Checklist
        items={[
          { ok: true, label: 'Produto escolhido' },
          { ok: ativas.length > 0, label: 'Quantidade em pelo menos um sabor' },
          { ok: !!validade, label: 'Validade preenchida' },
          {
            ok: semCompra.length === 0,
            label:
              semCompra.length === 0
                ? 'Todos os ingredientes com compra'
                : `Compra de ${semCompra.map((l) => l.nome).join(', ')}`,
          },
        ]}
      />
    </>
  ) : undefined

  return (
    <FormLayout rail={rail}>
      {erro && <FormAlert title="Não deu pra registrar a produção" detail={erro} />}

      <FormSection
        title="O que você fez"
        hint="Só aparecem produtos com receita e pelo menos uma variação ativa."
      >
        <FieldRow>
          <Field label="Produto" htmlFor="produto">
            <Select value={produtoId} onValueChange={selecionarProduto}>
              <AdminSelectTrigger id="produto">
                <SelectValue placeholder="Escolhe o produto" />
              </AdminSelectTrigger>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.produtoId} value={p.produtoId}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {dados && (
            <Field
              label="Vence em"
              htmlFor="validade"
              className="sm:max-w-64"
              hint={
                validade
                  ? `Vence ${dataPorExtenso(validade)} — confere com a etiqueta que você cola no doce.`
                  : dados.receita.validadeDias
                    ? undefined
                    : 'Essa receita não tem validade configurada — preenche na mão.'
              }
            >
              <AdminInput
                id="validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </Field>
          )}
        </FieldRow>
      </FormSection>

      {dados && (
        <>
          <FormSection
            title="Ingredientes da massa"
            hint="Cada linha já vem com a última compra registrada. Só troca se você usou um pacote mais antigo."
          >
            <div className="flex flex-col gap-2.5">
              {linhasBase.map((linha, index) =>
                linhaIngrediente(
                  linha,
                  escalarBase(linha),
                  () => abrirTrocaCompraBase(index),
                  (compra) => escolherCompraBase(index, compra),
                ),
              )}
            </div>
          </FormSection>

          <FormSection
            title="Quantas saíram de cada sabor"
            hint="A conta da massa é dividida entre os sabores pelo que cada um rendeu — você não precisa calcular multiplicador nenhum."
          >
            <div className="flex flex-col gap-3">
              {variacoes.map((v, index) => {
                const custoPreview = custoPreviewDe(v)
                const rendimento = Number(v.rendimentoReal) || 0
                const feito = rendimento > 0

                return (
                  <div
                    key={v.id}
                    className={`flex flex-col gap-3.5 rounded-xl p-[18px] ${
                      feito ? 'border border-border bg-card' : 'bg-background'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <Field label={v.nome} htmlFor={`rendimento-${v.id}`} className="sm:max-w-56">
                        <InputWithSuffix
                          id={`rendimento-${v.id}`}
                          inputMode="numeric"
                          value={v.rendimentoReal}
                          onChange={(e) => setRendimentoReal(index, e.target.value)}
                          placeholder="0"
                          suffix="un"
                        />
                      </Field>
                      {custoPreview ? (
                        <p className="flex flex-1 items-baseline gap-2.5 pb-3">
                          <span className="text-lg font-semibold tabular-nums">
                            {currency.format(custoPreview.porUnidade.toNumber())}
                          </span>
                          <span className="text-[13px] text-muted-foreground">
                            por unidade · {currency.format(custoPreview.total.toNumber())} no total
                          </span>
                        </p>
                      ) : (
                        <p className="flex-1 pb-3.5 text-[13px] text-muted-foreground">
                          {feito
                            ? 'Falta escolher a compra de algum ingrediente pra calcular.'
                            : 'Deixa vazio se não fez essa hoje.'}
                        </p>
                      )}
                    </div>

                    {v.recheio && feito && (
                      <div className="flex flex-col gap-2.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.05em] text-caramelo">
                          Recheio: {v.recheio.nome}
                        </span>
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
                  </div>
                )
              })}
            </div>
          </FormSection>

          <FormActions note="Depois de registrar, o custo desse lote não muda mais — nem se o preço do ingrediente subir amanhã.">
            <Button
              type="button"
              className="h-12 gap-2 px-6 text-base"
              disabled={pending || linhasBase.some((l) => !l.compra)}
              onClick={confirmar}
            >
              <ChefHat className="size-[18px]" aria-hidden />
              {pending ? 'Registrando...' : 'Registrar produção'}
            </Button>
          </FormActions>
        </>
      )}
    </FormLayout>
  )
}
