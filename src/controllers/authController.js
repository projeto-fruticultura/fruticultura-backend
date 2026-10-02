const authService = require("../services/authService");
const { validarLogin } = require("../validators/authValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.

async function login(req, res) {
  const { email, senha } = validarLogin(req.body);
  res.status(200).json(await authService.login(email, senha));
}

// req.usuario foi preenchido pelo middleware autenticar, ja sem a senha.
function me(req, res) {
  res.status(200).json({ usuario: req.usuario });
}

// O token e stateless: o servidor nao guarda sessao, entao nao ha o que apagar aqui.
// Quem "desloga" e o front, apagando o token; ele continua valido ate expirar (2h).
function logout(req, res) {
  res.status(204).end();
}

module.exports = { login, me, logout };
