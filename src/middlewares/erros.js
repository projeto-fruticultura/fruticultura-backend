// Erro "esperado", com status e mensagem que podem ir para o cliente.
// "extras" acrescenta campos soltos ao corpo da resposta (ex.: { totalSensores: 3 } no 409 de Lotes).
class ErroHttp extends Error {
  constructor(status, mensagem, campos, extras) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
    this.extras = extras;
  }
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: "Rota não encontrada." });
}

// Middleware central: o cliente so recebe mensagens amigaveis, nunca stack
// trace nem texto interno do Prisma. O detalhe fica no log do servidor.
// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err instanceof ErroHttp) {
    const corpo = { erro: err.message };
    if (err.campos) corpo.campos = err.campos;
    if (err.extras) Object.assign(corpo, err.extras);
    return res.status(err.status).json(corpo);
  }

  // Erros gerados pelo express.json() ao ler o corpo.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "JSON inválido no corpo da requisição." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ erro: "Corpo da requisição muito grande (limite de 100kb)." });
  }

  console.error(err);
  return res.status(500).json({ erro: "Erro interno. Tente novamente mais tarde." });
}

module.exports = { ErroHttp, rotaNaoEncontrada, tratarErros };
