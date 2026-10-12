const usuarioService = require("../services/usuarioService");
const { validarUsuario, validarId, validarPropriedadeIds } = require("../validators/usuarioValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function listar(req, res) {
  res.status(200).json(await usuarioService.listar());
}

async function criar(req, res) {
  const dados = validarUsuario(req.body);
  res.status(201).json(await usuarioService.criar(dados));
}

async function atualizar(req, res) {
  const id = validarId(req.params.id);
  const dados = validarUsuario(req.body, "atualizar");
  res.status(200).json(await usuarioService.atualizar(id, dados, req.usuario));
}

async function listarPropriedades(req, res) {
  const id = validarId(req.params.id);
  res.status(200).json(await usuarioService.listarPropriedades(id));
}

async function vincularPropriedades(req, res) {
  const id = validarId(req.params.id);
  const propriedadeIds = validarPropriedadeIds(req.body);
  res.status(200).json(await usuarioService.vincularPropriedades(id, propriedadeIds));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await usuarioService.inativar(id, req.usuario);
  res.status(204).end();
}

module.exports = { listar, criar, atualizar, listarPropriedades, vincularPropriedades, remover };
