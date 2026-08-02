import { z } from 'zod'

export const ItemResgatavelSchema = z
  .object({
    produtoId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    nomeCustom: z
      .string()
      .trim()
      .max(120, 'Máximo 120 caracteres.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    custoPontos: z.coerce.number().int().min(1, 'Precisa custar pelo menos 1 ponto.'),
    ativo: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    const temProduto = !!v.produtoId
    const temCustom = !!v.nomeCustom
    if (temProduto === temCustom) {
      ctx.addIssue({
        code: 'custom',
        message: 'Escolhe um produto do catálogo OU escreve um nome — nunca os dois, nem nenhum.',
        path: ['produtoId'],
      })
    }
  })

export type ItemResgatavelInput = z.infer<typeof ItemResgatavelSchema>
