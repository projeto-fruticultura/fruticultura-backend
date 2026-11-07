const { ErroHttp } = require("../middlewares/erros");

const MAIOR_INT = 2147483647;
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

const HORAS_POR_PERIODO = {
  "24h": 24,
  "7d": 168,
  "30d": 720,
};

const FORMATO_DATA =
  /^(\d{4})-(\d{2})-(\d{2})$/;

const FORMATO_DATA_HORA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z?$/;

// Parâmetros da query precisam ser textos com dígitos.
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

// Datas são interpretadas em UTC.
// Data sem horário:
// de  = início do dia
// ate = final do dia
function lerData(valor, fimDoDia = false) {
  if (typeof valor !== "string") {
    return null;
  }

  let partes = FORMATO_DATA.exec(valor);

  let hora = fimDoDia ? 23 : 0;
  let minuto = fimDoDia ? 59 : 0;
  let segundo = fimDoDia ? 59 : 0;
  let milissegundo = fimDoDia ? 999 : 0;

  if (!partes) {
    partes = FORMATO_DATA_HORA.exec(valor);

    if (!partes) {
      return null;
    }

    hora = Number(partes[4]);
    minuto = Number(partes[5]);
    segundo = Number(partes[6] || 0);

    milissegundo = partes[7]
      ? Number(partes[7].padEnd(3, "0"))
      : 0;

    if (
      hora > 23 ||
      minuto > 59 ||
      segundo > 59
    ) {
      return null;
    }
  }

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  const data = new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia,
      hora,
      minuto,
      segundo,
      milissegundo
    )
  );

  // Impede datas inexistentes, como 30 de fevereiro.
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }

  return data;
}

function validarFiltrosLeitura(query) {
  const q = query || {};

  const campos = {};
  const filtros = {};

  // Filtros opcionais por identificação.
  for (const nome of [
    "sensorId",
    "loteId",
    "propriedadeId",
  ]) {
    if (q[nome] === undefined) {
      continue;
    }

    const numero = lerInteiro(
      q[nome],
      1,
      MAIOR_INT
    );

    if (numero === null) {
      campos[nome] =
        `${nome} deve ser um número inteiro positivo.`;
    } else {
      filtros[nome] = numero;
    }
  }

  // Aceita período abreviado ou intervalo de datas.
  if (q.periodo !== undefined) {
    const periodoValido =
      typeof q.periodo === "string" &&
      Object.prototype.hasOwnProperty.call(
        HORAS_POR_PERIODO,
        q.periodo
      );

    if (!periodoValido) {
      campos.periodo =
        "Use 24h, 7d ou 30d.";
    }

    if (
      q.de !== undefined ||
      q.ate !== undefined
    ) {
      campos.periodo =
        "Use periodo ou de/ate, separadamente.";
    }

    if (periodoValido) {
      const agora = new Date();

      filtros.ate = agora;

      filtros.de = new Date(
        agora.getTime() -
          HORAS_POR_PERIODO[q.periodo] *
            3_600_000
      );
    }
  } else {
    if (q.de !== undefined) {
      const data = lerData(q.de, false);

      if (data === null) {
        campos.de =
          "de deve ser uma data válida em UTC.";
      } else {
        filtros.de = data;
      }
    }

    if (q.ate !== undefined) {
      const data = lerData(q.ate, true);

      if (data === null) {
        campos.ate =
          "ate deve ser uma data válida em UTC.";
      } else {
        filtros.ate = data;
      }
    }
  }

  if (
    filtros.de &&
    filtros.ate &&
    filtros.de > filtros.ate
  ) {
    campos.de =
      "de não pode ser maior que ate.";
  }

  // Paginação.
  filtros.pagina = 1;

  if (q.pagina !== undefined) {
    const pagina = lerInteiro(
      q.pagina,
      1,
      MAIOR_INT
    );

    if (pagina === null) {
      campos.pagina =
        "pagina deve ser um número inteiro positivo.";
    } else {
      filtros.pagina = pagina;
    }
  }

  filtros.limite = LIMITE_PADRAO;

  if (q.limite !== undefined) {
    const limite = lerInteiro(
      q.limite,
      1,
      LIMITE_MAXIMO
    );

    if (limite === null) {
      campos.limite =
        `limite deve estar entre 1 e ${LIMITE_MAXIMO}.`;
    } else {
      filtros.limite = limite;
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

module.exports = {
  validarFiltrosLeitura,
  lerInteiro,
  lerData,
};