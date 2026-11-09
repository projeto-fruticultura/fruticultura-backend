const { Router } = require('express');
const culturaRoutes = require('./culturaRoutes');
const propriedadeRoutes = require('./propriedadeRoutes');
const sensorRoutes = require('./sensorRoutes');
const loteRoutes = require('./loteRoutes');
const leituraRoutes = require('./leituraRoutes');
const logisticaRoutes = require('./logisticaRoutes');
const alertaRoutes = require('./alertaRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const mercadoRoutes = require('./mercadoRoutes.js'); // Importa aqui
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');

const prisma = require("../config/prisma");

const {
  autenticar,
  exigirPerfil,
} = require("../middlewares/autenticar");

const {
  ErroHttp,
} = require("../middlewares/erros");

const {
  lerInteiro,
} = require("../validators/leituraValidator");

const {
  metricas,
} = require("../middlewares/monitoramento");

const routes = Router();

routes.get(
  "/metricas",
  autenticar,
  exigirPerfil("ADMIN"),

  (req, res) => {
    res.json(metricas());
  }
);

routes.get(
  "/auditoria",
  autenticar,
  exigirPerfil("ADMIN"),

  async (req, res) => {
    const pagina =
      req.query.pagina === undefined
        ? 1
        : lerInteiro(
            req.query.pagina,
            1,
            1_000_000
          );

    if (!pagina) {
      throw new ErroHttp(
        400,
        "Página inválida."
      );
    }

    const registros =
      await prisma.auditoria.findMany({
        orderBy: {
          id: "desc",
        },

        take: 50,
        skip: (pagina - 1) * 50,
      });

    res.json(registros);
  }
);


routes.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

routes.use('/culturas', culturaRoutes);
routes.use('/propriedades', propriedadeRoutes);
routes.use('/sensores', sensorRoutes);
// Exige login; CRUD completo (GET, POST, PUT e DELETE com exclusao logica) so nos lotes das propriedades do usuario.
routes.use('/lotes', loteRoutes);
routes.use("/lotes", require("./janelaRoutes"));
// So consulta; exige login e mostra so as leituras dos sensores das propriedades do usuario.
routes.use('/leituras', leituraRoutes);
// Exige login; mostra e altera so as rotas logisticas das propriedades do usuario (exclusao logica no DELETE).
routes.use('/logistica', logisticaRoutes);
// So consulta; exige login e calcula os alertas pela ultima leitura dos sensores das propriedades do usuario.
routes.use('/alertas', alertaRoutes);
// So consulta; exige login e calcula resumo e medias das leituras dos sensores das propriedades do usuario (dono filtrado no service).
routes.use('/dashboard', dashboardRoutes);
routes.use('/precos', mercadoRoutes); // <--- Tem de estar assim: /precos
// Login publico; /me e /logout exigem token.
// /propriedades, /sensores, /lotes, /leituras, /logistica, /alertas e /dashboard tambem exigem token. /culturas: GET aberto, POST/PUT/DELETE so ADMIN. /precos continua aberta por enquanto.
routes.use('/auth', authRoutes);
// So ADMIN logado cria usuarios (a protecao fica no proprio usuarioRoutes).
routes.use('/usuarios', usuarioRoutes);

module.exports = routes;