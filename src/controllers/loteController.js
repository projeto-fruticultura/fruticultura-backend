const loteService = require("../services/loteService");
const { validarFiltrosLote, validarConfirmar, validarLote, validarId } = require("../validators/loteValidator");

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

async function criar(req, res) {
  const dados = validarLote(req.body, "criar");
  res.status(201).json(await loteService.criar(dados, req.usuario));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarLote(req.body, "atualizar");
  res.status(200).json(await loteService.atualizar(id, dados, req.usuario));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  const confirmar = validarConfirmar(req.query);
  await loteService.remover(id, req.usuario, { confirmar });
  res.status(204).end();
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
