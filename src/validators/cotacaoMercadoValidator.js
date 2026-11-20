const { ErroHttp } = require("../middlewares/erros");

const MOEDAS = [
  "BRL",
  "USD",
  "EUR",
  "GBP",
];

const CAMPOS_DEMANDA = [
  "demandaInicio",
  "demandaFim",
  "fonteDemanda",
  "metodoDemanda",
];

function objeto(corpo) {
  if (
    !corpo ||
    typeof corpo !== "object" ||
    Array.isArray(corpo)
  ) {
    throw new ErroHttp(
      400,
      "Envie os dados da cotação em JSON."
    );
  }
}

function dataCivil(valor) {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return null;
  }

  const data = new Date(
    valor + "T00:00:00.000Z"
  );

  if (
    !Number.isFinite(+data) ||
    data.toISOString().slice(0, 10) !== valor
  ) {
    return null;
  }

  return data;
}

function validarCotacao(
  corpo,
  agora = new Date()
) {
  objeto(corpo);

  const erros = {};
  const dados = {};

  function texto(nome, minimo, maximo) {
    const valor = corpo[nome];

    if (
      typeof valor !== "string" ||
      valor.trim().length < minimo ||
      valor.trim().length > maximo
    ) {
      erros[nome] =
        `Informe texto de ${minimo} a ${maximo} caracteres.`;

      return undefined;
    }

    return valor.trim();
  }

  function numero(
    nome,
    minimo,
    maximo,
    casas
  ) {
    const valor = corpo[nome];

    const formato = new RegExp(
      `^\\d+(\\.\\d{1,${casas}})?$`
    );

    if (
      typeof valor !== "number" ||
      !Number.isFinite(valor) ||
      valor < minimo ||
      valor > maximo ||
      !formato.test(String(valor))
    ) {
      erros[nome] =
        `Informe número entre ${minimo} e ${maximo}, ` +
        `com até ${casas} casas decimais.`;

      return undefined;
    }

    return valor;
  }

  if (
    !Number.isInteger(corpo.culturaId) ||
    corpo.culturaId < 1 ||
    corpo.culturaId > 2147483647
  ) {
    erros.culturaId =
      "Informe culturaId inteiro positivo.";
  }

  dados.culturaId = corpo.culturaId;

  dados.mercadoDestino =
    corpo.mercadoDestino;

  if (
    !["INTERNO", "EXPORTACAO"].includes(
      dados.mercadoDestino
    )
  ) {
    erros.mercadoDestino =
      "Informe INTERNO ou EXPORTACAO.";
  }

  dados.paisDestino =
    corpo.paisDestino === undefined &&
    dados.mercadoDestino === "INTERNO"
      ? "BR"
      : corpo.paisDestino;

  if (
    typeof dados.paisDestino !== "string" ||
    !/^[A-Z]{2}$/.test(dados.paisDestino)
  ) {
    erros.paisDestino =
      "Informe o código do país com duas letras maiúsculas.";
  }

  if (
    dados.mercadoDestino === "INTERNO" &&
    dados.paisDestino !== "BR"
  ) {
    erros.paisDestino =
      "Mercado interno usa BR.";
  }

  if (
    dados.mercadoDestino === "EXPORTACAO" &&
    dados.paisDestino === "BR"
  ) {
    erros.paisDestino =
      "Exportação exige país diferente de BR.";
  }

  if (
    corpo.unidade !== undefined &&
    corpo.unidade !== "KG"
  ) {
    erros.unidade =
      "Cadastre preço por KG; não há conversão automática de caixa ou tonelada.";
  }

  if (
    corpo.unidadeDemanda !== undefined &&
    corpo.unidadeDemanda !== "KG"
  ) {
    erros.unidadeDemanda =
      "Informe demanda em KG.";
  }

  dados.unidade = "KG";

  dados.precoMedio = numero(
    "precoMedio",
    0.0001,
    9999999999.9999,
    4
  );

  dados.moeda = corpo.moeda;

  if (!MOEDAS.includes(dados.moeda)) {
    erros.moeda =
      `Informe uma moeda suportada: ${MOEDAS.join(", ")}.`;
  }

  dados.dataReferencia = dataCivil(
    corpo.dataReferencia
  );

  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);

  if (
    !dados.dataReferencia ||
    dados.dataReferencia > hoje
  ) {
    erros.dataReferencia =
      "Informe data YYYY-MM-DD válida, sem data futura.";
  }

  dados.fonteNome = texto(
    "fonteNome",
    3,
    150
  );

  dados.fonteReferencia = texto(
    "fonteReferencia",
    3,
    500
  );

  dados.demandaEstimadaKg = null;

  for (const campo of CAMPOS_DEMANDA) {
    dados[campo] = null;
  }

  if (
    corpo.demandaEstimadaKg !== undefined &&
    corpo.demandaEstimadaKg !== null
  ) {
    dados.demandaEstimadaKg = numero(
      "demandaEstimadaKg",
      0,
      999999999999.99,
      2
    );

    dados.demandaInicio = dataCivil(
      corpo.demandaInicio
    );

    dados.demandaFim = dataCivil(
      corpo.demandaFim
    );

    if (!dados.demandaInicio) {
      erros.demandaInicio =
        "Informe o início do período em YYYY-MM-DD.";
    }

    if (!dados.demandaFim) {
      erros.demandaFim =
        "Informe o fim do período em YYYY-MM-DD.";
    }

    if (
      dados.demandaInicio &&
      dados.demandaFim &&
      dados.demandaFim < dados.demandaInicio
    ) {
      erros.demandaFim =
        "O fim não pode anteceder o início.";
    }

    dados.fonteDemanda = texto(
      "fonteDemanda",
      3,
      500
    );

    dados.metodoDemanda = texto(
      "metodoDemanda",
      10,
      1000
    );
  } else if (
    CAMPOS_DEMANDA.some(
      (campo) =>
        corpo[campo] !== undefined &&
        corpo[campo] !== null
    )
  ) {
    erros.demandaEstimadaKg =
      "Informe a demanda junto ao período, fonte e método, ou deixe todos ausentes.";
  }

  if (Object.keys(erros).length > 0) {
    throw new ErroHttp(
      400,
      "Cotação inválida.",
      erros
    );
  }

  return dados;
}

function validarFiltrosCotacoes(query) {
  const q = query || {};

  const dados = {
    pagina: 1,
    limite: 20,
  };

  const erros = {};

  for (const [nome, maximo] of [
    ["pagina", 1000000],
    ["limite", 100],
    ["culturaId", 2147483647],
  ]) {
    if (q[nome] === undefined) {
      continue;
    }

    if (
      typeof q[nome] !== "string" ||
      !/^\d+$/.test(q[nome]) ||
      Number(q[nome]) < 1 ||
      Number(q[nome]) > maximo
    ) {
      erros[nome] =
        `Informe inteiro de 1 a ${maximo}.`;
    } else {
      dados[nome] = Number(q[nome]);
    }
  }

  if (q.mercadoDestino !== undefined) {
    if (
      !["INTERNO", "EXPORTACAO"].includes(
        q.mercadoDestino
      )
    ) {
      erros.mercadoDestino =
        "Informe INTERNO ou EXPORTACAO.";
    } else {
      dados.mercadoDestino =
        q.mercadoDestino;
    }
  }

  if (q.moeda !== undefined) {
    if (!MOEDAS.includes(q.moeda)) {
      erros.moeda = "Moeda inválida.";
    } else {
      dados.moeda = q.moeda;
    }
  }

  if (q.paisDestino !== undefined) {
    if (
      typeof q.paisDestino !== "string" ||
      !/^[A-Z]{2}$/.test(q.paisDestino)
    ) {
      erros.paisDestino =
        "Informe duas letras maiúsculas.";
    } else {
      dados.paisDestino =
        q.paisDestino;
    }
  }

  for (const nome of ["de", "ate"]) {
    if (q[nome] === undefined) {
      continue;
    }

    const data = dataCivil(q[nome]);

    if (!data) {
      erros[nome] =
        "Informe data YYYY-MM-DD válida.";
    } else {
      dados[nome] = data;
    }
  }

  if (
    dados.de &&
    dados.ate &&
    dados.ate < dados.de
  ) {
    erros.ate =
      "O fim não pode anteceder o início.";
  }

  if (Object.keys(erros).length > 0) {
    throw new ErroHttp(
      400,
      "Filtros inválidos.",
      erros
    );
  }

  return dados;
}

module.exports = {
  validarCotacao,
  validarFiltrosCotacoes,
  objeto,
  CAMPOS_DEMANDA,
};