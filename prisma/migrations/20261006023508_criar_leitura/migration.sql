-- CreateTable
CREATE TABLE "Leitura" (
    "id" SERIAL NOT NULL,
    "sensorId" INTEGER NOT NULL,
    "temperatura" DOUBLE PRECISION NOT NULL,
    "umidade" DOUBLE PRECISION NOT NULL,
    "dataHoraLeitura" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leitura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Leitura_sensorId_dataHoraLeitura_key" ON "Leitura"("sensorId", "dataHoraLeitura");

-- AddForeignKey
ALTER TABLE "Leitura" ADD CONSTRAINT "Leitura_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
