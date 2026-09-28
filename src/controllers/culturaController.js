const culturaService = require("../services/culturaService");
const { validarCultura, validarCoordenadas, validarId } = require("../validators/culturaValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function listar(req, res) {
  res.status(200).json(await culturaService.listar());
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await culturaService.buscarPorId(id));
}

async function criar(req, res) {
  const dados = validarCultura(req.body);
  res.status(201).json(await culturaService.criar(dados));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarCultura(req.body);
  res.status(200).json(await culturaService.atualizar(id, dados));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await culturaService.remover(id);
  res.status(204).end();
}

async function detalhes(req, res) {
  const id = validarId(req.params.id);
  const { latitude, longitude } = validarCoordenadas(req.query);
  res.status(200).json(await culturaService.obterDetalhesCompletos(id, latitude, longitude));
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, detalhes };
