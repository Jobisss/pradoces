import { z } from 'zod'

const OBRIGATORIO = 'Esse campo é obrigatório.'

export const SorteioSchema = z.object({
  nome: z.string().trim().min(1, OBRIGATORIO).max(120, 'Máximo 120 caracteres.'),
  premio: z.string().trim().min(1, OBRIGATORIO).max(200, 'Máximo 200 caracteres.'),
  custoPontos: z.coerce.number().int().min(1, 'Precisa custar pelo menos 1 ponto por chance.'),
  capPorCliente: z.coerce.number().int().min(1, 'Pelo menos 1 chance.'),
  prazo: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.'),
})

export type SorteioInput = z.infer<typeof SorteioSchema>
