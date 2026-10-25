-- CreateEnum
CREATE TYPE "FaseFenologica" AS ENUM ('VEGETATIVA', 'FLORACAO_PANICULA', 'FRUTIFICACAO', 'MATURACAO');

-- AlterTable
ALTER TABLE "Lote" ADD COLUMN     "faseFenologica" "FaseFenologica";

-- AlterTable
ALTER TABLE "Sensor" ADD COLUMN     "channelId" VARCHAR(20),
ADD COLUMN     "readApiKey" VARCHAR(64);

