'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signinUser, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Login cliente (AUTH-08 / AUTH-07). Consome a Server Action `signinUser` do
 * Plan 08, que em sucesso seta o cookie (nextCookies) e `redirect('/')`, e em
 * falha retorna o erro genérico não-enumerante de credencial inválida (NOTA W3
 * — literal idêntico ao Plan 08; mesmo texto para email inexistente e senha
 * errada). Vive sob (public) p/ herdar o shell Header/Footer (D-03).
 *
 * Quando volta de um reset bem-sucedido (resetPassword -> /entrar?reset=ok),
 * mostra o aviso de sucesso + sessões encerradas (AUTH-05).
 */
const initialState: AuthActionState = {}

export default function EntrarPage() {
  const [state, formAction, pending] = useActionState(signinUser, initialState)
  const resetOk = useSearchParams().get('reset') === 'ok'

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <form action={formAction} className="space-y-6" noValidate>
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Entrar</h1>
        </header>

        {resetOk && (
          <div role="status" className="rounded-lg border border-border bg-card p-3 text-sm">
            Pronto! Sua senha foi atualizada. Pode entrar com a nova. Por segurança, encerramos
            qualquer sessão antiga aberta.
          </div>
        )}

        {/* Erro genérico AUTH-07 (vem da action): "Email ou senha não conferem" */}
        {state.error && (
          <p role="alert" className="text-sm text-muted-foreground">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Seu email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Enviando...' : 'Entrar'}
        </Button>

        <div className="space-y-2 text-sm">
          <p>
            <Link href="/esqueci-minha-senha" className="text-foreground underline underline-offset-4">
              Esqueci minha senha
            </Link>
          </p>
          <p className="text-muted-foreground">
            Ainda não tem conta?{' '}
            <Link href="/cadastro" className="text-primary underline underline-offset-4">
              Criar agora
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}
