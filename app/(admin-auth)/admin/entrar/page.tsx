'use client'

import { useActionState } from 'react'
import * as authActions from '@/lib/actions/auth'
import type { AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Login admin (AUTH-10) — URL /admin/entrar, resolvida sob o grupo NÃO-guardado
 * (admin-auth) p/ não entrar em loop com o guard do Plan 03 (B1). Consome a
 * action admin (Plan 08), que só aceita role=admin, grava o evento admin_login
 * (D-08, sem email) e `redirect('/admin')`. Erro genérico não-enumerante
 * (mesmo literal de /entrar, NOTA W3).
 */
const initialState: AuthActionState = {}

export default function AdminEntrarPage() {
  const [state, formAction, pending] = useActionState(authActions.signinAdmin, initialState)

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <form action={formAction} className="space-y-6" noValidate>
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Entrar como administradora</h1>
        </header>

        {state.error && (
          <p role="alert" className="text-sm text-muted-foreground">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
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
      </form>
    </div>
  )
}
