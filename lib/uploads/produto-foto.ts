import 'server-only'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rateLimitAuth } from '@/lib/ratelimit/memory'

/**
 * PROD-04/05 — núcleo do upload de foto, chamado pelo Route Handler
 * (app/api/admin/produtos/[id]/fotos/route.ts), NÃO por uma Server Action:
 * Server Actions neste projeto têm `bodySizeLimit: '1mb'` fixado de propósito
 * em next.config.ts (hardening geral contra payload grande em ações de
 * auth/formulário) — subir isso globalmente só pra caber uma foto de até
 * 8MB enfraqueceria esse limite pra TODAS as actions. Route Handler não tem
 * esse teto do Next, então o upload vive aqui.
 *
 * Nunca serve o arquivo original — só os 3 derivados WebP (thumb 320/medio
 * 768/grande 1280), gerados a partir de um master limitado a 1920px que fica
 * só em memória. Arquivos vivem em public/uploads/ (fora do git, volume
 * Docker em prod — ver .gitignore e docker-compose.yml); `ProdutoFoto.path`
 * guarda o prefixo sem sufixo/extensão, os 3 tamanhos derivam dele.
 *
 * Servidos por app/media/[...path]/route.ts, NÃO por referência direta a
 * /uploads/... — no Next 16 standalone o servidor só serve estático de
 * public/ o que já existia no build; foto nova gravada em runtime aqui
 * devolveria 404 se lida como arquivo estático. Ver comentário na route.
 */

const GENERIC_SERVER_ERROR = 'Algo não deu certo do nosso lado. Tente de novo em alguns segundos.'
const TAMANHOS = [
  { sufixo: 'thumb', largura: 320 },
  { sufixo: 'medio', largura: 768 },
  { sufixo: 'grande', largura: 1280 },
] as const

export const MAX_BYTES = 8 * 1024 * 1024

export type UploadFotoResult = {
  error?: string
  ok?: boolean
  status: number
  foto?: { id: string; path: string; ordem: number }
}

function uploadsRoot() {
  return path.join(process.cwd(), 'public', 'uploads', 'produtos')
}

export async function processarUploadFoto(produtoId: string, ip: string, formData: FormData): Promise<UploadFotoResult> {
  const rl = await rateLimitAuth.consume(ip).catch(() => null)
  if (rl === null) return { error: 'Muitas tentativas seguidas. Espera um minutinho e tenta de novo.', status: 429 }

  try {
    await requireAdmin()
  } catch {
    return { error: GENERIC_SERVER_ERROR, status: 401 }
  }

  const produto = await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true } })
  if (!produto) return { error: GENERIC_SERVER_ERROR, status: 404 }

  const arquivo = formData.get('foto')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: 'Escolhe uma foto pra enviar.', status: 400 }
  }
  if (!arquivo.type.startsWith('image/')) {
    return { error: 'Isso não parece uma imagem. Manda um JPG, PNG ou WebP.', status: 400 }
  }
  if (arquivo.size > MAX_BYTES) {
    return { error: 'Essa foto é grande demais (máximo 8MB). Tenta uma versão menor.', status: 400 }
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  let master: Buffer
  try {
    master = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .toBuffer()
  } catch {
    return { error: 'Não consegui ler essa imagem. Tenta outro arquivo.', status: 400 }
  }

  const fotoId = randomUUID()
  const dir = path.join(uploadsRoot(), produtoId)
  await mkdir(dir, { recursive: true })

  try {
    await Promise.all(
      TAMANHOS.map(({ sufixo, largura }) =>
        sharp(master)
          .resize({ width: largura, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(path.join(dir, `${fotoId}-${sufixo}.webp`)),
      ),
    )
  } catch {
    return { error: GENERIC_SERVER_ERROR, status: 500 }
  }

  const ordemAtual = await prisma.produtoFoto.count({ where: { produtoId } })
  const fotoPath = `produtos/${produtoId}/${fotoId}`

  try {
    await prisma.produtoFoto.create({
      data: { id: fotoId, produtoId, ordem: ordemAtual, path: fotoPath },
    })
  } catch {
    return { error: GENERIC_SERVER_ERROR, status: 500 }
  }

  revalidatePath(`/admin/produtos/${produtoId}/editar`)
  revalidatePath(`/produtos/${produtoId}`)
  revalidatePath('/')
  return { ok: true, status: 200, foto: { id: fotoId, path: fotoPath, ordem: ordemAtual } }
}
