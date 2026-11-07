const sensorService =
  require("../services/sensorService");

const sensorConfigService =
  require("../services/sensorConfigService");

const {
  validarSensor,
  validarId,
  validarConfigThingSpeak,
} = require("../validators/sensorValidator");

async function listar(req, res) {
  const sensores =
    await sensorService.listar(req.usuario);

  return res.status(200).json(sensores);
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);

  const sensor =
    await sensorService.buscarPorId(
      id,
      req.usuario
    );

  return res.status(200).json(sensor);
}

async function criar(req, res) {
  const dados = validarSensor(req.body);

  const sensor =
    await sensorService.criar(
      dados,
      req.usuario
    );

  return res.status(201).json(sensor);
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarSensor(req.body);

  const sensor =
    await sensorService.atualizar(
      id,
      dados,
      req.usuario
    );

  return res.status(200).json(sensor);
}

async function remover(req, res) {
  const id = validarId(req.params.id);

  await sensorService.remover(
    id,
    req.usuario
  );

  return res.status(204).end();
}

async function listarLeituras(req, res) {
  const id = validarId(req.params.id);

  const resultado =
    await sensorService.listarLeiturasComFiltro(
      id,
      req.query.periodo,
      req.usuario,
      req.query
    );

  return res.status(200).json(resultado);
}

async function configurarThingSpeak(req, res) {
  const dados =
    validarConfigThingSpeak(req.body);

  const resultado =
    await sensorConfigService.configurar(
      dados,
      req.usuario
    );

  return res.status(200).json(resultado);
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
  listarLeituras,
  configurarThingSpeak,
};