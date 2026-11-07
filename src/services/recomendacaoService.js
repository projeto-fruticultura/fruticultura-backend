const {
  ErroHttp,
} = require("../middlewares/erros");

function recomendar(dados, faseFenologica) {
  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new ErroHttp(
      400,
      "Envie um objeto JSON."
    );
  }

  const faixas = {
    grausDiaAcumulados: [0, 100000],
    grausDiaAlvo: [1, 100000],

    chuvaPrevistaMm: [0, 1000],
    chuvaLimiteMm: [0, 1000],

    umidadePrevista: [0, 100],
    umidadeLimite: [0, 100],

    horasAteResfriamento: [0, 1000],
    tempoTransporteHoras: [0, 1000],
    vidaUtilHoras: [0.01, 10000],

    precoInternoKg: [0, 100000],
    precoExportacaoKg: [0, 100000],

    custoInternoKg: [0, 100000],
    custoExportacaoKg: [0, 100000],
  };

  for (
    const [campo, [minimo, maximo]]
    of Object.entries(faixas)
  ) {
    const valor = dados[campo];

    if (
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      valor < minimo ||
      valor > maximo
    ) {
      throw new ErroHttp(
        400,
        `${campo} deve estar entre ${minimo} e ${maximo}.`
      );
    }
  }

  if (
    typeof dados.cadeiaFrioGarantida !==
    "boolean"
  ) {
    throw new ErroHttp(
      400,
      "cadeiaFrioGarantida deve ser booleano."
    );
  }

  const motivos = [];

  if (faseFenologica !== "MATURACAO") {
    motivos.push(
      "Lote fora da fase de maturação."
    );
  }

  if (
    dados.grausDiaAcumulados <
    dados.grausDiaAlvo
  ) {
    motivos.push(
      "Acumulado térmico abaixo do alvo."
    );
  }

  if (
    dados.chuvaPrevistaMm >
    dados.chuvaLimiteMm
  ) {
    motivos.push(
      "Chuva prevista acima do limite."
    );
  }

  if (
    dados.umidadePrevista >
    dados.umidadeLimite
  ) {
    motivos.push(
      "Umidade prevista acima do limite."
    );
  }

  const colher = motivos.length === 0;

  const margemInterna =
    dados.precoInternoKg -
    dados.custoInternoKg;

  const margemExportacao =
    dados.precoExportacaoKg -
    dados.custoExportacaoKg;

  const exportar =
    colher &&
    dados.cadeiaFrioGarantida &&
    dados.horasAteResfriamento < 6 &&
    dados.horasAteResfriamento +
      dados.tempoTransporteHoras <
      dados.vidaUtilHoras &&
    margemExportacao > 0 &&
    margemExportacao > margemInterna;

  return {
    natureza: "SIMULACAO_PARAMETRIZADA",
    regraVersao: "heuristica-v1",

    colheita: {
      favoravel: colher,
      motivos,
    },

    exportacao: {
      favoravel: exportar,
      margemInternaKg: margemInterna,
      margemExportacaoKg: margemExportacao,
    },

    observacao:
      "Parâmetros e previsão informados pelo técnico. Não estima uma data futura.",
  };
}

module.exports = {
  recomendar,
};