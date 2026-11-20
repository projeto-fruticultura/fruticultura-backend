-- Alteração aditiva.
-- Preserva as rotas existentes.
-- O campo fica NULL nas rotas antigas.

ALTER TABLE "RotaLogistica"
ADD COLUMN "exigeRefrigeracaoRapida" BOOLEAN;