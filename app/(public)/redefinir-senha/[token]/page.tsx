'use client'

import { use, useActionState } from 'react'
import Link from 'next/link'
import { resetPassword, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Criar uma senha nova a partir do link de reset (AUTH-05). Consome
 * `resetPassword` (Plan 08), que usa o token single-use do Better Auth (deleta
 * a verification + revoga as sessões — revokeSessionsOnPasswordReset) e em
 * sucesso `redirect('/entrar?reset=ok')` (a tela de login mostra o aviso de
 * sucesso + sessões encerradas). Token inválido/expirado -> erro
 * "Esse link expirou. Pede um novo abaixo." + link para pedir um novo.
 *
 * Next 16: `params` é uma Promise; desembrulhada com React.use() neste client
 * component p/ manter o form (e os literais de aceite) num único arquivo.
 */
const initialState: AuthActionState = {}

export default function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, formAction, pending] = useActionState(resetPassword, initialState)
  const fieldErrors = state.fieldErrors ?? {}

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <form action={formAction} className="space-y-6" noValidate>
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Criar uma senha nova</h1>
        </header>

        {state.error && (
          <div role="alert" className="space-y-2 text-sm text-muted-foreground">
            <p>{state.error}</p>
            <p>
              <Link
                href="/esqueci-minha-senha"
                className="text-foreground underline underline-offset-4"
              >
                Pedir um novo link
              </Link>
            </p>
          </div>
        )}

        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nova senha</Label>
          {/* autocomplete="new-password" (React usa camelCase autoComplete) */}
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby={fieldErrors.newPassword ? 'newPassword-error' : 'newPassword-help'}
            aria-invalid={fieldErrors.newPassword ? true : undefined}
          />
          {fieldErrors.newPassword ? (
            <p id="newPassword-error" className="text-sm text-muted-foreground">
              {fieldErrors.newPassword[0]}
            </p>
          ) : (
            <p id="newPassword-help" className="text-sm text-muted-foreground">
              Mínimo 8 caracteres. Ao salvar, encerramos qualquer sessão antiga aberta.
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Enviando...' : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  )
}
