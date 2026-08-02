import { z } from 'zod'
import { zDecimalBRL } from '@/lib/validation/decimal'

export const ConfigSchema = z.object({
  margemMinimaPadrao: zDecimalBRL.refine((v) => v.gte(0) && v.lt(100), 'Usa um número entre 0 e 99.'),
  pontosPorReal: zDecimalBRL.refine((v) => v.gte(0) && v.lte(100), 'Usa um número entre 0 e 100.'),
  pontosCapPorReserva: z.coerce.number().int().min(0, 'Não pode ser negativo.'),
  pontosExpiracaoMeses: z.coerce.number().int().min(1, 'Pelo menos 1 mês.'),
  janelaCancelamentoHoras: z.coerce.number().int().min(0, 'Não pode ser negativo.'),
})

export type ConfigInput = z.infer<typeof ConfigSchema>

export const SimuladorPontosSchema = z.object({
  pontosPorReal: zDecimalBRL.refine((v) => v.gte(0) && v.lte(100), 'Usa um número entre 0 e 100.'),
  capPorReserva: z.coerce.number().int().min(0, 'Não pode ser negativo.'),
})
