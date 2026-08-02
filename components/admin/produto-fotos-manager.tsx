'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from 'lucide-react'
import { removerFotoProduto, reordenarFotosProduto } from '@/lib/actions/produto-fotos'
import { Button } from '@/components/ui/button'

type Foto = { id: string; path: string; ordem: number }

/**
 * PROD-04/05 — a primeira foto (ordem 0) é sempre a capa; reordenar é por
 * setas (não drag-and-drop) pra não puxar dependência nova só pra isso.
 */
export function ProdutoFotosManager({ produtoId, fotosIniciais }: { produtoId: string; fotosIniciais: Foto[] }) {
  const router = useRouter()
  const [fotos, setFotos] = useState(fotosIniciais)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setError(null)
    const formData = new FormData()
    formData.set('foto', arquivo)
    startTransition(async () => {
      const res: { error?: string; ok?: boolean; foto?: Foto } = await fetch(
        `/api/admin/produtos/${produtoId}/fotos`,
        { method: 'POST', body: formData },
      )
        .then((r) => r.json())
        .catch(() => ({ error: 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.' }))
      if (res.error || !res.foto) {
        setError(res.error ?? 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.')
      } else {
        setFotos((prev) => [...prev, res.foto as Foto])
        router.refresh()
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function handleRemover(fotoId: string) {
    setError(null)
    startTransition(async () => {
      const res = await removerFotoProduto(fotoId)
      if (res.error) {
        setError(res.error)
        return
      }
      setFotos((prev) => prev.filter((f) => f.id !== fotoId))
      router.refresh()
    })
  }

  function handleMover(index: number, direcao: -1 | 1) {
    const alvo = index + direcao
    if (alvo < 0 || alvo >= fotos.length) return
    const nova = [...fotos]
    ;[nova[index], nova[alvo]] = [nova[alvo], nova[index]]
    setFotos(nova)
    startTransition(async () => {
      const res = await reordenarFotosProduto(
        produtoId,
        nova.map((f) => f.id),
      )
      if (res.error) setError(res.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((foto, index) => (
            <div key={foto.id} className="relative overflow-hidden rounded-lg border border-border">
              <Image
                src={`/uploads/${foto.path}-medio.webp`}
                alt=""
                width={768}
                height={768}
                className="aspect-square w-full object-cover"
              />
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  Capa
                </span>
              )}
              <div className="flex items-center justify-between gap-1 bg-background/95 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Mover foto pra esquerda"
                  disabled={pending || index === 0}
                  onClick={() => handleMover(index, -1)}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive"
                  aria-label="Remover foto"
                  disabled={pending}
                  onClick={() => handleRemover(foto.id)}
                >
                  <XIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Mover foto pra direita"
                  disabled={pending || index === fotos.length - 1}
                  onClick={() => handleMover(index, 1)}
                >
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          id="foto-upload"
          className="hidden"
          onChange={handleUpload}
          disabled={pending}
        />
        <Button type="button" variant="outline" className="h-11" disabled={pending} asChild>
          <label htmlFor="foto-upload">{pending ? 'Enviando...' : 'Adicionar foto'}</label>
        </Button>
      </div>
    </div>
  )
}
