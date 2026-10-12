const usuarioService = require("../services/usuarioService");
const { validarUsuario, validarId } = require("../validators/usuarioValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function listar(req, res) {
  res.status(200).json(await usuarioService.listar());
}

async function criar(req, res) {
  const dados = validarUsuario(req.body);
  res.status(201).json(await usuarioService.criar(dados));
}

async function remover(req, res) {
  const id = validarId(req.params.id);
  await usuarioService.inativar(id, req.usuario);
  res.status(204).end();
}

module.exports = { listar, criar, remover };
