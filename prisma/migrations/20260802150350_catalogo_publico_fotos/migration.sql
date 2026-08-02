-- CreateEnum
CREATE TYPE "Alergenico" AS ENUM ('GLUTEN', 'LEITE', 'OVO', 'AMENDOIM', 'CASTANHA', 'SOJA', 'DERIVADOS_SOJA');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "alergenicos" "Alergenico"[],
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "produto_fotos" (
    "id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produto_fotos_produto_id_ordem_key" ON "produto_fotos"("produto_id", "ordem");

-- AddForeignKey
ALTER TABLE "produto_fotos" ADD CONSTRAINT "produto_fotos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
