import { z } from 'zod'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const ReservaSchema = z.object({
  janelaRetirada: z.string().trim().min(1, OBRIGATORIO).max(120, 'Máximo 120 caracteres.'),
  observacao: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  itens: z
    .array(z.object({ loteId: z.string().uuid(), qtde: z.coerce.number().int().min(1) }))
    .min(1, 'Adiciona pelo menos um item ao carrinho.'),
})

export type ReservaInput = z.infer<typeof ReservaSchema>
