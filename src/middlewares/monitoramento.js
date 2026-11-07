const { randomUUID } = require("node:crypto");

const estado = {
  requisicoes: 0,
  erros4xx: 0,
  erros5xx: 0,
  duracaoTotalMs: 0,
};

function monitorar(req, res, next) {
  const inicio = process.hrtime.bigint();

  req.requestId = randomUUID();

  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const duracaoMs =
      Number(process.hrtime.bigint() - inicio) / 1e6;

    estado.requisicoes++;
    estado.duracaoTotalMs += duracaoMs;

    if (res.statusCode >= 400 && res.statusCode < 500) {
      estado.erros4xx++;
    }

    if (res.statusCode >= 500) {
      estado.erros5xx++;
    }

    console.log(
      JSON.stringify({
        evento: "http",
        requestId: req.requestId,
        metodo: req.method,

        rota: req.route
          ? `${req.baseUrl}${req.route.path}`
          : "nao_identificada",

        status: res.statusCode,
        duracaoMs: Number(duracaoMs.toFixed(2)),
      })
    );
  });

  next();
}

function metricas() {
  const total = estado.requisicoes;

  return {
    ...estado,

    latenciaMediaMs:
      total > 0 ? estado.duracaoTotalMs / total : 0,

    taxaErros4xx:
      total > 0 ? estado.erros4xx / total : 0,

    taxaErros5xx:
      total > 0 ? estado.erros5xx / total : 0,
  };
}

module.exports = {
  monitorar,
  metricas,
};