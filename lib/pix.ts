import 'server-only'
import { createStaticPix, hasError } from 'pix-utils'
import QRCode from 'qrcode'

/**
 * Pix estático (BR Code/EMV) com valor embutido por reserva — "dinâmico" aqui
 * significa só "o valor muda por reserva", NÃO é o "Pix Dinâmico" técnico do
 * Banco Central (que exige um endpoint JSON de um PSP registrado). Por isso
 * `createStaticPix`, nunca `createDynamicPix`. É estritamente exibição — sem
 * gateway, sem webhook, sem confirmação automática (a mãe confirma manual,
 * como sempre — ver Reserva.pago).
 */
export function montarPixPayload(input: {
  chave: string
  nomeBeneficiario: string
  cidade: string
  valor: number
  /** Normalmente o token (uuid) da reserva — truncado pro limite do campo txid do EMV. */
  txid: string
}): string {
  const pix = createStaticPix({
    pixKey: input.chave,
    merchantName: input.nomeBeneficiario,
    merchantCity: input.cidade,
    transactionAmount: input.valor,
    // Tag txid do EMV Pix aceita só alfanumérico, até 25 chars.
    txid: input.txid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25).toUpperCase(),
  })
  if (hasError(pix)) throw new Error(pix.message)
  return pix.toBRCode()
}

export async function gerarPixQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 240 })
}
