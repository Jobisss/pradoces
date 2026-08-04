-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "pago" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pago_em" TIMESTAMPTZ(6);
