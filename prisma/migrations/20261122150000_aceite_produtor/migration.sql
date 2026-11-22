ALTER TABLE "Propriedade"
ADD COLUMN "latitudeEstimadaUf" BOOLEAN,
ADD COLUMN "longitudeEstimadaUf" BOOLEAN;

ALTER TABLE "RotaLogistica"
ADD COLUMN "colhidoEm" TIMESTAMP(3),
ADD COLUMN "resfriadoEm" TIMESTAMP(3),
ADD COLUMN "temperaturaResfriamentoC" DOUBLE PRECISION;

ALTER TABLE "RotaLogistica" ADD CONSTRAINT "RotaLogistica_medicao_resfriamento_check"
CHECK (
  ("colhidoEm" IS NULL AND "resfriadoEm" IS NULL AND "temperaturaResfriamentoC" IS NULL)
  OR
  ("colhidoEm" IS NOT NULL AND "resfriadoEm" IS NOT NULL AND "temperaturaResfriamentoC" IS NOT NULL
    AND "resfriadoEm" >= "colhidoEm" AND "temperaturaResfriamentoC" BETWEEN -273.15 AND 100)
);
