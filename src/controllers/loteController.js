const loteService = require("../services/loteService");
const { validarFiltrosLote, validarId } = require("../validators/loteValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.
// req.usuario vem do middleware autenticar; o service usa para filtrar pelo dono.

async function listar(req, res) {
  const filtros = validarFiltrosLote(req.query);
  res.status(200).json(await loteService.listar(req.usuario, filtros));
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await loteService.buscarPorId(id, req.usuario));
}

module.exports = { listar, buscarPorId };
