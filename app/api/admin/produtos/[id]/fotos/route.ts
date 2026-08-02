import { NextResponse, type NextRequest } from 'next/server'
import { processarUploadFoto } from '@/lib/uploads/produto-foto'
import { clientIp } from '@/lib/net/client-ip'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await request.formData()
  const result = await processarUploadFoto(id, clientIp(request.headers), formData)
  return NextResponse.json({ error: result.error, ok: result.ok, foto: result.foto }, { status: result.status })
}
