import { z } from 'zod'
import { zDecimalBRL, zQtdeBRL } from '@/lib/validation/decimal'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const ReceitaSchema = z
  .object({
    nome: z.string().trim().min(1, OBRIGATORIO),
    rendimentoPadrao: z.coerce.number().int().min(1, 'Precisa render pelo menos 1 unidade.'),
    custoGas: zDecimalBRL.optional().or(z.literal('').transform(() => undefined)),
    validadeDias: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    itens: z
      .array(z.object({ ingredienteId: z.string().uuid(), qtde: zQtdeBRL }))
      .min(1, 'A receita precisa de pelo menos um ingrediente.'),
  })
  .refine(
    (data) => new Set(data.itens.map((item) => item.ingredienteId)).size === data.itens.length,
    { message: 'Cada ingrediente só pode aparecer uma vez na receita.', path: ['itens'] },
  )

export type ReceitaInput = z.infer<typeof ReceitaSchema>
