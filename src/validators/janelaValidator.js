const { ErroHttp } = require("../middlewares/erros");

const DIA_MS = 86400000;

function validarJanelas(corpo, agora = new Date()) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie um objeto JSON.");
  }

  const erros = {};

  function numero(nome, min, max, inteiro = false, opcional = false) {
    const valor = corpo[nome];

    if (opcional && valor === undefined) {
      return undefined;
    }

    if (
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      valor < min ||
      valor > max ||
      (inteiro && !Number.isInteger(valor))
    ) {
      erros[nome] =
        `Informe ${inteiro ? "inteiro" : "número"} entre ${min} e ${max}.`;
      return undefined;
    }

    return valor;
  }

  function texto(nome) {
    const valor = corpo[nome];

    if (
      typeof valor !== "string" ||
      valor.trim().length < 1 ||
      valor.trim().length > 200
    ) {
      erros[nome] = "Informe um texto de 1 a 200 caracteres.";
      return undefined;
    }

    return valor.trim();
  }

  function instante(nome) {
    const valor = corpo[nome];

    const match =
      typeof valor === "string" &&
      /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.exec(
        valor,
      );

    const data = match ? new Date(valor) : null;

    if (
      !data ||
      !Number.isFinite(+data) ||
      data.getUTCFullYear() !== Number(match[1]) ||
      data.getUTCMonth() + 1 !== Number(match[2]) ||
      data.getUTCDate() !== Number(match[3])
    ) {
      erros[nome] = "Informe data-hora UTC válida, com segundos e Z.";
      return undefined;
    }

    return data;
  }

  const dados = {
    sensorId: numero("sensorId", 1, 2147483647, true),
    dataHoraReferencia: instante("dataHoraReferencia"),
    grausDiaReferencia: numero("grausDiaReferencia", 0, 100000),
    temperaturaBase: numero("temperaturaBase", -10, 60),
    grausDiaAlvo: numero("grausDiaAlvo", 1, 100000),
    chuvaMaxMm: numero("chuvaMaxMm", 0, 1000),
    umidadeArMaxPercentual: numero("umidadeArMaxPercentual", 0, 100),
    fonteParametros: texto("fonteParametros"),
    versaoParametros: texto("versaoParametros"),
  };

  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);

  if (
    dados.dataHoraReferencia &&
    (dados.dataHoraReferencia > hoje ||
      hoje - dados.dataHoraReferencia > 366 * DIA_MS)
  ) {
    erros.dataHoraReferencia =
      "Use referência até 00:00 UTC de hoje e de no máximo 366 dias atrás.";
  }

  const camposExportacao = [
    "rotaLogisticaId",
    "horasAteResfriamento",
    "vidaUtilHoras",
    "precoInternoKg",
    "precoExportacaoKg",
    "custoInternoKg",
    "custoExportacaoKg",
    "cadeiaFrioGarantida",
    "moeda",
    "dataHoraCotacao",
    "fonteCotacao",
  ];

  if (camposExportacao.some((campo) => corpo[campo] !== undefined)) {
    Object.assign(dados, {
      rotaLogisticaId: numero("rotaLogisticaId", 1, 2147483647, true),
      horasAteResfriamento: numero("horasAteResfriamento", 0, 1000),
      vidaUtilHoras: numero("vidaUtilHoras", 0.01, 10000),
      precoInternoKg: numero("precoInternoKg", 0, 100000),
      precoExportacaoKg: numero("precoExportacaoKg", 0, 100000),
      custoInternoKg: numero("custoInternoKg", 0, 100000),
      custoExportacaoKg: numero("custoExportacaoKg", 0, 100000),
      dataHoraCotacao: instante("dataHoraCotacao"),
      fonteCotacao: texto("fonteCotacao"),
      moeda: corpo.moeda,
      cadeiaFrioGarantida: corpo.cadeiaFrioGarantida,
    });

    if (typeof corpo.cadeiaFrioGarantida !== "boolean") {
      erros.cadeiaFrioGarantida = "Informe booleano.";
    }

    if (corpo.moeda !== "BRL") {
      erros.moeda = "Informe BRL; preços e custos devem estar em R$/kg.";
    }

    if (
      dados.dataHoraCotacao &&
      (dados.dataHoraCotacao > agora ||
        agora - dados.dataHoraCotacao > 7 * DIA_MS)
    ) {
      erros.dataHoraCotacao =
        "Cotação deve ter até 7 dias e não pode estar no futuro.";
    }
  }

  if (Object.keys(erros).length) {
    throw new ErroHttp(
      400,
      "Parâmetros de recomendação inválidos.",
      erros,
    );
  }

  return dados;
}

module.exports = { validarJanelas };