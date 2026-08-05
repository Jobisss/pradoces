import { z } from 'zod'

const OBRIGATORIO = 'Esse campo é obrigatório.'
const EMAIL_INVALID = 'Esse email não parece certo. Confere o `@` e o `.com`.'

export const ReservaSchema = z
  .object({
    deliveryMode: z.enum(['PICKUP_ONLY', 'ENTREGA']).default('PICKUP_ONLY'),
    enderecoEntrega: z
      .string()
      .trim()
      .max(300, 'Máximo 300 caracteres.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    janelaRetirada: z.string().trim().min(1, OBRIGATORIO).max(120, 'Máximo 120 caracteres.'),
    observacao: z
      .string()
      .trim()
      .max(500, 'Máximo 500 caracteres.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    // Reserva de convidado (sem login) — sempre opcionais aqui, a
    // obrigatoriedade condicional (só quando não há sessão) é checada
    // imperativamente em criarReserva, depois de resolver a sessão real.
    nomeConvidado: z
      .string()
      .trim()
      .max(120, 'Máximo 120 caracteres.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    telefoneConvidado: z
      .string()
      .trim()
      .max(30, 'Máximo 30 caracteres.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    emailConvidado: z
      .string()
      .trim()
      .toLowerCase()
      .email(EMAIL_INVALID)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    itens: z
      .array(
        z.discriminatedUnion('tipo', [
          z.object({ tipo: z.literal('UNITARIO'), loteId: z.string().uuid(), qtde: z.coerce.number().int().min(1) }),
          z.object({ tipo: z.literal('KIT'), produtoId: z.string().uuid(), qtde: z.coerce.number().int().min(1) }),
        ]),
      )
      .min(1, 'Adiciona pelo menos um item ao carrinho.'),
  })
  .refine((data) => data.deliveryMode !== 'ENTREGA' || !!data.enderecoEntrega, {
    message: 'Informa o endereço pra entrega.',
    path: ['enderecoEntrega'],
  })

export type ReservaInput = z.infer<typeof ReservaSchema>
