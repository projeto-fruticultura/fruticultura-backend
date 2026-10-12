-- CreateTable
CREATE TABLE "TecnicoPropriedade" (
    "usuarioId" INTEGER NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TecnicoPropriedade_pkey" PRIMARY KEY ("usuarioId","propriedadeId")
);

-- CreateIndex
CREATE INDEX "TecnicoPropriedade_propriedadeId_idx" ON "TecnicoPropriedade"("propriedadeId");

-- AddForeignKey
ALTER TABLE "TecnicoPropriedade" ADD CONSTRAINT "TecnicoPropriedade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TecnicoPropriedade" ADD CONSTRAINT "TecnicoPropriedade_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
