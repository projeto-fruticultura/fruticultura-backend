CREATE TYPE "DestinoMercado"
AS ENUM ('INTERNO', 'EXPORTACAO');

CREATE TABLE "CotacaoMercado" (
    "id" SERIAL NOT NULL,
    "culturaId" INTEGER NOT NULL,
    "mercadoDestino" "DestinoMercado" NOT NULL,
    "paisDestino" CHAR(2) NOT NULL,
    "precoMedio" DECIMAL(14,4) NOT NULL,
    "moeda" CHAR(3) NOT NULL,
    "unidade" VARCHAR(2) NOT NULL DEFAULT 'KG',
    "dataReferencia" DATE NOT NULL,
    "fonteNome" VARCHAR(150) NOT NULL,
    "fonteReferencia" VARCHAR(500) NOT NULL,
    "demandaEstimadaKg" DECIMAL(14,2),
    "demandaInicio" DATE,
    "demandaFim" DATE,
    "fonteDemanda" VARCHAR(500),
    "metodoDemanda" VARCHAR(1000),
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotacaoMercado_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX
"CotacaoMercado_culturaId_mercadoDestino_dataReferencia_idx"
ON "CotacaoMercado" (
    "culturaId",
    "mercadoDestino",
    "dataReferencia"
);

CREATE INDEX "CotacaoMercado_criadoPorId_idx"
ON "CotacaoMercado" ("criadoPorId");

ALTER TABLE "CotacaoMercado"
ADD CONSTRAINT "CotacaoMercado_culturaId_fkey"
FOREIGN KEY ("culturaId")
REFERENCES "Cultura" ("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CotacaoMercado"
ADD CONSTRAINT "CotacaoMercado_criadoPorId_fkey"
FOREIGN KEY ("criadoPorId")
REFERENCES "Usuario" ("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;