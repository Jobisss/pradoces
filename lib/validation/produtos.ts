import { z } from 'zod'
import { zDecimalBRL, zQtdeBRL } from '@/lib/validation/decimal'

const OBRIGATORIO = 'Esse campo é obrigatório.'

// PROD-03 — mesma ordem usada no <select multiple> do form e no card público.
// Valores precisam bater 1:1 com o enum Alergenico do schema.prisma.
const ALERGENICO_VALUES = [
  'GLUTEN',
  'LEITE',
  'OVO',
  'AMENDOIM',
  'CASTANHA',
  'SOJA',
  'DERIVADOS_SOJA',
] as const

export const ALERGENICOS = [
  { value: 'GLUTEN', label: 'Glúten' },
  { value: 'LEITE', label: 'Leite' },
  { value: 'OVO', label: 'Ovo' },
  { value: 'AMENDOIM', label: 'Amendoim' },
  { value: 'CASTANHA', label: 'Castanha' },
  { value: 'SOJA', label: 'Soja' },
  { value: 'DERIVADOS_SOJA', label: 'Derivados de soja' },
] as const satisfies { value: (typeof ALERGENICO_VALUES)[number]; label: string }[]

// D-13 — uma Variação por sabor (recheio opcional + preço próprio). `id`
// ausente = variação nova; presente = edição de uma existente (ver diff em
// lib/actions/produtos.ts, editarProduto — nunca apaga-tudo-e-recria aqui).
const VariacaoSchema = z
  .object({
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(1, OBRIGATORIO),
    recheioReceitaId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    // Gramas de recheio usadas em CADA unidade — obrigatório quando há recheio (superRefine abaixo).
    recheioGramasUsadas: zQtdeBRL.optional().or(z.literal('').transform(() => undefined)),
    precoVenda: zDecimalBRL,
    margemMinimaOverride: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    // Promoção manual por sabor — os 3 campos são all-or-nothing (superRefine
    // abaixo), espelhando o CHECK do schema (Pitfall: dupla validação
    // client+server, nunca confiar só no client).
    precoPromocional: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    promocaoInicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, OBRIGATORIO)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    promocaoFim: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, OBRIGATORIO)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    ativo: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.recheioReceitaId && !v.recheioGramasUsadas) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informa quantas gramas de recheio entram em cada unidade.',
        path: ['recheioGramasUsadas'],
      })
    }
    if (!v.recheioReceitaId && v.recheioGramasUsadas) {
      ctx.addIssue({
        code: 'custom',
        message: 'Sem recheio selecionado, não informa gramas.',
        path: ['recheioGramasUsadas'],
      })
    }

    const algumaPromo = v.precoPromocional || v.promocaoInicio || v.promocaoFim
    if (algumaPromo) {
      if (!v.precoPromocional) {
        ctx.addIssue({ code: 'custom', message: 'Informa o preço promocional.', path: ['precoPromocional'] })
      } else if (v.precoPromocional.lessThanOrEqualTo(0)) {
        ctx.addIssue({ code: 'custom', message: 'O preço promocional precisa ser maior que zero.', path: ['precoPromocional'] })
      } else if (v.precoPromocional.greaterThanOrEqualTo(v.precoVenda)) {
        ctx.addIssue({
          code: 'custom',
          message: 'O preço promocional precisa ser menor que o preço normal.',
          path: ['precoPromocional'],
        })
      }
      if (!v.promocaoInicio) {
        ctx.addIssue({ code: 'custom', message: 'Escolhe a data de início.', path: ['promocaoInicio'] })
      }
      if (!v.promocaoFim) {
        ctx.addIssue({ code: 'custom', message: 'Escolhe a data de fim.', path: ['promocaoFim'] })
      }
      if (v.promocaoInicio && v.promocaoFim && v.promocaoFim < v.promocaoInicio) {
        ctx.addIssue({ code: 'custom', message: 'A data de fim precisa ser depois da de início.', path: ['promocaoFim'] })
      }
    }
  })

export type VariacaoInput = z.infer<typeof VariacaoSchema>

export const ProdutoSchema = z
  .object({
    nome: z.string().trim().min(1, OBRIGATORIO),
    descricao: z.string().trim().min(1, OBRIGATORIO),
    categoria: z.string().trim().min(1, OBRIGATORIO),
    tipo: z.enum(['UNITARIO', 'KIT']),
    ativo: z.boolean().default(true),
    alergenicos: z.array(z.enum(ALERGENICO_VALUES)).default([]),
    // SAZON-02 — validado contra a lista hardcoded em lib/campanhas/definicoes.ts
    // no action, não aqui (evita import de módulo client-safe puxar mais coisa).
    campanhas: z.array(z.string()).default([]),
    // D-13: preço/margem de UNITARIO moram em cada Variação agora — esses 2
    // campos só valem pra KIT (o kit em si tem 1 preço só).
    precoVenda: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    margemMinimaOverride: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    receitaId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    kitItens: z
      .array(
        z.object({
          componenteId: z.string().uuid(),
          // D-13: kit ciente de variação — qual sabor específico do componente entra no kit.
          componenteVariacaoId: z.string().uuid(),
          qtde: z.coerce.number().int().min(1),
        }),
      )
      .optional(),
    variacoes: z.array(VariacaoSchema).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'UNITARIO') {
      if (!v.receitaId) {
        ctx.addIssue({ code: 'custom', message: 'Escolhe a receita desse produto.', path: ['receitaId'] })
      }
      if (v.kitItens && v.kitItens.length > 0) {
        ctx.addIssue({ code: 'custom', message: 'Doce único não tem itens de kit.', path: ['kitItens'] })
      }
      if (!v.variacoes || v.variacoes.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Adiciona pelo menos uma variação (pode ser só "Padrão").',
          path: ['variacoes'],
        })
      }
    } else {
      if (!v.kitItens || v.kitItens.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'O kit precisa de pelo menos um item.', path: ['kitItens'] })
      }
      if (v.receitaId) {
        ctx.addIssue({ code: 'custom', message: 'Kit não tem receita própria.', path: ['receitaId'] })
      }
      if (v.variacoes && v.variacoes.length > 0) {
        ctx.addIssue({ code: 'custom', message: 'Kit não tem variação própria.', path: ['variacoes'] })
      }
      if (!v.precoVenda) {
        ctx.addIssue({ code: 'custom', message: 'Informa o preço do kit.', path: ['precoVenda'] })
      }
    }
  })

export type ProdutoInput = z.infer<typeof ProdutoSchema>
