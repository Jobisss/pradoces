import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { prisma } from '@/lib/db/client'

/**
 * Viewer de auditoria (AUTH-11) — RSC sob o layout guardado (Plan 03). Lista o
 * audit_log mais recente no topo, traduzindo cada `action` para uma frase
 * pt-BR (ACTION_COPY). A metadata é renderizada como TEXTO (React escapa) —
 * nunca como HTML cru (XSS-safe).
 */
const ACTION_COPY: Record<string, string> = {
  admin_login: 'entrou no painel',
  admin_seed_via_cli: 'foi criada via comando do dev',
  admin_password_reset_via_cli: 'teve a senha redefinida pelo dev',
  customer_signup: 'criou conta',
  customer_email_verified: 'confirmou email',
  customer_password_reset: 'redefiniu a senha',
  customer_account_deleted: 'excluiu a conta',
  compra_registrada: 'registrou uma compra',
  compra_corrigida: 'corrigiu uma compra',
  compra_excluida: 'excluiu uma compra',
  receita_alterada: 'mexeu numa receita',
  preco_alterado: 'mudou o preço de um produto',
  lote_criado: 'registrou um lote produzido',
}

function actorLabel(actorType: string): string {
  switch (actorType) {
    case 'admin':
      return 'você'
    case 'customer':
      return 'um cliente'
    case 'cli':
      return 'o dev'
    case 'system':
      return 'o sistema'
    default:
      return actorType
  }
}

function whenLabel(ts: Date): string {
  return isToday(ts)
    ? format(ts, "'Hoje, 'HH:mm", { locale: ptBR })
    : format(ts, "dd/MM/yyyy, HH:mm", { locale: ptBR })
}

export default async function AuditPage() {
  const events = await prisma.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 200 })

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">Quem fez o quê</h1>
        {events.length === 0 ? (
          <div className="space-y-1">
            <p className="text-base font-medium">Nenhum evento ainda</p>
            <p className="text-sm text-muted-foreground">
              Quando alguém entrar no painel ou mexer em alguma coisa importante, vai aparecer aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={String(e.id)} className="py-3 text-sm">
                <span>
                  {whenLabel(e.ts)} — {actorLabel(e.actorType)} — {ACTION_COPY[e.action] ?? e.action}
                </span>
                {e.metadata ? (
                  <span className="block text-xs text-muted-foreground">
                    {JSON.stringify(e.metadata)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
