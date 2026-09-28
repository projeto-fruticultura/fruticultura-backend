const sensorService = require("../services/sensorService");
const { validarSensor, validarId } = require("../validators/sensorValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function listar(req, res) {
  res.status(200).json(await sensorService.listar());
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await sensorService.buscarPorId(id));
}

async function criar(req, res) {
  const dados = validarSensor(req.body);
  res.status(201).json(await sensorService.criar(dados));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarSensor(req.body);
  res.status(200).json(await sensorService.atualizar(id, dados));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await sensorService.remover(id);
  res.status(204).end();
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
