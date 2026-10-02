const propriedadeService = require("../services/propriedadeService");
const propriedadeClimaService = require("../services/propriedadeClimaService");
const { validarPropriedade, validarId } = require("../validators/propriedadeValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function listar(req, res) {
  res.status(200).json(await propriedadeService.listar());
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await propriedadeService.buscarPorId(id));
}

async function criar(req, res) {
  const dados = validarPropriedade(req.body);
  res.status(201).json(await propriedadeService.criar(dados));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarPropriedade(req.body);
  res.status(200).json(await propriedadeService.atualizar(id, dados));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await propriedadeService.remover(id);
  res.status(204).end();
}

async function buscarClima(req, res) {
  const id = validarId(req.params.id);
  const dadosClima = await propriedadeClimaService.consultarClimaPropriedade(id);
  return res.status(200).json(dadosClima);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, buscarClima };
