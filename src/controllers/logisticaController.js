const logisticaService =
  require("../services/logisticaService");

const {
  validarFiltrosLogistica,
  validarLogistica,
  validarId,
} = require("../validators/logisticaValidator");

const {
  validarComparacaoLogistica,
} = require("../validators/comparacaoLogisticaValidator");

async function listar(req, res) {
  const filtros = validarFiltrosLogistica(req.query);

  res.status(200).json(
    await logisticaService.listar(
      req.usuario,
      filtros
    )
  );
}

async function buscarPorId(req, res) {
  const id = validarId(req.params.id);

  res.status(200).json(
    await logisticaService.buscarPorId(
      id,
      req.usuario
    )
  );
}

async function criar(req, res) {
  const dados = validarLogistica(
    req.body,
    "criar"
  );

  res.status(201).json(
    await logisticaService.criar(
      dados,
      req.usuario
    )
  );
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);

  const dados = validarLogistica(
    req.body,
    "atualizar"
  );

  res.status(200).json(
    await logisticaService.atualizar(
      id,
      dados,
      req.usuario
    )
  );
}

async function remover(req, res) {
  const id = validarId(req.params.id);

  await logisticaService.remover(
    id,
    req.usuario
  );

  res.status(204).end();
}

async function comparar(req, res) {
  const ids = validarComparacaoLogistica(
    req.query
  );

  res.status(200).json(
    await logisticaService.compararPropriedades(
      ids,
      req.usuario
    )
  );
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
  comparar,
};