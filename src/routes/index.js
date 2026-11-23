const { Router } = require("express");

const produtividadeRoutes = require("./produtividadeRoutes");
const culturaRoutes = require("./culturaRoutes");
const propriedadeRoutes = require("./propriedadeRoutes");
const sensorRoutes = require("./sensorRoutes");
const loteRoutes = require("./loteRoutes");
const janelaRoutes = require("./janelaRoutes");
const leituraRoutes = require("./leituraRoutes");
const logisticaRoutes = require("./logisticaRoutes");
const alertaRoutes = require("./alertaRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const mercadoRoutes = require("./mercadoRoutes");
const cotacaoMercadoRoutes = require("./cotacaoMercadoRoutes");
const authRoutes = require("./authRoutes");
const usuarioRoutes = require("./usuarioRoutes");

const prisma = require("../config/prisma");

const {
  autenticar,
  exigirPerfil,
} = require("../middlewares/autenticar");

const { ErroHttp } = require("../middlewares/erros");

const {
  lerInteiro,
} = require("../validators/leituraValidator");

const {
  metricas,
} = require("../middlewares/monitoramento");

const routes = Router();

// Métricas de execução: somente ADMIN.
routes.get(
  "/metricas",
  autenticar,
  exigirPerfil("ADMIN"),
  (req, res) => {
    res.json(metricas());
  }
);

// Histórico de auditoria: somente ADMIN.
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

    const registros = await prisma.auditoria.findMany({
      orderBy: {
        id: "desc",
      },
      take: 50,
      skip: (pagina - 1) * 50,
    });

    res.json(registros);
  }
);

// Verificação pública de disponibilidade.
routes.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

// As permissões específicas ficam nos respectivos routers.
routes.use("/culturas", culturaRoutes);
routes.use("/propriedades", propriedadeRoutes);
routes.use("/sensores", sensorRoutes);

routes.use("/lotes", loteRoutes);
routes.use("/lotes", janelaRoutes);

routes.use("/leituras", leituraRoutes);
routes.use("/logistica", logisticaRoutes);
routes.use("/alertas", alertaRoutes);
routes.use("/dashboard", dashboardRoutes);

// Consulta pública de preços da CONAB.
routes.use("/precos", mercadoRoutes);

// Cotações cadastradas: consulta autenticada;
// criação, alteração e exclusão somente por ADMIN.
routes.use("/mercado/cotacoes", cotacaoMercadoRoutes);

// Login público; demais permissões definidas no authRoutes.
routes.use("/auth", authRoutes);

// Gestão de usuários protegida no usuarioRoutes.
routes.use("/usuarios", usuarioRoutes);

// Consulta autenticada de previsões experimentais de produtividade.
routes.use("/produtividade", produtividadeRoutes);

module.exports = routes;