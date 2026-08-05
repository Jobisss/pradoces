'use client'

import { Suspense, useActionState, useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { checkEmailExists, signupCustomer, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

/**
 * Cadastro inteligente email-first (AUTH-01/02/03 + LGPD-01/02), 2 passos numa rota.
 *
 * Passo 1 ('email'): só o email -> checkEmailExists.
 *   - existe (não anonimizado) -> branch AUTH-03 ('exists'): "talvez digitou errado".
 *   - não existe -> passo 2 ('details').
 * Passo 2 ('details'): senha + nome + telefone + checkbox +18 (LGPD-01) +
 *   checkbox termos (LGPD-02) -> signupCustomer (Server Action), que valida no Zod,
 *   grava consentimento versionado e redireciona para /cadastro/verifique-seu-email.
 *
 * Acessibilidade (UI-SPEC §Interaction): labels explícitos, erros em caption 14px
 * associados via aria-describedby (não em vermelho — destructive é reservado pra
 * estados catastróficos), autoComplete/inputMode corretos, CTA sticky no mobile.
 */

type Step = 'email' | 'exists' | 'details'

const initialState: AuthActionState = {}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {message}
    </p>
  )
}

/**
 * Reserva de convidado -> "quero acompanhar" (app/(public)/r/[token]/page.tsx)
 * chega aqui com nome/telefone/email/fromReserva na URL. Quando fromReserva
 * está presente, pula direto pro passo de senha (o email já é conhecido —
 * checkEmailExists não roda porque o link só existe pra email sem conta).
 */
function PrefillDeReserva({
  onPrefill,
}: {
  onPrefill: (data: { nome: string; telefone: string; email: string; fromReserva: string }) => void
}) {
  const params = useSearchParams()
  const fromReserva = params.get('fromReserva')
  useEffect(() => {
    if (!fromReserva) return
    onPrefill({
      nome: params.get('nome') ?? '',
      telefone: params.get('telefone') ?? '',
      email: params.get('email') ?? '',
      fromReserva,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromReserva])
  return null
}

export default function CadastroPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()
  const [state, formAction, submitting] = useActionState(signupCustomer, initialState)
  const [prefillNome, setPrefillNome] = useState('')
  const [prefillTelefone, setPrefillTelefone] = useState('')
  const [fromReserva, setFromReserva] = useState('')

  function handleEmailContinue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEmailError(null)
    const value = email.trim().toLowerCase()
    if (!value || !value.includes('@') || !value.includes('.')) {
      setEmailError('Esse email não parece certo. Confere o `@` e o `.com`.')
      return
    }
    startCheck(async () => {
      const { exists } = await checkEmailExists(value)
      setStep(exists ? 'exists' : 'details')
    })
  }

  const fieldErrors = state.fieldErrors ?? {}

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <Suspense fallback={null}>
        <PrefillDeReserva
          onPrefill={({ nome, telefone, email: emailPrefill, fromReserva: token }) => {
            setEmail(emailPrefill)
            setPrefillNome(nome)
            setPrefillTelefone(telefone)
            setFromReserva(token)
            setStep('details')
          }}
        />
      </Suspense>

      {step === 'email' && (
        <form onSubmit={handleEmailContinue} className="space-y-6" noValidate>
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold md:text-3xl">Vamos começar com seu email</h1>
          </header>

          <div className="space-y-1.5">
            <Label htmlFor="email">Seu email</Label>
            {/* autoComplete maps to the HTML autocomplete="email" attribute */}
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={emailError ? 'email-error' : 'email-help'}
              aria-invalid={emailError ? true : undefined}
            />
            {emailError ? (
              <FieldError id="email-error" message={emailError} />
            ) : (
              <p id="email-help" className="text-sm text-muted-foreground">
                A gente vai mandar um link de confirmação pra esse endereço.
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={checking}>
            {checking ? 'Enviando...' : 'Continuar'}
          </Button>
        </form>
      )}

      {step === 'exists' && (
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold md:text-3xl">Esse email já tem conta</h1>
            <p className="text-base text-muted-foreground">
              Esse email já tem conta. Talvez você tenha digitado errado — quer tentar fazer login?
            </p>
          </header>
          <div className="space-y-3">
            <Button asChild size="lg" className="w-full">
              <Link href="/entrar">Tentar fazer login</Link>
            </Button>
            <button
              type="button"
              onClick={() => {
                setEmail('')
                setStep('email')
              }}
              className="w-full text-sm text-foreground underline underline-offset-4"
            >
              Não, é outro email
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <form action={formAction} className="space-y-6 pb-24 md:pb-0" noValidate>
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold md:text-3xl">
              {fromReserva ? 'Só falta a senha' : 'Faltam só alguns dados'}
            </h1>
          </header>

          {state.error && !state.fieldErrors && (
            <p role="alert" className="text-sm text-muted-foreground">
              {state.error}
            </p>
          )}

          {/* email confirmed in step 1 — carried forward as a hidden field */}
          <input type="hidden" name="email" value={email} />
          {/* rastreabilidade — a vinculação em si roda por email (ver afterEmailVerification) */}
          {fromReserva && <input type="hidden" name="fromReserva" value={fromReserva} />}

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            {/* autoComplete maps to the HTML autocomplete="new-password" attribute */}
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby={fieldErrors.password ? 'password-error' : 'password-help'}
              aria-invalid={fieldErrors.password ? true : undefined}
            />
            {fieldErrors.password ? (
              <FieldError id="password-error" message={fieldErrors.password[0]} />
            ) : (
              <p id="password-help" className="text-sm text-muted-foreground">
                Mínimo 8 caracteres. Use o que você lembra — não precisa ser difícil.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Como a gente te chama</Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              autoComplete="name"
              required
              defaultValue={prefillNome}
              aria-describedby={fieldErrors.nome ? 'nome-error' : undefined}
              aria-invalid={fieldErrors.nome ? true : undefined}
            />
            <FieldError id="nome-error" message={fieldErrors.nome?.[0]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone com DDD</Label>
            <Input
              id="telefone"
              name="telefone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              defaultValue={prefillTelefone}
              aria-describedby={fieldErrors.telefone ? 'telefone-error' : 'telefone-help'}
              aria-invalid={fieldErrors.telefone ? true : undefined}
            />
            {fieldErrors.telefone ? (
              <FieldError id="telefone-error" message={fieldErrors.telefone[0]} />
            ) : (
              <p id="telefone-help" className="text-sm text-muted-foreground">
                Pra mãe poder te avisar pelo WhatsApp.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox id="isAdult" name="isAdult" className="mt-0.5" />
              <Label htmlFor="isAdult" className="text-sm leading-snug font-normal">
                Tenho 18 anos ou mais, ou estou com autorização de quem cuida de mim.
              </Label>
            </div>
            <FieldError id="isAdult-error" message={fieldErrors.isAdult?.[0]} />

            <div className="flex items-start gap-3">
              <Checkbox id="termsAccepted" name="termsAccepted" className="mt-0.5" />
              <Label htmlFor="termsAccepted" className="text-sm leading-snug font-normal">
                Li e aceito os{' '}
                <Link href="/termos" className="text-primary underline underline-offset-2">
                  termos de uso
                </Link>{' '}
                e a{' '}
                <Link href="/privacidade" className="text-primary underline underline-offset-2">
                  política de privacidade
                </Link>
                .
              </Label>
            </div>
            <FieldError id="termsAccepted-error" message={fieldErrors.termsAccepted?.[0]} />
          </div>

          {/* Sticky no mobile (form longo, UI-SPEC §Mobile-First); in-flow no ≥md */}
          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 md:static md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto w-full max-w-md">
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Criar minha conta'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
