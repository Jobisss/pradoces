'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { requestPasswordReset, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Recuperação de senha — pedir email (AUTH-05 / AUTH-07). Consome
 * `requestPasswordReset` (Plan 08), que SEMPRE retorna a mesma confirmação
 * genérica (anti-enumeração — não revela se o email existe). Em sucesso,
 * navega SEMPRE para /esqueci-minha-senha/enviado (mesmo destino p/ qualquer
 * input). Em rate-limit retorna erro e permanece na página.
 */
const initialState: AuthActionState = {}

export default function EsqueciSenhaPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.ok) router.push('/esqueci-minha-senha/enviado')
  }, [state.ok, router])

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <form action={formAction} className="space-y-6" noValidate>
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Recuperar minha senha</h1>
        </header>

        {state.error && (
          <p role="alert" className="text-sm text-muted-foreground">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Seu email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Enviando...' : 'Enviar link de recuperação'}
        </Button>
      </form>
    </div>
  )
}
