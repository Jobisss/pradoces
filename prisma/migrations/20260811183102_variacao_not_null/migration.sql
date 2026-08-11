/*
  Warnings:

  - Made the column `variacao_id` on table `lotes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `componente_variacao_id` on table `produto_kit_items` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "lotes" ALTER COLUMN "variacao_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "produto_kit_items" ALTER COLUMN "componente_variacao_id" SET NOT NULL;

-- Resgate de produto do catálogo sempre promete uma variação (sabor)
-- específica — variacao_id só pode ser NULL quando produto_id também é
-- (prêmio nomeCustom, sem produto nenhum).
ALTER TABLE "itens_resgataveis" ADD CONSTRAINT itens_resgataveis_variacao_com_produto CHECK (
  produto_id IS NULL OR variacao_id IS NOT NULL
);
