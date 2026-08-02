'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  confirmarReserva,
  rejeitarReserva,
  avancarStatusReserva,
  marcarNoShow,
  bloquearCliente,
  desbloquearCliente,
} from '@/lib/actions/reservas-admin'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const PROXIMO_LABEL: Record<string, string> = {
  CONFIRMADA: 'Marcar como pronta pra retirar',
  AGUARDANDO_RETIRADA: 'Marcar como retirada',
}

export function ReservaAcoes({
  reservaId,
  status,
  clienteId,
  clienteBloqueado,
}: {
  reservaId: string
  status: string
  clienteId: string
  clienteBloqueado: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [motivoBloqueio, setMotivoBloqueio] = useState('')
  const [dialogBloqueio, setDialogBloqueio] = useState(false)

  function rodar(acao: () => Promise<{ error?: string; ok?: boolean }>, sucesso: string) {
    setError(null)
    startTransition(async () => {
      const res = await acao()
      if (res.error) {
        setError(res.error)
        return
      }
      toast(sucesso)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'PENDENTE' && (
          <>
            <Button
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => rodar(() => confirmarReserva(reservaId), 'Reserva confirmada!')}
            >
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={pending}
              onClick={() => rodar(() => rejeitarReserva(reservaId), 'Reserva recusada.')}
            >
              Recusar
            </Button>
          </>
        )}

        {(status === 'CONFIRMADA' || status === 'AGUARDANDO_RETIRADA') && (
          <>
            <Button
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => rodar(() => avancarStatusReserva(reservaId), 'Atualizado.')}
            >
              {PROXIMO_LABEL[status]}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={pending}
              onClick={() => rodar(() => marcarNoShow(reservaId), 'Marcado como não retirada.')}
            >
              Não retirou
            </Button>
          </>
        )}

        {clienteBloqueado ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => rodar(() => desbloquearCliente(clienteId), 'Cliente desbloqueado.')}
          >
            Desbloquear cliente
          </Button>
        ) : (
          <Dialog open={dialogBloqueio} onOpenChange={setDialogBloqueio}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-9 text-destructive">
                Bloquear cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bloquear esse cliente?</DialogTitle>
                <DialogDescription>Ele não vai conseguir fazer novas reservas até você desbloquear.</DialogDescription>
              </DialogHeader>
              <Textarea
                value={motivoBloqueio}
                onChange={(e) => setMotivoBloqueio(e.target.value)}
                placeholder="Motivo (ex.: faltou 3 vezes sem avisar)"
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogBloqueio(false)}>
                  Deixa quieto
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    rodar(() => bloquearCliente(clienteId, motivoBloqueio), 'Cliente bloqueado.')
                  }
                >
                  Bloquear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
