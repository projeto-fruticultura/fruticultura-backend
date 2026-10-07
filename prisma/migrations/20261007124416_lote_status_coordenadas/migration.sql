-- AlterTable
ALTER TABLE "Lote" ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "longitude" DECIMAL(11,8),
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'ATIVO';
