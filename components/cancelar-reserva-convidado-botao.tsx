'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelarReservaConvidado } from '@/lib/actions/reservas'
import { Button } from '@/components/ui/button'

const JANELA_MS = 30_000

/** Mesmo padrão de CancelarReservaBotao (RES-09), mas pra reserva de convidado — usa o token do comprovante em vez de sessão. */
export function CancelarReservaConvidadoBotao({ token }: { token: string }) {
  const router = useRouter()
  const [cancelando, setCancelando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      // Se sair da página com o timer rodando, confirma o cancelamento em
      // vez de perder a intenção do cliente (evita "cancelamento fantasma").
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        void cancelarReservaConvidado(token)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function iniciar() {
    setErro(null)
    setCancelando(true)
    timeoutRef.current = setTimeout(async () => {
      const res = await cancelarReservaConvidado(token)
      if (res.error) {
        setErro(res.error)
        setCancelando(false)
        return
      }
      router.refresh()
    }, JANELA_MS)
  }

  function desfazer() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setCancelando(false)
  }

  if (erro) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {erro}
      </p>
    )
  }

  if (cancelando) {
    return (
      <p className="text-sm text-muted-foreground">
        Cancelando…{' '}
        <button type="button" onClick={desfazer} className="font-medium text-primary underline underline-offset-2">
          Desfazer
        </button>
      </p>
    )
  }

  return (
    <Button type="button" variant="outline" size="sm" className="h-9" onClick={iniciar}>
      Cancelar reserva
    </Button>
  )
}
