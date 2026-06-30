import { z } from 'zod'

/**
 * LGPD self-service validation (LGPD-05).
 *
 * The destructive "excluir minha conta" flow uses a typed-email confirmation
 * (UI-SPEC §Destructive actions — confirmação é digitação física, NÃO um dialog
 * "tem certeza?"). This schema only guarantees a non-empty string was typed; the
 * authoritative equality check (`confirmacao === session.user.email`) happens in
 * the route, against the SERVER session — never against any id/email from the
 * request body (T-01-11-01, anti-IDOR).
 */
export const DeleteAccountSchema = z.object({
  confirmacao: z.string().trim().min(1, 'Digite seu email completo pra confirmar.'),
})

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>
