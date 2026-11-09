const { ErroHttp } = require("../middlewares/erros");

const BASE = "https://api.open-meteo.com/v1/forecast";

async function obterPrevisao(
  latitude,
  longitude,
  { fetchImpl = fetch, agora = new Date() } = {},
) {
  if (
    ![latitude, longitude].every(Number.isFinite) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new ErroHttp(
      422,
      "Coordenadas válidas são necessárias para a previsão.",
    );
  }

  const url = new URL(BASE);

  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "daily",
    "temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean",
  );
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("forecast_days", "7");

  let resposta;
  let corpo;

  try {
    resposta = await fetchImpl(url.toString(), {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { Accept: "application/json" },
    });

    if (!resposta.ok) {
      throw new Error("status");
    }

    corpo = await resposta.json();
  } catch {
    throw new ErroHttp(
      503,
      "Previsão meteorológica indisponível. Não foi estimada uma janela.",
    );
  }

  const dadosDiarios = corpo?.daily;
  const unidades = corpo?.daily_units;

  function previsaoInvalida() {
    throw new ErroHttp(503, "Previsão meteorológica incompleta ou inválida.");
  }

  if (
    !dadosDiarios ||
    unidades?.temperature_2m_mean !== "°C" ||
    unidades?.precipitation_sum !== "mm" ||
    unidades?.relative_humidity_2m_mean !== "%"
  ) {
    previsaoInvalida();
  }

  if (!Array.isArray(dadosDiarios.time) || dadosDiarios.time.length !== 7) {
    previsaoInvalida();
  }

  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);

  const dias = dadosDiarios.time.map((data, indice) => {
    const dataEsperada = new Date(
      +hoje + indice * 86400000,
    )
      .toISOString()
      .slice(0, 10);

    const temperaturaMedia =
      dadosDiarios.temperature_2m_mean?.[indice];
    const chuvaMm = dadosDiarios.precipitation_sum?.[indice];
    const umidadeAr =
      dadosDiarios.relative_humidity_2m_mean?.[indice];

    if (
      data !== dataEsperada ||
      ![temperaturaMedia, chuvaMm, umidadeAr].every(
        (valor) => typeof valor === "number" && Number.isFinite(valor),
      ) ||
      temperaturaMedia < -90 ||
      temperaturaMedia > 70 ||
      chuvaMm < 0 ||
      umidadeAr < 0 ||
      umidadeAr > 100
    ) {
      previsaoInvalida();
    }

    return {
      data,
      temperaturaMedia,
      chuvaMm,
      umidadeAr,
    };
  });

  return {
    fonte: "Open-Meteo",
    consultadaEm: agora.toISOString(),
    timezone: "UTC",
    dias,
  };
}

module.exports = { obterPrevisao };