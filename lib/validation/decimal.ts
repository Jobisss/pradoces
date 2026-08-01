import Decimal from 'decimal.js'
import { z } from 'zod'

/**
 * Money/quantity string parsing — pt-BR vírgula decimal → Decimal. O ponto
 * flutuante nativo do JS não serve pra dinheiro, então o parse vai direto
 * pra Decimal, sem passar por nenhuma conversão numérica intermediária.
 *
 * Toda entrada monetária/de quantidade da Phase 2+ passa por aqui. Aceita
 * vírgula OU ponto como separador decimal; NÃO aceita separador de milhar
 * (D-02 nunca pede número grande o bastante pra precisar).
 */

const MENSAGEM_INVALIDA = 'Esse número não parece certo. Usa vírgula pros centavos: 5,80'

/** Dinheiro: até 13 dígitos inteiros, até 4 casas decimais. */
export const zDecimalBRL = z
  .string()
  .trim()
  .regex(/^\d{1,13}([.,]\d{1,4})?$/, MENSAGEM_INVALIDA)
  .transform((s) => new Decimal(s.replace(',', '.')))

/** Quantidade: até 11 dígitos inteiros, até 3 casas decimais. */
export const zQtdeBRL = z
  .string()
  .trim()
  .regex(/^\d{1,11}([.,]\d{1,3})?$/, MENSAGEM_INVALIDA)
  .transform((s) => new Decimal(s.replace(',', '.')))
