import { z } from 'zod'
import { zQtdeBRL } from '@/lib/validation/decimal'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const ProduzirLoteSchema = z.object({
  produtoId: z.string().uuid(),
  receitaId: z.string().uuid(),
  multiplicador: zQtdeBRL.refine((v) => v.gt(0), 'O multiplicador precisa ser maior que zero.'),
  rendimentoReal: z.coerce.number().int().min(1, 'Precisa ter saído pelo menos 1 unidade.'),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, OBRIGATORIO),
  linhas: z.array(z.object({ ingredienteCompraId: z.string().uuid(), qtde: zQtdeBRL })).min(1),
})

export type ProduzirLoteInput = z.infer<typeof ProduzirLoteSchema>
