import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { History, User, ShieldCheck, Terminal, Cog } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { PageHeader, SurfaceCard, EmptyState } from '@/components/admin/ui'

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

const ATOR = {
  admin: { label: 'você', icone: ShieldCheck },
  customer: { label: 'um cliente', icone: User },
  cli: { label: 'o dev', icone: Terminal },
  system: { label: 'o sistema', icone: Cog },
} as const

function actorLabel(actorType: string): string {
  return ATOR[actorType as keyof typeof ATOR]?.label ?? actorType
}

function whenLabel(ts: Date): string {
  return isToday(ts)
    ? format(ts, "'Hoje, 'HH:mm", { locale: ptBR })
    : format(ts, 'dd/MM/yyyy, HH:mm', { locale: ptBR })
}

export default async function AuditPage() {
  const events = await prisma.auditLog.findMany({ orderBy: { ts: 'desc' }, take: 200 })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Quem fez o quê"
        subtitle={
          events.length === 0
            ? 'Nenhum evento registrado ainda'
            : `Últimos ${events.length} eventos, mais recente primeiro`
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum evento ainda"
          description="Quando alguém entrar no painel ou mexer em alguma coisa importante, vai aparecer aqui."
        />
      ) : (
        <SurfaceCard>
          <ul className="divide-y divide-border">
            {events.map((e) => {
              const Icone = ATOR[e.actorType as keyof typeof ATOR]?.icone ?? Cog
              return (
                <li key={String(e.id)} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                    <Icone className="size-4 text-caramelo" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-sm">
                      {whenLabel(e.ts)} — {actorLabel(e.actorType)} —{' '}
                      <span className="font-medium">{ACTION_COPY[e.action] ?? e.action}</span>
                    </span>
                    {e.metadata ? (
                      <span className="block break-all font-mono text-xs text-muted-foreground">
                        {JSON.stringify(e.metadata)}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </SurfaceCard>
      )}
    </div>
  )
}
