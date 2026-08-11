'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, useWatch, type Control } from 'react-hook-form'
import Decimal from 'decimal.js'
import { TriangleAlert, XIcon } from 'lucide-react'
import { criarProduto, editarProduto, sugestoesCategoria } from '@/lib/actions/produtos'
import { ALERGENICOS } from '@/lib/validation/produtos'
import { CAMPANHAS } from '@/lib/campanhas/definicoes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { SuggestInput } from '@/components/admin/suggest-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ProdutoFotosManager } from '@/components/admin/produto-fotos-manager'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function toDecimal(raw: string): Decimal | null {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed || Number.isNaN(Number(trimmed))) return null
  try {
    return new Decimal(trimmed)
  } catch {
    return null
  }
}

function margemPercent(preco: Decimal, custo: Decimal): Decimal {
  if (preco.lessThanOrEqualTo(0)) return new Decimal(0)
  return preco.minus(custo).dividedBy(preco).times(100)
}

/** custo da base + recheio (se houver) — mesma conta de lib/custo/corrente.ts:custoCorrenteVariacao, em decimal.js no client. */
function calcularCusto(
  custoBase: Decimal | null,
  recheioSelecionado: RecheioOpcao | undefined,
  gramasUsadas: Decimal | null,
): Decimal | null {
  if (custoBase === null) return null
  if (!recheioSelecionado) return custoBase
  const custoRecheio =
    recheioSelecionado.custoPorGrama && gramasUsadas
      ? new Decimal(recheioSelecionado.custoPorGrama).times(gramasUsadas)
      : null
  return custoRecheio !== null ? custoBase.plus(custoRecheio) : null
}

/** Os 3 estados do UI-SPEC: custo incompleto / abaixo do custo (bloqueio PROD-09) / margem ok-ou-baixa. */
function blocoMargem(
  custo: Decimal | null,
  precoRaw: string,
  minimaRaw: string,
  margemMinimaGlobal: string,
): { node: React.ReactNode; abaixoDoCusto: boolean } {
  if (custo === null) {
    return { node: <p className="text-sm text-muted-foreground">custo incompleto</p>, abaixoDoCusto: false }
  }
  const preco = toDecimal(precoRaw)
  if (preco === null) return { node: null, abaixoDoCusto: false }
  if (preco.lessThan(custo)) {
    return {
      node: (
        <Alert variant="destructive">
          <AlertDescription>
            Esse preço tá abaixo do custo ({currency.format(custo.toNumber())}) — você pagaria pra vender. Aumenta o
            preço pra salvar.
          </AlertDescription>
        </Alert>
      ),
      abaixoDoCusto: true,
    }
  }
  const minima = toDecimal(minimaRaw) ?? toDecimal(margemMinimaGlobal) ?? new Decimal(30)
  const margem = margemPercent(preco, custo)
  const abaixoDoMinimo = margem.lessThan(minima)
  const lucro = preco.minus(custo)
  if (abaixoDoMinimo) {
    return {
      node: (
        <div className="space-y-1 rounded-lg border-l-4 border-destructive bg-card p-3">
          <p className="flex items-center gap-1.5 text-base text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            Margem abaixo do mínimo ({minima.toFixed(0)}%): de cada R$ 10 vendidos, menos de R$ 3 ficam com você.
            Vale subir o preço ou rever a receita.
          </p>
        </div>
      ),
      abaixoDoCusto: false,
    }
  }
  return {
    node: (
      <div className="space-y-1 rounded-lg border border-border bg-card p-3">
        <p className="tabular-nums text-base">
          Custa {currency.format(custo.toNumber())} pra fazer hoje. Vendendo a {currency.format(preco.toNumber())},
          ficam {currency.format(lucro.toNumber())} com você ({margem.toFixed(0)}% de margem).
        </p>
        <p className="text-xs text-muted-foreground">Margem = quanto do preço fica com você, já descontado o custo.</p>
      </div>
    ),
    abaixoDoCusto: false,
  }
}

type OpcaoCusto = { id: string; nome: string; custoPorUnidade: string | null }
type RecheioOpcao = {
  id: string
  nome: string
  custoPorGrama: string | null
  pesoTotalG: string
  itensForaDeGramas: string[]
}
type UnitarioVariacaoOpcao = { id: string; nome: string; custoPorUnidade: string | null }
type UnitarioOpcao = { id: string; nome: string; variacoes: UnitarioVariacaoOpcao[] }

type VariacaoFormValues = {
  id?: string
  nome: string
  recheioReceitaId: string
  recheioGramasUsadas: string
  precoVenda: string
  margemMinimaOverride: string
  ativo: boolean
}

type ProdutoFormValues = {
  nome: string
  descricao: string
  categoria: string
  tipo: 'UNITARIO' | 'KIT'
  ativo: boolean
  alergenicos: string[]
  campanhas: string[]
  precoVenda: string
  margemMinimaOverride: string
  receitaId: string
  variacoes: VariacaoFormValues[]
  kitItens: Array<{ componenteId: string; componenteVariacaoId: string; qtde: string }>
}

type ProdutoFormProps = {
  receitas: OpcaoCusto[]
  recheios: RecheioOpcao[]
  unitarios: UnitarioOpcao[]
  margemMinimaGlobal: string
  defaults?: {
    id: string
    nome: string
    descricao: string
    categoria: string
    tipo: 'UNITARIO' | 'KIT'
    ativo: boolean
    alergenicos: string[]
    campanhas: string[]
    precoVenda: string | null
    margemMinimaOverride: string | null
    receitaId: string | null
    variacoes: Array<{
      id: string
      nome: string
      recheioReceitaId: string | null
      recheioGramasUsadas: string | null
      precoVenda: string
      margemMinimaOverride: string | null
      ativo: boolean
    }>
    kitItens: Array<{ componenteId: string; componenteVariacaoId: string | null; qtde: number }>
    fotos: Array<{ id: string; path: string; ordem: number }>
  }
}

const VARIACAO_NOVA: VariacaoFormValues = {
  nome: 'Padrão',
  recheioReceitaId: '',
  recheioGramasUsadas: '',
  precoVenda: '',
  margemMinimaOverride: '',
  ativo: true,
}

/** 1 linha de Variação (D-13) — cada uma tem seu próprio recheio+preço, com o preview de custo/margem já rodando pra ela. */
function VariacaoLinha({
  index,
  control,
  onRemove,
  custoBase,
  receitaId,
  recheios,
  margemMinimaGlobal,
}: {
  index: number
  control: Control<ProdutoFormValues>
  onRemove: () => void
  custoBase: Decimal | null
  receitaId: string
  recheios: RecheioOpcao[]
  margemMinimaGlobal: string
}) {
  const row = useWatch({ control, name: `variacoes.${index}` })
  const recheioSelecionado = recheios.find((r) => r.id === row.recheioReceitaId)
  const gramasUsadas = toDecimal(row.recheioGramasUsadas ?? '')
  const custo = calcularCusto(custoBase, recheioSelecionado, gramasUsadas)
  const { node } = blocoMargem(custo, row.precoVenda ?? '', row.margemMinimaOverride ?? '', margemMinimaGlobal)

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          <FormField
            control={control}
            name={`variacoes.${index}.nome`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da variação</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex.: Ovomaltine" required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-6 size-11 shrink-0"
          aria-label="Remover variação"
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>

      <FormField
        control={control}
        name={`variacoes.${index}.recheioReceitaId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Recheio (opcional) — se essa variação tiver</FormLabel>
            <Select value={field.value || 'nenhum'} onValueChange={(v) => field.onChange(v === 'nenhum' ? '' : v)}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sem recheio" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="nenhum">Sem recheio</SelectItem>
                {recheios
                  .filter((r) => r.id !== receitaId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {row.recheioReceitaId && (
        <FormField
          control={control}
          name={`variacoes.${index}.recheioGramasUsadas`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gramas de recheio em cada unidade</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="ex.: 20" {...field} required />
              </FormControl>
              {recheioSelecionado && (
                <p className="text-sm text-muted-foreground">
                  Essa receita rende {recheioSelecionado.pesoTotalG}g no total
                  {recheioSelecionado.custoPorGrama === null && ' — sem custo suficiente pra calcular ainda'}.
                  {recheioSelecionado.itensForaDeGramas.length > 0 && (
                    <>
                      {' '}
                      Não entraram no total (não estão em gramas): {recheioSelecionado.itensForaDeGramas.join(', ')}.
                    </>
                  )}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name={`variacoes.${index}.precoVenda`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Preço de venda (R$)</FormLabel>
            <FormControl>
              <Input {...field} inputMode="decimal" placeholder="0,00" required />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {node}

      <FormField
        control={control}
        name={`variacoes.${index}.margemMinimaOverride`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Margem mínima só dessa variação (%) — se quiser diferente do padrão</FormLabel>
            <FormControl>
              <Input {...field} inputMode="decimal" placeholder={margemMinimaGlobal} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`variacoes.${index}.ativo`}
        render={({ field }) => (
          <FormItem className="group/field flex flex-row items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            </FormControl>
            <FormLabel className="font-normal">Ativa (aparece na vitrine pro cliente)</FormLabel>
          </FormItem>
        )}
      />
    </div>
  )
}

/**
 * Form de produto — bloco de margem AO VIVO (D-09) com os 3 estados do
 * UI-SPEC: saudável, abaixo do mínimo (borda+ícone+texto, nunca só cor) e
 * bloqueio PROD-09 (preço < custo). D-13: pra UNITARIO, cada Variação tem seu
 * próprio bloco de margem — o bloqueio aqui é cortesia visual, quem decide de
 * verdade é a action (lib/actions/produtos.ts).
 */
export function ProdutoForm({ receitas, recheios, unitarios, margemMinimaGlobal, defaults }: ProdutoFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<ProdutoFormValues>({
    defaultValues: {
      nome: defaults?.nome ?? '',
      descricao: defaults?.descricao ?? '',
      categoria: defaults?.categoria ?? '',
      tipo: defaults?.tipo ?? 'UNITARIO',
      ativo: defaults?.ativo ?? true,
      alergenicos: defaults?.alergenicos ?? [],
      campanhas: defaults?.campanhas ?? [],
      precoVenda: defaults?.precoVenda ?? '',
      margemMinimaOverride: defaults?.margemMinimaOverride ?? '',
      receitaId: defaults?.receitaId ?? '',
      variacoes: defaults
        ? defaults.variacoes.map((v) => ({
            id: v.id,
            nome: v.nome,
            recheioReceitaId: v.recheioReceitaId ?? '',
            recheioGramasUsadas: v.recheioGramasUsadas ?? '',
            precoVenda: v.precoVenda,
            margemMinimaOverride: v.margemMinimaOverride ?? '',
            ativo: v.ativo,
          }))
        : [VARIACAO_NOVA],
      kitItens:
        defaults?.kitItens.map((i) => ({
          componenteId: i.componenteId,
          componenteVariacaoId: i.componenteVariacaoId ?? '',
          qtde: String(i.qtde),
        })) ?? [],
    },
  })
  const { control, handleSubmit, watch, setValue } = form
  const kitFieldArray = useFieldArray({ control, name: 'kitItens' })
  const variacaoFieldArray = useFieldArray({ control, name: 'variacoes' })

  const tipo = watch('tipo')
  const receitaId = watch('receitaId')
  const kitItens = watch('kitItens')
  const variacoesWatch = watch('variacoes')
  const precoVendaRaw = watch('precoVenda')
  const margemOverrideRaw = watch('margemMinimaOverride')
  const categoria = watch('categoria')

  const custoBaseReceita = receitas.find((r) => r.id === receitaId)?.custoPorUnidade
  const custoBase = custoBaseReceita ? new Decimal(custoBaseReceita) : null

  // Cortesia visual pro botão de submit — a validação de verdade é no server.
  let algumaVariacaoAbaixoDoCusto = false
  if (tipo === 'UNITARIO') {
    for (const v of variacoesWatch) {
      const recheioSelecionado = recheios.find((r) => r.id === v.recheioReceitaId)
      const custo = calcularCusto(custoBase, recheioSelecionado, toDecimal(v.recheioGramasUsadas))
      if (blocoMargem(custo, v.precoVenda, v.margemMinimaOverride, margemMinimaGlobal).abaixoDoCusto) {
        algumaVariacaoAbaixoDoCusto = true
        break
      }
    }
  }

  let blocoMargemKit: React.ReactNode = null
  let kitAbaixoDoCusto = false
  if (tipo === 'KIT') {
    let total = new Decimal(0)
    let algumFaltando = kitItens.length === 0
    for (const item of kitItens) {
      const variacoesDoComponente = unitarios.find((u) => u.id === item.componenteId)?.variacoes ?? []
      const variacaoEscolhida = variacoesDoComponente.find((v) => v.id === item.componenteVariacaoId)
      if (!item.componenteId || !variacaoEscolhida?.custoPorUnidade) {
        algumFaltando = true
        continue
      }
      total = total.plus(new Decimal(variacaoEscolhida.custoPorUnidade).times(Number(item.qtde) || 0))
    }
    const custo = algumFaltando ? null : total
    const resultado = blocoMargem(custo, precoVendaRaw, margemOverrideRaw, margemMinimaGlobal)
    blocoMargemKit = resultado.node
    kitAbaixoDoCusto = resultado.abaixoDoCusto
  }

  function onSubmit(data: ProdutoFormValues) {
    setServerError(null)
    const payload = {
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      tipo: data.tipo,
      ativo: data.ativo,
      alergenicos: data.alergenicos,
      campanhas: data.campanhas,
      precoVenda: data.tipo === 'KIT' ? data.precoVenda : undefined,
      margemMinimaOverride: data.tipo === 'KIT' ? data.margemMinimaOverride : undefined,
      receitaId: data.tipo === 'UNITARIO' ? data.receitaId : undefined,
      variacoes:
        data.tipo === 'UNITARIO'
          ? data.variacoes.map((v) => ({
              id: v.id,
              nome: v.nome,
              recheioReceitaId: v.recheioReceitaId || undefined,
              recheioGramasUsadas: v.recheioReceitaId ? v.recheioGramasUsadas || undefined : undefined,
              precoVenda: v.precoVenda,
              margemMinimaOverride: v.margemMinimaOverride || undefined,
              ativo: v.ativo,
            }))
          : undefined,
      kitItens:
        data.tipo === 'KIT'
          ? data.kitItens.map((i) => ({
              componenteId: i.componenteId,
              componenteVariacaoId: i.componenteVariacaoId,
              qtde: Number(i.qtde) || 1,
            }))
          : undefined,
    }
    startTransition(async () => {
      const res = defaults ? await editarProduto(defaults.id, payload) : await criarProduto(payload)
      if (res?.error) {
        setServerError(res.error)
        return
      }
      // Ao criar (não editar), manda pro próprio form de edição em vez da
      // lista — é só ali que dá pra adicionar foto (precisa do id do
      // produto), senão a mãe salva e nunca acha onde colocar a imagem.
      router.push(defaults || !res.id ? '/admin/produtos' : `/admin/produtos/${res.id}/editar`)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-40 md:pb-0" noValidate>
        {serverError && (
          <p role="alert" className="text-sm text-muted-foreground">
            {serverError}
          </p>
        )}

        <FormField
          control={control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea {...field} required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SuggestInput
          id="categoria"
          label="Categoria"
          value={categoria}
          onChange={(v) => setValue('categoria', v)}
          fetchSuggestions={sugestoesCategoria}
        />

        <FormField
          control={control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>É doce único ou kit?</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="UNITARIO">Doce único</SelectItem>
                  <SelectItem value="KIT">Kit</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="ativo"
          render={({ field }) => (
            <FormItem className="group/field flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="font-normal">Ativo (aparece na vitrine pro cliente)</FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="alergenicos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alergênicos</FormLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALERGENICOS.map((a) => (
                  <label key={a.value} className="group/field flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={field.value.includes(a.value)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked === true
                            ? [...field.value, a.value]
                            : field.value.filter((v) => v !== a.value),
                        )
                      }
                    />
                    {a.label}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="campanhas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campanhas sazonais (opcional)</FormLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CAMPANHAS.map((c) => (
                  <label key={c.id} className="group/field flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={field.value.includes(c.id)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked === true ? [...field.value, c.id] : field.value.filter((v) => v !== c.id),
                        )
                      }
                    />
                    {c.nome}
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Destaca esse produto na vitrine durante a campanha marcada.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {defaults && (
          <FormItem>
            <FormLabel>Fotos</FormLabel>
            <ProdutoFotosManager produtoId={defaults.id} fotosIniciais={defaults.fotos} />
          </FormItem>
        )}
        {!defaults && (
          <FormItem>
            <FormLabel>Fotos</FormLabel>
            <p className="text-sm text-muted-foreground">
              Salva o produto primeiro — depois de salvar, você volta pra essa tela já com o campo de
              foto liberado.
            </p>
          </FormItem>
        )}

        {tipo === 'UNITARIO' && (
          <>
            <FormField
              control={control}
              name="receitaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receita (a massa)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Escolhe a receita" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {receitas.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Variações</h2>
              <p className="text-sm text-muted-foreground">
                Cada sabor/recheio diferente da mesma massa vira uma variação, com preço próprio.
              </p>
              {variacaoFieldArray.fields.map((field, index) => (
                <VariacaoLinha
                  key={field.id}
                  index={index}
                  control={control}
                  onRemove={() => variacaoFieldArray.remove(index)}
                  custoBase={custoBase}
                  receitaId={receitaId}
                  recheios={recheios}
                  margemMinimaGlobal={margemMinimaGlobal}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => variacaoFieldArray.append(VARIACAO_NOVA)}
              >
                Mais uma variação
              </Button>
            </div>
          </>
        )}

        {tipo === 'KIT' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Itens do kit</h2>
            {kitFieldArray.fields.map((field, index) => {
              const componenteId = kitItens[index]?.componenteId
              const variacoesDoComponente = unitarios.find((u) => u.id === componenteId)?.variacoes ?? []
              return (
                <div key={field.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <FormField
                        control={control}
                        name={`kitItens.${index}.componenteId`}
                        render={({ field: compField }) => (
                          <FormItem>
                            <FormLabel>Componente</FormLabel>
                            <Select
                              value={compField.value}
                              onValueChange={(v) => {
                                compField.onChange(v)
                                const opcoes = unitarios.find((u) => u.id === v)?.variacoes ?? []
                                setValue(
                                  `kitItens.${index}.componenteVariacaoId`,
                                  opcoes.length === 1 ? opcoes[0].id : '',
                                )
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Escolhe um doce único" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {unitarios.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="w-24 space-y-1.5">
                      <FormField
                        control={control}
                        name={`kitItens.${index}.qtde`}
                        render={({ field: qtdeField }) => (
                          <FormItem>
                            <FormLabel>Qtde</FormLabel>
                            <FormControl>
                              <Input {...qtdeField} inputMode="numeric" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 shrink-0"
                      aria-label="Remover item do kit"
                      onClick={() => kitFieldArray.remove(index)}
                    >
                      <XIcon />
                    </Button>
                  </div>

                  <FormField
                    control={control}
                    name={`kitItens.${index}.componenteVariacaoId`}
                    render={({ field: varField }) => (
                      <FormItem>
                        <FormLabel>Qual variação desse componente</FormLabel>
                        <Select value={varField.value} onValueChange={varField.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={componenteId ? 'Escolhe a variação' : 'Escolhe o componente primeiro'}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {variacoesDoComponente.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => kitFieldArray.append({ componenteId: '', componenteVariacaoId: '', qtde: '1' })}
            >
              Mais um item
            </Button>
          </div>
        )}

        {tipo === 'KIT' && (
          <>
            <FormField
              control={control}
              name="precoVenda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço de venda do kit (R$)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="decimal" placeholder="0,00" required />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {blocoMargemKit}

            <FormField
              control={control}
              name="margemMinimaOverride"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Margem mínima só desse kit (%) — se quiser diferente do padrão</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="decimal" placeholder={margemMinimaGlobal} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto w-full max-w-md">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending || algumaVariacaoAbaixoDoCusto || kitAbaixoDoCusto}
            >
              {pending ? 'Salvando...' : 'Salvar produto'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
