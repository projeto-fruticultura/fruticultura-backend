const logisticaService = require("../services/logisticaService");
const { validarFiltrosLogistica, validarLogistica, validarId } = require("../validators/logisticaValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.
// req.usuario vem do middleware autenticar; o service usa para filtrar pelo dono.

async function listar(req, res) {
  const filtros = validarFiltrosLogistica(req.query);
  res.status(200).json(await logisticaService.listar(req.usuario, filtros));
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await logisticaService.buscarPorId(id, req.usuario));
}

async function criar(req, res) {
  const dados = validarLogistica(req.body, "criar");
  res.status(201).json(await logisticaService.criar(dados, req.usuario));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarLogistica(req.body, "atualizar");
  res.status(200).json(await logisticaService.atualizar(id, dados, req.usuario));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await logisticaService.remover(id, req.usuario);
  res.status(204).end();
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
