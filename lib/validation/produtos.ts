import { z } from 'zod'
import { zDecimalBRL } from '@/lib/validation/decimal'

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

export const ProdutoSchema = z
  .object({
    nome: z.string().trim().min(1, OBRIGATORIO),
    descricao: z.string().trim().min(1, OBRIGATORIO),
    categoria: z.string().trim().min(1, OBRIGATORIO),
    tipo: z.enum(['UNITARIO', 'KIT']),
    ativo: z.boolean().default(true),
    alergenicos: z.array(z.enum(ALERGENICO_VALUES)).default([]),
    precoVenda: zDecimalBRL,
    margemMinimaOverride: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    receitaId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    recheioReceitaId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    kitItens: z
      .array(z.object({ componenteId: z.string().uuid(), qtde: z.coerce.number().int().min(1) }))
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'UNITARIO') {
      if (!v.receitaId) {
        ctx.addIssue({ code: 'custom', message: 'Escolhe a receita desse produto.', path: ['receitaId'] })
      }
      if (v.kitItens && v.kitItens.length > 0) {
        ctx.addIssue({ code: 'custom', message: 'Doce único não tem itens de kit.', path: ['kitItens'] })
      }
      if (v.recheioReceitaId && v.recheioReceitaId === v.receitaId) {
        ctx.addIssue({
          code: 'custom',
          message: 'O recheio precisa ser uma receita diferente da base.',
          path: ['recheioReceitaId'],
        })
      }
    } else {
      if (!v.kitItens || v.kitItens.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'O kit precisa de pelo menos um item.', path: ['kitItens'] })
      }
      if (v.receitaId) {
        ctx.addIssue({ code: 'custom', message: 'Kit não tem receita própria.', path: ['receitaId'] })
      }
      if (v.recheioReceitaId) {
        ctx.addIssue({ code: 'custom', message: 'Kit não tem recheio próprio.', path: ['recheioReceitaId'] })
      }
    }
  })

export type ProdutoInput = z.infer<typeof ProdutoSchema>
