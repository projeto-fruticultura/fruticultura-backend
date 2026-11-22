const painelProdutorService = require("../services/painelProdutorService");
const dashboardService = require("../services/dashboardService");
const { validarFiltrosResumo, validarFiltrosMedias } = require("../validators/dashboardValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.
// req.usuario vem do middleware autenticar; o service usa para filtrar pelo dono.

async function resumo(req, res) {
  const filtros = validarFiltrosResumo(req.query);
  res.status(200).json(await dashboardService.resumo(req.usuario, filtros));
}

async function medias(req, res) {
  const filtros = validarFiltrosMedias(req.query);
  res.status(200).json(await dashboardService.medias(req.usuario, filtros));
}

async function areasProdutor(req, res) {
  const { propriedadeId } = validarFiltrosResumo({ propriedadeId: req.query.propriedadeId });
  res.json(await painelProdutorService.areas(req.usuario, propriedadeId, new Date()));
}

async function alertasProdutor(req, res) {
  const { propriedadeId } = validarFiltrosResumo({ propriedadeId: req.query.propriedadeId });
  res.json(await painelProdutorService.alertasDoDia(req.usuario, propriedadeId, new Date()));
}

module.exports = { resumo, medias, areasProdutor, alertasProdutor };
