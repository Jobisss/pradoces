import { z } from 'zod'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const IngredienteSchema = z.object({
  nome: z.string().trim().min(1, OBRIGATORIO),
  unidadeBase: z.enum(['g', 'ml', 'un']),
  tipo: z.enum(['INGREDIENTE', 'EMBALAGEM']),
})

export type IngredienteInput = z.infer<typeof IngredienteSchema>
