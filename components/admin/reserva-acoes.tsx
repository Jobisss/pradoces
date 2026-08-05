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
  apagarReserva,
  marcarPago,
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
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const PALAVRA_CONFIRMACAO = 'APAGAR'

const PROXIMO_LABEL: Record<string, string> = {
  CONFIRMADA: 'Marcar como pronta pra retirar',
  AGUARDANDO_RETIRADA: 'Marcar como retirada',
}

export function ReservaAcoes({
  reservaId,
  status,
  clienteId,
  clienteBloqueado,
  pago,
}: {
  reservaId: string
  status: string
  clienteId: string | null
  clienteBloqueado: boolean
  pago: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [motivoBloqueio, setMotivoBloqueio] = useState('')
  const [dialogBloqueio, setDialogBloqueio] = useState(false)
  const [dialogApagar, setDialogApagar] = useState(false)
  const [confirmoApagar, setConfirmoApagar] = useState(false)
  const [palavraDigitada, setPalavraDigitada] = useState('')

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
        {status !== 'CANCELADA' && (
          <Button
            size="sm"
            variant={pago ? 'outline' : 'secondary'}
            className="h-9"
            disabled={pending}
            onClick={() =>
              rodar(() => marcarPago(reservaId, !pago), pago ? 'Desmarcado como pago.' : 'Marcado como pago!')
            }
          >
            {pago ? '✓ Pago' : 'Marcar como pago'}
          </Button>
        )}

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

        {/* Reserva de convidado não tem User pra bloquear — só cliente com conta. */}
        {clienteId &&
          (clienteBloqueado ? (
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
                  <DialogDescription>
                    Ele não vai conseguir fazer novas reservas até você desbloquear.
                  </DialogDescription>
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
                    onClick={() => rodar(() => bloquearCliente(clienteId, motivoBloqueio), 'Cliente bloqueado.')}
                  >
                    Bloquear
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ))}

        <Dialog
          open={dialogApagar}
          onOpenChange={(open) => {
            setDialogApagar(open)
            if (!open) {
              setConfirmoApagar(false)
              setPalavraDigitada('')
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-9 text-destructive">
              Apagar reserva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apagar essa reserva pra sempre?</DialogTitle>
              <DialogDescription>
                Isso remove o registro do sistema — não dá pra desfazer. Se o pedido já foi confirmado, os
                itens vendidos e os pontos já creditados/debitados NÃO são revertidos automaticamente, só o
                registro da reserva some.
              </DialogDescription>
            </DialogHeader>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmoApagar} onCheckedChange={(v) => setConfirmoApagar(v === true)} />
              Tenho certeza, quero apagar essa reserva pra sempre.
            </label>

            <div className="space-y-1.5">
              <label htmlFor="confirma-apagar-reserva" className="text-sm text-muted-foreground">
                Digite <span className="font-semibold text-foreground">{PALAVRA_CONFIRMACAO}</span> pra
                confirmar
              </label>
              <Input
                id="confirma-apagar-reserva"
                value={palavraDigitada}
                onChange={(e) => setPalavraDigitada(e.target.value)}
                autoComplete="off"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogApagar(false)}>
                Deixa quieto
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending || !confirmoApagar || palavraDigitada !== PALAVRA_CONFIRMACAO}
                onClick={() =>
                  rodar(async () => {
                    const res = await apagarReserva(reservaId)
                    if (!res.error) setDialogApagar(false)
                    return res
                  }, 'Reserva apagada.')
                }
              >
                Apagar pra sempre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
