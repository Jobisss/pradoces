import type { Metadata } from 'next'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const metadata: Metadata = {
  title: 'Excluir minha conta — Luizinha Confeitaria',
}

/**
 * LGPD-05 — exclusão por anonimização, com confirmação por email DIGITADO (RSC).
 *
 * UI-SPEC §Destructive actions: a confirmação é digitação física do email, NÃO
 * um dialog "tem certeza?". O <form method="post"> posta nativamente para a
 * rota POST (sem JS de cliente); a rota valida confirmacao ===
 * session.user.email (anti-IDOR), anonimiza e redireciona para / com a msg de
 * sucesso. O CTA usa o destrutivo SÓLIDO (fundo --color-destructive, texto
 * branco) — aqui sim o tom é destrutivo.
 */
export default function ExcluirContaPage() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Excluir minha conta</h1>
          <p className="text-base text-muted-foreground">
            Seu nome, email e telefone vão sair do sistema. O histórico de reservas continua salvo
            (anônimo) por 5 anos por exigência fiscal. Você pode criar uma conta nova depois com o
            mesmo email, se quiser voltar.
          </p>
        </header>

        <Alert variant="destructive">
          <AlertTitle>Essa ação não pode ser desfeita.</AlertTitle>
        </Alert>

        <form method="post" action="/api/me/delete" className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="confirmacao">
              Para confirmar, digite seu email completo abaixo.
            </Label>
            <Input
              id="confirmacao"
              name="confirmacao"
              type="email"
              autoComplete="off"
              inputMode="email"
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            variant="destructive"
            className="w-full bg-destructive text-white hover:bg-destructive/90"
          >
            Excluir minha conta
          </Button>
        </form>
      </div>
    </div>
  )
}
