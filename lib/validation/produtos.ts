import { z } from 'zod'
import { zDecimalBRL } from '@/lib/validation/decimal'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const ProdutoSchema = z
  .object({
    nome: z.string().trim().min(1, OBRIGATORIO),
    descricao: z.string().trim().min(1, OBRIGATORIO),
    categoria: z.string().trim().min(1, OBRIGATORIO),
    tipo: z.enum(['UNITARIO', 'KIT']),
    precoVenda: zDecimalBRL,
    margemMinimaOverride: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    receitaId: z
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
    } else {
      if (!v.kitItens || v.kitItens.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'O kit precisa de pelo menos um item.', path: ['kitItens'] })
      }
      if (v.receitaId) {
        ctx.addIssue({ code: 'custom', message: 'Kit não tem receita própria.', path: ['receitaId'] })
      }
    }
  })

export type ProdutoInput = z.infer<typeof ProdutoSchema>
