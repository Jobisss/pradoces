-- CreateEnum
CREATE TYPE "LoteBaixaMotivo" AS ENUM ('VENCIDO', 'DANIFICADO', 'OUTRO');

-- CreateTable
CREATE TABLE "lote_baixas" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "qtde" INTEGER NOT NULL,
    "motivo" "LoteBaixaMotivo" NOT NULL,
    "observacao" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_baixas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lote_baixas_lote_id_idx" ON "lote_baixas"("lote_id");

-- AddForeignKey
ALTER TABLE "lote_baixas" ADD CONSTRAINT "lote_baixas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defesa em profundidade (mesmo padrão de lotes_reservada_nao_excede_disponivel):
-- mesmo que a app erre, o banco nunca aceita uma baixa de 0 ou negativa.
ALTER TABLE "lote_baixas" ADD CONSTRAINT lote_baixas_qtde_positiva CHECK (qtde > 0);
