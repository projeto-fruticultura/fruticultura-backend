const { ErroHttp } = require("../middlewares/erros");

const {
  validarId,
} = require("./propriedadeValidator");

const MAIOR_ID = 2147483647;
const TEXTO_MAXIMO = 150;
const TEMPO_MAXIMO = 99999.9;
const CUSTO_MAXIMO = 9999999999.99;
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

const MODAIS = [
  "RODOVIARIO",
  "FERROVIARIO",
  "AEREO",
  "MARITIMO",
];

const SITUACOES = [
  "PLANEJADA",
  "EM_TRANSITO",
  "ENTREGUE",
  "CANCELADA",
];

function mensagemLista(nome, aceitos) {
  return `${nome} deve ser um destes valores: ${aceitos.join(", ")}.`;
}

function lerInteiro(valor, minimo, maximo) {
  if (
    typeof valor !== "string" ||
    !/^\d+$/.test(valor)
  ) {
    return null;
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero < minimo ||
    numero > maximo
  ) {
    return null;
  }

  return numero;
}

// GET /api/logistica
function validarFiltrosLogistica(query) {
  const q = query || {};
  const campos = {};
  const filtros = {};

  if (q.propriedadeId !== undefined) {
    const numero = lerInteiro(
      q.propriedadeId,
      1,
      MAIOR_ID
    );

    if (numero === null) {
      campos.propriedadeId =
        "propriedadeId deve ser um número inteiro positivo.";
    } else {
      filtros.propriedadeId = numero;
    }
  }

  for (const [nome, aceitos] of [
    ["modal", MODAIS],
    ["situacao", SITUACOES],
  ]) {
    if (q[nome] === undefined) {
      continue;
    }

    if (
      typeof q[nome] === "string" &&
      aceitos.includes(q[nome])
    ) {
      filtros[nome] = q[nome];
    } else {
      campos[nome] = mensagemLista(
        nome,
        aceitos
      );
    }
  }

  filtros.pagina = 1;

  if (q.pagina !== undefined) {
    const numero = lerInteiro(
      q.pagina,
      1,
      MAIOR_ID
    );

    if (numero === null) {
      campos.pagina =
        "pagina deve ser um número inteiro maior ou igual a 1.";
    } else {
      filtros.pagina = numero;
    }
  }

  filtros.limite = LIMITE_PADRAO;

  if (q.limite !== undefined) {
    const numero = lerInteiro(
      q.limite,
      1,
      LIMITE_MAXIMO
    );

    if (numero === null) {
      campos.limite =
        `limite deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.`;
    } else {
      filtros.limite = numero;
    }
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(
      400,
      "Filtro inválido.",
      campos
    );
  }

  return filtros;
}

function lerTexto(
  corpo,
  nome,
  maximo,
  campos,
  obrigatorio
) {
  const valor = corpo[nome];

  if (valor === undefined) {
    if (obrigatorio) {
      campos[nome] = `${nome} é obrigatório.`;
    }

    return undefined;
  }

  if (valor === null) {
    campos[nome] = obrigatorio
      ? `${nome} é obrigatório.`
      : `${nome} não pode ser nulo.`;

    return undefined;
  }

  if (typeof valor !== "string") {
    campos[nome] = `${nome} deve ser um texto.`;
    return undefined;
  }

  const limpo = valor.trim();

  if (
    limpo.length < 1 ||
    limpo.length > maximo
  ) {
    campos[nome] =
      `${nome} deve ter entre 1 e ${maximo} caracteres.`;

    return undefined;
  }

  return limpo;
}

function lerLista(
  corpo,
  nome,
  aceitos,
  campos,
  obrigatorio
) {
  const valor = corpo[nome];

  if (valor === undefined) {
    if (obrigatorio) {
      campos[nome] =
        `${nome} é obrigatório. ${mensagemLista(nome, aceitos)}`;
    }

    return undefined;
  }

  if (valor === null) {
    campos[nome] = obrigatorio
      ? `${nome} é obrigatório.`
      : `${nome} não pode ser nulo.`;

    return undefined;
  }

  if (
    typeof valor !== "string" ||
    !aceitos.includes(valor)
  ) {
    campos[nome] = mensagemLista(
      nome,
      aceitos
    );

    return undefined;
  }

  return valor;
}

function lerNumero(
  corpo,
  nome,
  { maximo, casas, erroFaixa },
  campos,
  obrigatorio
) {
  const valor = corpo[nome];

  if (valor === undefined) {
    if (obrigatorio) {
      campos[nome] = `${nome} é obrigatório.`;
    }

    return undefined;
  }

  if (valor === null) {
    campos[nome] = obrigatorio
      ? `${nome} é obrigatório.`
      : `${nome} não pode ser nulo.`;

    return undefined;
  }

  if (
    typeof valor !== "number" ||
    !Number.isFinite(valor)
  ) {
    campos[nome] = `${nome} deve ser um número.`;
    return undefined;
  }

  const faixa = erroFaixa(valor);

  if (faixa) {
    campos[nome] = faixa;
    return undefined;
  }

  if (valor > maximo) {
    campos[nome] =
      `${nome} deve ser no máximo ${maximo}.`;

    return undefined;
  }

  const formato = new RegExp(
    `^\\d+(\\.\\d{1,${casas}})?$`
  );

  if (!formato.test(String(valor))) {
    campos[nome] =
      `${nome} deve ter no máximo ${casas} ` +
      `${casas === 1 ? "casa decimal" : "casas decimais"}.`;

    return undefined;
  }

  return valor;
}

function lerIdNumerico(
  corpo,
  nome,
  campos
) {
  const valor = corpo[nome];

  if (
    valor === undefined ||
    valor === null
  ) {
    campos[nome] = `${nome} é obrigatório.`;
    return undefined;
  }

  if (
    typeof valor !== "number" ||
    !Number.isInteger(valor) ||
    valor < 1 ||
    valor > MAIOR_ID
  ) {
    campos[nome] =
      `${nome} deve ser um número inteiro positivo.`;

    return undefined;
  }

  return valor;
}

function lerResfriamento(corpo, campos) {
  const nomes = ["colhidoEm", "resfriadoEm", "temperaturaResfriamentoC"];
  if (nomes.every((nome) => corpo[nome] === undefined)) return {};
  if (nomes.every((nome) => corpo[nome] === null)) {
    return { colhidoEm: null, resfriadoEm: null, temperaturaResfriamentoC: null };
  }

  function lerInstante(nome) {
    const valor = corpo[nome];
    const partes = typeof valor === "string" &&
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(valor);
    const data = partes ? new Date(valor) : null;
    if (!data || !Number.isFinite(+data) ||
        data.toISOString() !== `${partes[1]}.${(partes[2] || "").padEnd(3, "0")}Z` ||
        data.getTime() > Date.now()) {
      campos[nome] = "Informe uma data e hora válidas que já ocorreram.";
      return undefined;
    }
    return data;
  }

  const colhidoEm = lerInstante("colhidoEm");
  const resfriadoEm = lerInstante("resfriadoEm");
  if (colhidoEm && resfriadoEm && resfriadoEm < colhidoEm) {
    campos.resfriadoEm = "O resfriamento deve acontecer a partir da colheita.";
  }

  const temperaturaResfriamentoC = corpo.temperaturaResfriamentoC;
  if (typeof temperaturaResfriamentoC !== "number" ||
      !Number.isFinite(temperaturaResfriamentoC) ||
      temperaturaResfriamentoC < -273.15 || temperaturaResfriamentoC > 100) {
    campos.temperaturaResfriamentoC = "Informe a temperatura medida entre -273,15 °C e 100 °C.";
  }

  return { colhidoEm, resfriadoEm, temperaturaResfriamentoC };
}

// POST e PUT /api/logistica.
// No PUT, campos omitidos preservam os valores anteriores.
function validarLogistica(corpo, modo) {
  if (
    !corpo ||
    typeof corpo !== "object" ||
    Array.isArray(corpo)
  ) {
    throw new ErroHttp(
      400,
      "Envie os dados da rota logística em JSON."
    );
  }

  const criar = modo === "criar";
  const campos = {};

  const dados = {
    origem: lerTexto(
      corpo,
      "origem",
      TEXTO_MAXIMO,
      campos,
      criar
    ),

    destino: lerTexto(
      corpo,
      "destino",
      TEXTO_MAXIMO,
      campos,
      criar
    ),

    modal: lerLista(
      corpo,
      "modal",
      MODAIS,
      campos,
      criar
    ),

    tempoEstimadoHoras: lerNumero(
      corpo,
      "tempoEstimadoHoras",
      {
        maximo: TEMPO_MAXIMO,
        casas: 1,

        erroFaixa: (valor) =>
          valor <= 0
            ? "tempoEstimadoHoras deve ser maior que zero."
            : null,
      },
      campos,
      criar
    ),

    custo: lerNumero(
      corpo,
      "custo",
      {
        maximo: CUSTO_MAXIMO,
        casas: 2,

        erroFaixa: (valor) =>
          valor < 0
            ? "custo não pode ser negativo."
            : null,
      },
      campos,
      criar
    ),

    transportadora: lerTexto(
      corpo,
      "transportadora",
      TEXTO_MAXIMO,
      campos,
      criar
    ),

    situacao: lerLista(
      corpo,
      "situacao",
      SITUACOES,
      campos,
      criar
    ),
  };

  // true: exige refrigeração rápida.
  // false: operador declarou que não exige.
  // null: informação desconhecida.
  if (
    corpo.exigeRefrigeracaoRapida !== undefined
  ) {
    const valor =
      corpo.exigeRefrigeracaoRapida;

    if (
      valor !== null &&
      typeof valor !== "boolean"
    ) {
      campos.exigeRefrigeracaoRapida =
        "Informe true, false ou null (não informado).";
    } else {
      dados.exigeRefrigeracaoRapida = valor;
    }
  }

  Object.assign(dados, lerResfriamento(corpo, campos));

  if (criar) {
    dados.propriedadeId = lerIdNumerico(
      corpo,
      "propriedadeId",
      campos
    );
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(
      400,
      "Dados inválidos.",
      campos
    );
  }

  if (criar) {
    return dados;
  }

  return Object.fromEntries(
    Object.entries(dados).filter(
      ([, valor]) => valor !== undefined
    )
  );
}

module.exports = {
  validarFiltrosLogistica,
  validarLogistica,
  validarId,
};