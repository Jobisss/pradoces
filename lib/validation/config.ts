import { z } from 'zod'
import { zDecimalBRL } from '@/lib/validation/decimal'

// Limites do padrão Pix (BR Code/EMV): nome do beneficiário até 25 chars,
// cidade até 15 chars, ambos ASCII imprimível (sem acento) — validado aqui
// pra lib/pix.ts nunca precisar sanitizar em tempo de render.
const ASCII_SEM_ACENTO = /^[\x20-\x7E]*$/
const SEM_ACENTO_MSG = 'Sem acentos — é o limite do padrão Pix.'

export const ConfigSchema = z
  .object({
    margemMinimaPadrao: zDecimalBRL.refine((v) => v.gte(0) && v.lt(100), 'Usa um número entre 0 e 99.'),
    pontosPorReal: zDecimalBRL.refine((v) => v.gte(0) && v.lte(100), 'Usa um número entre 0 e 100.'),
    pontosCapPorReserva: z.coerce.number().int().min(0, 'Não pode ser negativo.'),
    pontosExpiracaoMeses: z.coerce.number().int().min(1, 'Pelo menos 1 mês.'),
    janelaCancelamentoHoras: z.coerce.number().int().min(0, 'Não pode ser negativo.'),
    taxaEntregaPadrao: zDecimalBRL.refine((v) => v.gte(0), 'Não pode ser negativo.'),
    entregaAtiva: z.boolean(),
    pixAtivo: z.boolean(),
    pixTipoChave: z.enum(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA']).optional(),
    pixChave: z
      .string()
      .trim()
      .max(140, 'Máximo 140 caracteres.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    pixNomeBeneficiario: z
      .string()
      .trim()
      .max(25, 'Máximo 25 caracteres — limite do padrão Pix.')
      .regex(ASCII_SEM_ACENTO, SEM_ACENTO_MSG)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    pixCidade: z
      .string()
      .trim()
      .max(15, 'Máximo 15 caracteres — limite do padrão Pix.')
      .regex(ASCII_SEM_ACENTO, SEM_ACENTO_MSG)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (!data.pixAtivo) return
    if (!data.pixTipoChave) {
      ctx.addIssue({ code: 'custom', path: ['pixTipoChave'], message: 'Escolhe o tipo de chave.' })
    }
    if (!data.pixChave) ctx.addIssue({ code: 'custom', path: ['pixChave'], message: 'Informa a chave Pix.' })
    if (!data.pixNomeBeneficiario) {
      ctx.addIssue({ code: 'custom', path: ['pixNomeBeneficiario'], message: 'Informa o nome do beneficiário.' })
    }
    if (!data.pixCidade) ctx.addIssue({ code: 'custom', path: ['pixCidade'], message: 'Informa a cidade.' })
  })

export type ConfigInput = z.infer<typeof ConfigSchema>

export const SimuladorPontosSchema = z.object({
  pontosPorReal: zDecimalBRL.refine((v) => v.gte(0) && v.lte(100), 'Usa um número entre 0 e 100.'),
  capPorReserva: z.coerce.number().int().min(0, 'Não pode ser negativo.'),
})
