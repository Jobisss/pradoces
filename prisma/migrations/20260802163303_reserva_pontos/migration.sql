-- CreateEnum
CREATE TYPE "ReservaStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'AGUARDANDO_RETIRADA', 'RETIRADA', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('PICKUP_ONLY');

-- CreateEnum
CREATE TYPE "PontosMotivo" AS ENUM ('RESERVA_CONFIRMADA', 'EXPIRACAO', 'AJUSTE_ADMIN');

-- AlterTable
ALTER TABLE "configuracoes" ADD COLUMN     "janela_cancelamento_horas" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "pontos_cap_por_reserva" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "pontos_expiracao_meses" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "pontos_por_real" DECIMAL(6,2) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "status" "ReservaStatus" NOT NULL DEFAULT 'PENDENTE',
    "delivery_mode" "DeliveryMode" NOT NULL DEFAULT 'PICKUP_ONLY',
    "janela_retirada" TEXT NOT NULL,
    "observacao" TEXT,
    "token" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmada_em" TIMESTAMPTZ(6),
    "cancelada_em" TIMESTAMPTZ(6),
    "retirada_em" TIMESTAMPTZ(6),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_itens" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "qtde" INTEGER NOT NULL,
    "preco_unitario_congelado" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "reserva_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_transacoes" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" "PontosMotivo" NOT NULL,
    "reserva_id" UUID,
    "expira_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontos_transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservas_token_key" ON "reservas"("token");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

-- CreateIndex
CREATE INDEX "reservas_status_idx" ON "reservas"("status");

-- CreateIndex
CREATE INDEX "pontos_transacoes_cliente_id_idx" ON "pontos_transacoes"("cliente_id");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_itens" ADD CONSTRAINT "reserva_itens_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_itens" ADD CONSTRAINT "reserva_itens_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_transacoes" ADD CONSTRAINT "pontos_transacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_transacoes" ADD CONSTRAINT "pontos_transacoes_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
