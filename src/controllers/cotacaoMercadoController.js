const service =
  require("../services/cotacaoMercadoService");

const {
  validarId,
} = require("../validators/propriedadeValidator");

const {
  validarFiltrosCotacoes,
} = require("../validators/cotacaoMercadoValidator");

async function listar(req, res) {
  const filtros =
    validarFiltrosCotacoes(
      req.query
    );

  res.json(
    await service.listar(
      filtros
    )
  );
}

async function buscarPorId(req, res) {
  const id = validarId(
    req.params.id
  );

  res.json(
    await service.buscarPorId(id)
  );
}

async function criar(req, res) {
  res.status(201).json(
    await service.criar(
      req.body,
      req.usuario
    )
  );
}

async function atualizar(req, res) {
  const id = validarId(
    req.params.id
  );

  res.json(
    await service.atualizar(
      id,
      req.body
    )
  );
}

async function remover(req, res) {
  const id = validarId(
    req.params.id
  );

  await service.remover(id);

  res.status(204).end();
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
};