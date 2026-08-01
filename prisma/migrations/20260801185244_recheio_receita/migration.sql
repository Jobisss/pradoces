-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "recheio_receita_id" UUID;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_recheio_receita_id_fkey" FOREIGN KEY ("recheio_receita_id") REFERENCES "receitas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
