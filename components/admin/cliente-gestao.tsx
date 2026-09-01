'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ajustarPontosAdmin, alternarVip } from '@/lib/actions/clientes-admin'
import { bloquearCliente, desbloquearCliente } from '@/lib/actions/reservas-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type ClienteGestaoProps = {
  clienteId: string
  isVip: boolean
  bloqueado: boolean
  saldoBonusAdmin: number
}

/** VIP, bloqueio e ajuste manual de pontos — /admin/clientes/[id]. */
export function ClienteGestao({ clienteId, isVip, bloqueado, saldoBonusAdmin }: ClienteGestaoProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [valorPontos, setValorPontos] = useState('')
  const [motivoPontos, setMotivoPontos] = useState('')
  const [dialogBloqueio, setDialogBloqueio] = useState(false)
  const [motivoBloqueio, setMotivoBloqueio] = useState('')

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

  function ajustar(sinal: 1 | -1) {
    const num = Number(valorPontos.replace(',', '.'))
    if (!Number.isInteger(num) || num <= 0) {
      setError('Informa uma quantidade de pontos válida (número inteiro maior que zero).')
      return
    }
    rodar(
      () => ajustarPontosAdmin(clienteId, num * sinal, motivoPontos),
      sinal === 1 ? `${num} pontos de bônus adicionados!` : `${num} pontos removidos.`,
    )
    setValorPontos('')
    setMotivoPontos('')
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={isVip ? 'outline' : 'default'}
          className="h-9"
          disabled={pending}
          onClick={() =>
            rodar(() => alternarVip(clienteId, !isVip), isVip ? 'VIP removido.' : 'Cliente agora é VIP!')
          }
        >
          {isVip ? 'Remover VIP' : 'Tornar VIP'}
        </Button>

        {bloqueado ? (
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
                  onClick={() => {
                    rodar(() => bloquearCliente(clienteId, motivoBloqueio), 'Cliente bloqueado.')
                    setDialogBloqueio(false)
                  }}
                >
                  Bloquear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-base font-medium">Ajustar pontos manualmente</p>
        <p className="text-sm text-muted-foreground">
          Dá ou remove qualquer quantidade, sem limite. Bônus que você já deu pra esse cliente:{' '}
          {saldoBonusAdmin > 0 ? `${saldoBonusAdmin} pontos.` : 'nada ainda.'}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor="valor-pontos" className="text-sm font-medium">
              Quantidade
            </label>
            <Input
              id="valor-pontos"
              value={valorPontos}
              onChange={(e) => setValorPontos(e.target.value)}
              inputMode="numeric"
              className="w-28"
              placeholder="ex.: 50"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="motivo-pontos" className="text-sm font-medium">
              Motivo (opcional)
            </label>
            <Input
              id="motivo-pontos"
              value={motivoPontos}
              onChange={(e) => setMotivoPontos(e.target.value)}
              placeholder="ex.: aniversário, indicou uma amiga"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" className="h-9" disabled={pending} onClick={() => ajustar(1)}>
            Dar bônus
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => ajustar(-1)}
          >
            Remover
          </Button>
        </div>
      </div>
    </div>
  )
}
