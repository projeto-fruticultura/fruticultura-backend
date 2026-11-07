const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const controller = require("../controllers/sensorController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Todas as rotas exigem login: cada usuario so ve os sensores das proprias propriedades.
router.use(autenticar);

router.get(
  "/:id/indicadores",
  async (req, res) => {
    const prisma = require("../config/prisma");

    const {
      ErroHttp,
    } = require("../middlewares/erros");

    const {
      validarId,
    } = require("../validators/sensorValidator");

    const {
      validarFiltrosLeitura,
    } = require("../validators/leituraValidator");

    const {
      garantirSensorVisivel,
    } = require("../services/leituraService");

    const {
      calcular,
    } = require("../services/riscoService");

    const id = validarId(req.params.id);

    await garantirSensorVisivel(
      id,
      req.usuario
    );

    const filtros = validarFiltrosLeitura({
      ...(req.query.de || req.query.ate
        ? {}
        : { periodo: "24h" }),

      ...req.query,
    });

    const bruto = req.query.temperaturaBase;

    let temperaturaBase = null;

    if (bruto !== undefined) {
      if (
        typeof bruto !== "string" ||
        !/^-?\d+(\.\d+)?$/.test(bruto)
      ) {
        throw new ErroHttp(
          400,
          "temperaturaBase inválida."
        );
      }

      temperaturaBase = Number(bruto);

      if (
        !Number.isFinite(temperaturaBase) ||
        temperaturaBase < -10 ||
        temperaturaBase > 60
      ) {
        throw new ErroHttp(
          400,
          "temperaturaBase deve estar entre -10 e 60."
        );
      }
    }

    const sensor =
      await prisma.sensor.findUnique({
        where: { id },

        include: {
          lote: {
            include: {
              cultura: true,
            },
          },
        },
      });

    const leituras =
      await prisma.leitura.findMany({
        where: {
          sensorId: id,

          dataHoraLeitura: {
            gte: filtros.de,
            lte: filtros.ate,
          },
        },

        orderBy: {
          dataHoraLeitura: "asc",
        },
      });

    const resultado = calcular(
      leituras,
      sensor.lote.cultura,
      temperaturaBase
    );

    const {
      alertas,
      ...indicadores
    } = resultado;

    res.json({
      sensorId: id,
      ...indicadores,
      regraVersao: "heuristica-v1",
    });
  }
);

// Criar, editar e apagar: so ADMIN e PRODUTOR. TECNICO (e perfil desconhecido) recebe 403.
const podeAlterar = exigirPerfil("ADMIN", "PRODUTOR");

// Configurar o ThingSpeak: so ADMIN e TECNICO. PRODUTOR (e perfil desconhecido) recebe 403.
const podeConfigurar = exigirPerfil("ADMIN", "TECNICO");

// Cada chamada da config dispara uma consulta ao ThingSpeak: 10 por usuario a cada 15 minutos,
// contando todas (as tentativas com chave errada sao justamente as que interessa limitar).
// A chave e o id do usuario, e nao o IP: a rota ja exige login. O contador fica em memoria.
const limitarConfig = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.usuario.id),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: { erro: "Muitas tentativas de configuração. Tente novamente em 15 minutos." },
});

// Caminhos sem "/sensores": o prefixo e definido em routes/index.js.
// /config vem antes das rotas com /:id, para nunca ser lido como um id.
router.post("/config", podeConfigurar, limitarConfig, controller.configurarThingSpeak);
router.get("/", controller.listar);
router.get("/:id", controller.buscarPorId);
router.get("/:id/leituras", controller.listarLeituras);
router.post("/", podeAlterar, controller.criar);
router.put("/:id", podeAlterar, controller.atualizar);
router.delete("/:id", podeAlterar, controller.remover);

module.exports = router;
