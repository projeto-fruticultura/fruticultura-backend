-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('PRODUTOR', 'TECNICO', 'ADMIN');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ATIVO', 'INATIVO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cidade" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "usuarioId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cultura" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "variedade" VARCHAR(100),
    "descricao" TEXT,
    "temperaturaMin" DECIMAL(5,2) NOT NULL,
    "temperaturaMax" DECIMAL(5,2) NOT NULL,
    "umidadeMin" DECIMAL(5,2) NOT NULL,
    "umidadeMax" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "Cultura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" SERIAL NOT NULL,
    "identificacao" VARCHAR(100) NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "dataPlantacao" DATE NOT NULL,
    "colheitaEstimada" DATE,
    "situacao" VARCHAR(30) NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "culturaId" INTEGER NOT NULL,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(45) NOT NULL,
    "tipo" VARCHAR(45) NOT NULL,
    "localizacao" VARCHAR(150),
    "dataInstalacao" DATE NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "loteId" INTEGER NOT NULL,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Propriedade_usuarioId_idx" ON "Propriedade"("usuarioId");

-- CreateIndex
CREATE INDEX "Lote_propriedadeId_idx" ON "Lote"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_codigo_key" ON "Sensor"("codigo");

-- CreateIndex
CREATE INDEX "Sensor_loteId_idx" ON "Sensor"("loteId");

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_culturaId_fkey" FOREIGN KEY ("culturaId") REFERENCES "Cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
