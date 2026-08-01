import { z } from 'zod'
import { zDecimalBRL, zQtdeBRL } from '@/lib/validation/decimal'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const CompraSchema = z.object({
  ingredienteId: z.string().uuid(),
  dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, OBRIGATORIO),
  mercado: z.string().trim().min(1, OBRIGATORIO),
  marca: z.string().trim().min(1, OBRIGATORIO),
  qtdeEmbalagens: zQtdeBRL,
  tamanhoEmbalagem: zQtdeBRL,
  precoPorEmbalagem: zDecimalBRL,
})

export type CompraInput = z.infer<typeof CompraSchema>
