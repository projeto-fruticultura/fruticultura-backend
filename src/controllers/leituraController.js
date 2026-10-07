const leituraService = require("../services/leituraService");
const { validarFiltrosLeitura } = require("../validators/leituraValidator");

// No Express 5, erro lancado em funcao async ja vai para o middleware de erro,
// por isso nao ha try/catch aqui.
// req.usuario vem do middleware autenticar; o service usa para filtrar pelo dono.

async function listar(req, res) {
  const filtros = validarFiltrosLeitura(req.query);
  res.status(200).json(await leituraService.listar(req.usuario, filtros));
}

module.exports = { listar };
