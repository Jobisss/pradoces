import { z } from 'zod'
import { zQtdeBRL } from '@/lib/validation/decimal'

const OBRIGATORIO = 'Esse campo é obrigatório.'

/**
 * D-13 — uma fornada da receita base pode virar lotes de VÁRIAS variações de
 * uma vez ("fiz 5 desse, 3 desse"). `linhasBase` cobre a fornada inteira
 * (checagem exata contra receita.itens × multiplicador, igual antes);
 * `variacoes` tem 1 entrada por variação que saiu ALGO nessa fornada — quem
 * saiu 0 simplesmente não entra no array (sem lote pra ela, ver
 * lib/actions/lotes.ts).
 */
export const ProduzirLotesSchema = z.object({
  produtoId: z.string().uuid(),
  receitaId: z.string().uuid(),
  multiplicador: zQtdeBRL.refine((v) => v.gt(0), 'O multiplicador precisa ser maior que zero.'),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, OBRIGATORIO),
  linhasBase: z.array(z.object({ ingredienteCompraId: z.string().uuid(), qtde: zQtdeBRL })).min(1),
  variacoes: z
    .array(
      z.object({
        variacaoId: z.string().uuid(),
        rendimentoReal: z.coerce.number().int().min(1, 'Precisa ter saído pelo menos 1 unidade.'),
        linhasRecheio: z.array(z.object({ ingredienteCompraId: z.string().uuid(), qtde: zQtdeBRL })),
      }),
    )
    .min(1, 'Informa quantas unidades saíram de pelo menos uma variação.'),
})

export type ProduzirLotesInput = z.infer<typeof ProduzirLotesSchema>

/** Baixa manual de estoque sem venda (ex.: venceu antes de vender, estragou). */
export const BaixarLoteSchema = z.object({
  loteId: z.string().uuid(),
  qtde: z.coerce.number().int().min(1, 'Precisa baixar pelo menos 1 unidade.'),
  motivo: z.enum(['VENCIDO', 'DANIFICADO', 'OUTRO']),
  observacao: z
    .string()
    .trim()
    .max(500, 'Máximo de 500 caracteres.')
    .optional()
    .transform((s) => (s ? s : undefined)),
})

export type BaixarLoteInput = z.infer<typeof BaixarLoteSchema>
