const prisma = require("../config/prisma");

const { ErroHttp } = require("../middlewares/erros");

const { filtroSensor } = require("./escopoDono");

const URL_BASE =
  "https://api.thingspeak.com/channels";

const TIMEOUT_MS = 5000;

function escopo(sensorId, usuario) {
  return {
    id: sensorId,
    status: "ATIVO",

    AND: [
      filtroSensor(usuario),

      {
        lote: {
          propriedade: {
            status: "ATIVO",
          },
        },
      },
    ],
  };
}

function erroDeRede(erro) {
  if (
    erro?.name === "TimeoutError" ||
    erro?.name === "AbortError"
  ) {
    return new ErroHttp(
      504,
      "O ThingSpeak não respondeu a tempo. Nada foi salvo."
    );
  }

  return new ErroHttp(
    502,
    "Falha ao consultar o ThingSpeak. Nada foi salvo."
  );
}

async function testarCanal(
  channelId,
  readApiKey,
  fetchImpl
) {
  const url = new URL(
    `${URL_BASE}/${channelId}/feeds.json`
  );

  url.searchParams.set(
    "api_key",
    readApiKey
  );

  url.searchParams.set("results", "1");

  const sinal =
    AbortSignal.timeout(TIMEOUT_MS);

  let resposta;

  try {
    resposta = await fetchImpl(
      url.toString(),
      {
        signal: sinal,
        redirect: "error",

        headers: {
          Accept: "application/json",
        },
      }
    );
  } catch (erro) {
    throw erroDeRede(erro);
  }

  if (resposta.status === 429) {
    throw new ErroHttp(
      502,
      "Limite de consultas do ThingSpeak atingido. Nada foi salvo."
    );
  }

  if (
    resposta.status >= 400 &&
    resposta.status < 500
  ) {
    throw new ErroHttp(
      422,
      "Canal ou chave de leitura inválidos. Nada foi salvo."
    );
  }

  if (resposta.status !== 200) {
    throw new ErroHttp(
      502,
      "ThingSpeak indisponível. Nada foi salvo."
    );
  }

  let corpo;

  try {
    corpo = await resposta.json();
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      throw new ErroHttp(
        502,
        "Resposta inválida do ThingSpeak. Nada foi salvo."
      );
    }

    throw erroDeRede(erro);
  }

  // O HTTP 200 sozinho não basta:
  // a resposta precisa conter o canal solicitado.
  if (
    !corpo ||
    typeof corpo !== "object" ||
    !Array.isArray(corpo.feeds) ||
    String(corpo.channel?.id) !== channelId
  ) {
    throw new ErroHttp(
      422,
      "Não foi possível validar o canal informado. Nada foi salvo."
    );
  }
}

async function configurar(
  dados,
  usuario,
  { fetchImpl = fetch } = {}
) {
  const {
    sensorId,
    channelId,
    readApiKey,
  } = dados;

  // Primeiro verifica o acesso ao sensor.
  const sensor =
    await prisma.sensor.findFirst({
      where: escopo(sensorId, usuario),

      select: {
        id: true,
      },
    });

  if (!sensor) {
    throw new ErroHttp(
      404,
      "Sensor não encontrado."
    );
  }

  // Se falhar, a gravação abaixo não é executada.
  await testarCanal(
    channelId,
    readApiKey,
    fetchImpl
  );

  try {
    const salvo =
      await prisma.sensor.update({
        where: escopo(sensorId, usuario),

        data: {
          channelId,
          readApiKey,
        },

        // Não retorna a chave ao cliente.
        select: {
          id: true,
          codigo: true,
          channelId: true,
        },
      });

    return {
      ...salvo,
      conectado: true,
    };
  } catch (erro) {
    if (erro?.code === "P2025") {
      throw new ErroHttp(
        404,
        "Sensor não encontrado."
      );
    }

    // Não imprime a mensagem bruta do Prisma,
    // pois ela pode conter a chave de leitura.
    console.error(
      JSON.stringify({
        evento: "configuracao_sensor_falhou",
        sensorId,
        tipo: erro?.name,
        codigo: erro?.code,
      })
    );

    throw new ErroHttp(
      500,
      "Não foi possível salvar a configuração."
    );
  }
}

module.exports = {
  configurar,
};