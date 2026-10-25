const sensorService = require("../services/sensorService");
const sensorConfigService = require("../services/sensorConfigService");
const { validarSensor, validarId, validarConfigThingSpeak } = require("../validators/sensorValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.
// req.usuario vem do middleware autenticar; o service usa para filtrar pelo dono.

async function listar(req, res) {
  res.status(200).json(await sensorService.listar(req.usuario));
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await sensorService.buscarPorId(id, req.usuario));
}

async function criar(req, res) {
  const dados = validarSensor(req.body);
  res.status(201).json(await sensorService.criar(dados, req.usuario));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarSensor(req.body);
  res.status(200).json(await sensorService.atualizar(id, dados, req.usuario));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await sensorService.remover(id, req.usuario);
  res.status(204).end();
}

async function listarLeituras(req, res) {
  const id = validarId(req.params.id);
  const { periodo } = req.query; // Ex: ?periodo=24h, ?periodo=7d, ?periodo=30d
  
  res.status(200).json(await sensorService.listarLeiturasComFiltro(id, periodo, req.usuario));
}

// Testa o canal no ThingSpeak e so grava channelId e readApiKey se ele aceitar. A chave nunca volta na resposta.
async function configurarThingSpeak(req, res) {
  const dados = validarConfigThingSpeak(req.body);
  res.status(200).json(await sensorConfigService.configurar(dados, req.usuario));
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, listarLeituras, configurarThingSpeak };
