import { z } from 'zod'
import { zDecimalBRL } from '@/lib/validation/decimal'

export const ConfigSchema = z.object({
  margemMinimaPadrao: zDecimalBRL.refine((v) => v.gte(0) && v.lt(100), 'Usa um número entre 0 e 99.'),
})

export type ConfigInput = z.infer<typeof ConfigSchema>
