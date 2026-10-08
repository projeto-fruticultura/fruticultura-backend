-- CreateTable
CREATE TABLE "RotaLogistica" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "origem" VARCHAR(150) NOT NULL,
    "destino" VARCHAR(150) NOT NULL,
    "modal" VARCHAR(20) NOT NULL,
    "tempoEstimadoHoras" DECIMAL(6,1) NOT NULL,
    "custo" DECIMAL(12,2) NOT NULL,
    "transportadora" VARCHAR(150) NOT NULL,
    "situacao" VARCHAR(20) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaLogistica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RotaLogistica_propriedadeId_idx" ON "RotaLogistica"("propriedadeId");

-- AddForeignKey
ALTER TABLE "RotaLogistica" ADD CONSTRAINT "RotaLogistica_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
