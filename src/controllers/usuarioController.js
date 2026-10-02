const usuarioService = require("../services/usuarioService");
const { validarUsuario } = require("../validators/usuarioValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function criar(req, res) {
  const dados = validarUsuario(req.body);
  res.status(201).json(await usuarioService.criar(dados));
}

module.exports = { criar };
