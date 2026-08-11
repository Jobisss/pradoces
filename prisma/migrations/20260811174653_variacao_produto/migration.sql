-- AlterTable
ALTER TABLE "itens_resgataveis" ADD COLUMN     "variacao_id" UUID;

-- AlterTable
ALTER TABLE "lotes" ADD COLUMN     "variacao_id" UUID;

-- AlterTable
ALTER TABLE "produto_kit_items" ADD COLUMN     "componente_variacao_id" UUID;

-- AlterTable
ALTER TABLE "produtos" ALTER COLUMN "preco_venda" DROP NOT NULL;

-- CreateTable
CREATE TABLE "variacoes" (
    "id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "recheio_receita_id" UUID,
    "recheio_gramas_usadas" DECIMAL(10,3),
    "preco_venda" DECIMAL(19,4) NOT NULL,
    "margem_minima_override" DECIMAL(5,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "variacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variacoes_produto_id_idx" ON "variacoes"("produto_id");

-- AddForeignKey
ALTER TABLE "variacoes" ADD CONSTRAINT "variacoes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variacoes" ADD CONSTRAINT "variacoes_recheio_receita_id_fkey" FOREIGN KEY ("recheio_receita_id") REFERENCES "receitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_kit_items" ADD CONSTRAINT "produto_kit_items_componente_variacao_id_fkey" FOREIGN KEY ("componente_variacao_id") REFERENCES "variacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_variacao_id_fkey" FOREIGN KEY ("variacao_id") REFERENCES "variacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_resgataveis" ADD CONSTRAINT "itens_resgataveis_variacao_id_fkey" FOREIGN KEY ("variacao_id") REFERENCES "variacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
