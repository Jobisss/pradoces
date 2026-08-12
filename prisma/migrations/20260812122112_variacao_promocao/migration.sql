-- AlterTable
ALTER TABLE "variacoes" ADD COLUMN     "preco_promocional" DECIMAL(19,4),
ADD COLUMN     "promocao_fim" DATE,
ADD COLUMN     "promocao_inicio" DATE;

-- Promoção manual por variação (sabor): all-or-nothing (os 3 campos juntos ou
-- nenhum), desconto de verdade (preço promocional > 0 e menor que o preço
-- cheio) e janela coerente (fim >= início — pode ser 1 dia só). Mesmo padrão
-- de CHECK de invariante em SCHEMA já usado em reservas_entrega_endereco_xor.
ALTER TABLE "variacoes" ADD CONSTRAINT variacoes_promocao_consistente CHECK (
  (preco_promocional IS NULL AND promocao_inicio IS NULL AND promocao_fim IS NULL)
  OR
  (preco_promocional IS NOT NULL AND promocao_inicio IS NOT NULL AND promocao_fim IS NOT NULL
   AND preco_promocional > 0 AND preco_promocional < preco_venda
   AND promocao_fim >= promocao_inicio)
);
