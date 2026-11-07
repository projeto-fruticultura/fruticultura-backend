const URL_BASE =
  "https://api.thingspeak.com/channels";

const TIMEOUT_MS = 10_000;
const MAXIMO_RESULTS = 8000;

const FORMATO_NUMERO = /^-?\d+(\.\d+)?$/;

function exigirVariavel(nome) {
  const valor = process.env[nome];

  if (!valor) {
    throw new Error(
      `A variável ${nome} não foi definida.`
    );
  }

  return valor;
}

function lerNumero(valor) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    return null;
  }

  const texto = String(valor).trim();

  if (!FORMATO_NUMERO.test(texto)) {
    return null;
  }

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : null;
}

function converterFeed(feed) {
  if (!feed || typeof feed !== "object") {
    return null;
  }

  if (typeof feed.created_at !== "string") {
    return null;
  }

  const formatoData =
    /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

  const partes = formatoData.exec(feed.created_at);

  if (!partes) {
    return null;
  }

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  if (mes < 1 || mes > 12 || dia < 1) {
    return null;
  }

  const ultimoDiaDoMes =
    new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  if (dia > ultimoDiaDoMes) {
    return null;
  }

  const dataHoraLeitura =
    new Date(feed.created_at);

  if (
    Number.isNaN(dataHoraLeitura.getTime()) ||
    dataHoraLeitura.getTime() > Date.now() + 60_000
  ) {
    return null;
  }

  // Contrato do canal:
  // field1 = temperatura
  // field2 = umidade
  const temperatura = lerNumero(feed.field1);
  const umidade = lerNumero(feed.field2);

  if (temperatura === null || umidade === null) {
    return null;
  }

  // Faixas operacionais adotadas pelo protótipo.
  if (temperatura < -10 || temperatura > 60) {
    return null;
  }

  if (umidade < 0 || umidade > 100) {
    return null;
  }

  return {
    temperatura,
    umidade,
    dataHoraLeitura,
  };
}

function erroDeRede(erro) {
  if (
    erro?.name === "TimeoutError" ||
    erro?.name === "AbortError"
  ) {
    return new Error(
      "O ThingSpeak não respondeu em 10 segundos."
    );
  }

  return new Error(
    "Falha de rede ao consultar o ThingSpeak."
  );
}

async function buscarLeituras({
  results = 8000,
  channelId,
  readApiKey,
  fetchImpl = fetch,
} = {}) {
  const canal =
    channelId ||
    exigirVariavel("THINGSPEAK_CHANNEL_ID");

  const chave =
    readApiKey ||
    exigirVariavel("THINGSPEAK_READ_KEY");

  if (!/^\d+$/.test(canal)) {
    throw new Error(
      "O ID do canal deve conter somente dígitos."
    );
  }

  if (
    !Number.isInteger(results) ||
    results < 1 ||
    results > MAXIMO_RESULTS
  ) {
    throw new Error(
      "results deve estar entre 1 e 8000."
    );
  }

  const url =
    new URL(`${URL_BASE}/${canal}/feeds.json`);

  url.searchParams.set("api_key", chave);
  url.searchParams.set("results", String(results));

  const sinal = AbortSignal.timeout(TIMEOUT_MS);

  let resposta;

  try {
    resposta = await fetchImpl(url.toString(), {
      signal: sinal,
      redirect: "error",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (erro) {
    throw erroDeRede(erro);
  }

  if (!resposta.ok) {
    throw new Error(
      `ThingSpeak respondeu HTTP ${resposta.status}.`
    );
  }

  let corpo;

  try {
    corpo = await resposta.json();
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      throw new Error(
        "Resposta do ThingSpeak em formato inválido."
      );
    }

    throw erroDeRede(erro);
  }

  if (!corpo || !Array.isArray(corpo.feeds)) {
    throw new Error(
      "Resposta do ThingSpeak em formato inválido."
    );
  }

  const leituras = [];
  let descartadas = 0;

  for (const feed of corpo.feeds) {
    const leitura = converterFeed(feed);

    if (leitura) {
      leituras.push(leitura);
    } else {
      descartadas++;
    }
  }

  return {
    leituras,
    descartadas,
  };
}

module.exports = {
  buscarLeituras,
  converterFeed,
};