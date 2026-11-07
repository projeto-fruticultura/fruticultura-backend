class ErroHttp extends Error {
  constructor(status, mensagem, campos, extras) {
    super(mensagem);

    this.name = "ErroHttp";
    this.status = status;
    this.campos = campos;
    this.extras = extras;
  }
}

function rotaNaoEncontrada(req, res) {
  return res.status(404).json({
    erro: "Rota não encontrada.",
  });
}

function tratarErros(err, req, res, next) {
  if (err instanceof ErroHttp) {
    const corpo = {
      erro: err.message,
    };

    if (err.campos) {
      corpo.campos = err.campos;
    }

    if (err.extras) {
      Object.assign(corpo, err.extras);
    }

    return res.status(err.status).json(corpo);
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      erro: "JSON inválido no corpo da requisição.",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      erro: "Corpo da requisição muito grande (limite de 100kb).",
    });
  }

  console.error(
    JSON.stringify({
      evento: "erro",
      requestId: req.requestId,
      tipo: err.name || "Error",
      codigo: err.code,
    })
  );

  return res.status(500).json({
    erro: "Erro interno. Tente novamente mais tarde.",
  });
}

module.exports = {
  ErroHttp,
  rotaNaoEncontrada,
  tratarErros,
};