-- AlterTable
ALTER TABLE "pontos_transacoes" ADD COLUMN     "sorteio_id" UUID;

-- AddForeignKey
ALTER TABLE "pontos_transacoes" ADD CONSTRAINT "pontos_transacoes_sorteio_id_fkey" FOREIGN KEY ("sorteio_id") REFERENCES "sorteios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
