import { notFound } from 'next/navigation'
import { buscarClienteAdmin } from '@/lib/clientes/queries'
import { ClienteGestao } from '@/components/admin/cliente-gestao'
import { instanteFmtBR } from '@/lib/format/date'

export default async function ClienteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await buscarClienteAdmin(id)
  if (!cliente) notFound()

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">{cliente.name}</h1>
        <p className="text-sm text-muted-foreground">
          {cliente.email}
          {cliente.telefone ? ` · ${cliente.telefone}` : ''}
        </p>
        {cliente.banned && cliente.banReason && (
          <p className="text-sm text-destructive">Bloqueado: {cliente.banReason}</p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="tabular-nums text-2xl font-semibold">{cliente.saldoPontos} pontos</p>
        <p className="text-sm text-muted-foreground">Saldo atual (soma de todo o histórico)</p>
      </div>

      <ClienteGestao
        clienteId={cliente.id}
        isVip={cliente.isVip}
        bloqueado={cliente.banned}
        saldoBonusAdmin={cliente.saldoBonusAdmin}
      />

      {cliente.ajustesAdmin.length > 0 && (
        <div className="space-y-2">
          <p className="text-base font-medium">Ajustes manuais que você já fez</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {cliente.ajustesAdmin.map((a) => (
              <li key={a.id} className="tabular-nums">
                {a.valor > 0 ? '+' : ''}
                {a.valor} pontos — {instanteFmtBR.format(a.criadoEm)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
