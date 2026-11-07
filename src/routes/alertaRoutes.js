const { Router } = require("express");
const controller = require("../controllers/alertaController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// So consulta: os alertas sao calculados na hora a partir da ultima leitura de cada sensor, sem gravar nada.
// Exige login; o filtro de dono fica no service (o TECNICO ve so o das propriedades vinculadas a ele; perfil desconhecido ve lista vazia).
router.use(autenticar);

router.get("/riscos", async (req, res) => {
  const prisma = require("../config/prisma");

  const {
    validarFiltrosLeitura,
  } = require("../validators/leituraValidator");

  const {
    filtroSensor,
  } = require("../services/escopoDono");

  const filtros =
    validarFiltrosLeitura(req.query);

  const sensor = {
    AND: [
      filtroSensor(req.usuario),

      {
        lote: {
          propriedade: {
            status: "ATIVO",
          },
        },
      },
    ],

    ...(filtros.sensorId
      ? { id: filtros.sensorId }
      : {}),

    ...(filtros.loteId
      ? { loteId: filtros.loteId }
      : {}),

    ...(filtros.propriedadeId
      ? {
          lote: {
            propriedadeId:
              filtros.propriedadeId,
          },
        }
      : {}),
  };

  const where = { sensor };

  if (filtros.de || filtros.ate) {
    where.fim = {
      ...(filtros.de
        ? { gte: filtros.de }
        : {}),

      ...(filtros.ate
        ? { lte: filtros.ate }
        : {}),
    };
  }

  const alertas =
    await prisma.alertaRisco.findMany({
      where,

      orderBy: [
        { fim: "desc" },
        { id: "desc" },
      ],

      take: filtros.limite,

      skip: Math.min(
        (filtros.pagina - 1) *
          filtros.limite,

        2147483647
      ),
    });

  res.json(alertas);
});

// Caminho sem "/alertas": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);

module.exports = router;
