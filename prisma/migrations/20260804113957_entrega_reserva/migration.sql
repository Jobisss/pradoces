-- AlterEnum
ALTER TYPE "DeliveryMode" ADD VALUE 'ENTREGA';

-- AlterTable
ALTER TABLE "configuracoes" ADD COLUMN     "entrega_ativa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxa_entrega_padrao" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "endereco_entrega" TEXT,
ADD COLUMN     "taxa_entrega_congelada" DECIMAL(19,4);
