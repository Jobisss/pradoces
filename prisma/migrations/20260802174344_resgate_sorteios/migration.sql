-- CreateEnum
CREATE TYPE "TipoReserva" AS ENUM ('PADRAO', 'RESGATE');

-- CreateEnum
CREATE TYPE "SorteioStatus" AS ENUM ('ABERTO', 'ENCERRADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PontosMotivo" ADD VALUE 'RESGATE';
ALTER TYPE "PontosMotivo" ADD VALUE 'RESGATE_REJEITADO';
ALTER TYPE "PontosMotivo" ADD VALUE 'SORTEIO';

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "item_resgatavel_id" UUID,
ADD COLUMN     "tipo" "TipoReserva" NOT NULL DEFAULT 'PADRAO';

-- CreateTable
CREATE TABLE "itens_resgataveis" (
    "id" UUID NOT NULL,
    "produto_id" UUID,
    "nome_custom" TEXT,
    "custo_pontos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_resgataveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorteios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "premio" TEXT NOT NULL,
    "foto_path" TEXT,
    "custo_pontos" INTEGER NOT NULL,
    "cap_por_cliente" INTEGER NOT NULL DEFAULT 10,
    "prazo" TIMESTAMPTZ(6) NOT NULL,
    "status" "SorteioStatus" NOT NULL DEFAULT 'ABERTO',
    "random_seed" TEXT,
    "vencedor_id" UUID,
    "snapshot_inscritos" JSONB,
    "encerrado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sorteios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorteio_chances" (
    "id" UUID NOT NULL,
    "sorteio_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sorteio_chances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sorteios_status_idx" ON "sorteios"("status");

-- CreateIndex
CREATE INDEX "sorteio_chances_sorteio_id_idx" ON "sorteio_chances"("sorteio_id");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_item_resgatavel_id_fkey" FOREIGN KEY ("item_resgatavel_id") REFERENCES "itens_resgataveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_resgataveis" ADD CONSTRAINT "itens_resgataveis_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorteios" ADD CONSTRAINT "sorteios_vencedor_id_fkey" FOREIGN KEY ("vencedor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorteio_chances" ADD CONSTRAINT "sorteio_chances_sorteio_id_fkey" FOREIGN KEY ("sorteio_id") REFERENCES "sorteios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorteio_chances" ADD CONSTRAINT "sorteio_chances_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RESG-07: XOR — item resgatável referencia um produto OU tem nome custom,
-- nunca os dois nem nenhum. Prisma não modela XOR nativamente.
ALTER TABLE "itens_resgataveis" ADD CONSTRAINT itens_resgataveis_xor_produto_custom
  CHECK ((produto_id IS NOT NULL) != (nome_custom IS NOT NULL));
