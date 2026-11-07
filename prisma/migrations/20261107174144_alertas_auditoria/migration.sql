-- CreateTable
CREATE TABLE "AlertaRisco" (
    "id" SERIAL NOT NULL,
    "sensorId" INTEGER NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "nivel" VARCHAR(10) NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "duracaoMinutos" DOUBLE PRECISION NOT NULL,
    "regraVersao" VARCHAR(40) NOT NULL DEFAULT 'heuristica-v1',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaRisco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "operacao" VARCHAR(10) NOT NULL,
    "recurso" VARCHAR(60) NOT NULL,
    "recursoId" VARCHAR(60),
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(64) NOT NULL,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertaRisco_sensorId_fim_idx" ON "AlertaRisco"("sensorId", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "AlertaRisco_sensorId_tipo_inicio_nivel_key" ON "AlertaRisco"("sensorId", "tipo", "inicio", "nivel");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_dataHora_idx" ON "Auditoria"("usuarioId", "dataHora");

-- AddForeignKey
ALTER TABLE "AlertaRisco" ADD CONSTRAINT "AlertaRisco_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
