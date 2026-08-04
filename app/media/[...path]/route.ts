import { NextResponse, type NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Serve fotos de produto por Route Handler, NÃO pela pasta public/ estática.
 *
 * No Next 16 (output: 'standalone'), o servidor só serve arquivos de public/
 * que já existiam no momento do build (rastreados no manifest de
 * outputs.staticFiles do adapter) — um arquivo escrito em runtime por
 * lib/uploads/produto-foto.ts (upload de foto nova) fica no disco mas devolve
 * 404 se referenciado direto como /uploads/.... Route Handler roda por
 * request, então sempre lê o arquivo atual do disco.
 */

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads')

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params
  const rel = segments.join('/')

  const filePath = path.join(UPLOADS_ROOT, rel)
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep) || !filePath.endsWith('.webp')) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    const data = await readFile(filePath)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
