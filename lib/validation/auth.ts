import { z } from 'zod'

/**
 * Auth Zod schemas (first-instance — PATTERNS §2.17).
 *
 * Error messages are the LITERAL UI-SPEC §Error/fallback copy. Every Server
 * Action in `lib/actions/auth.ts` parses through these; the copy surfaced to the
 * customer therefore stays consistent with the spec without per-action strings.
 *
 * The boolean consent fields (`isAdult`, `termsAccepted`) are validated with a
 * `=== true` refine instead of `z.literal(true)` so the action can pass a real
 * boolean (derived from the checkbox's `'on'`/absent value) and an unchecked box
 * is a HARD BLOCK (LGPD-01 / LGPD-02), never a silent default.
 */

const EMAIL_INVALID = 'Esse email não parece certo. Confere o `@` e o `.com`.'
const SENHA_CURTA = 'A senha precisa ter pelo menos 8 caracteres.'
const OBRIGATORIO = 'Esse campo é obrigatório.'
const PRECISA_18 = 'Você precisa confirmar que tem 18 anos ou mais pra criar a conta.'
const PRECISA_TERMOS = 'Pra criar a conta, você precisa aceitar os termos e a política de privacidade.'

export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email(EMAIL_INVALID),
  password: z.string().min(8, SENHA_CURTA),
  nome: z.string().trim().min(1, OBRIGATORIO),
  telefone: z.string().trim().min(1, OBRIGATORIO),
  isAdult: z.boolean().refine((v) => v === true, { message: PRECISA_18 }),
  termsAccepted: z.boolean().refine((v) => v === true, { message: PRECISA_TERMOS }),
})

export const SigninSchema = z.object({
  email: z.string().trim().toLowerCase().email(EMAIL_INVALID),
  password: z.string().min(1, OBRIGATORIO),
})

export const ForgotSchema = z.object({
  email: z.string().trim().toLowerCase().email(EMAIL_INVALID),
})

export const ResetSchema = z.object({
  token: z.string().min(1, OBRIGATORIO),
  newPassword: z.string().min(8, SENHA_CURTA),
})

export type SignupInput = z.infer<typeof SignupSchema>
export type SigninInput = z.infer<typeof SigninSchema>
export type ForgotInput = z.infer<typeof ForgotSchema>
export type ResetInput = z.infer<typeof ResetSchema>
