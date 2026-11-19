const { ErroHttp } = require("../middlewares/erros");

const TEMPO_LIMITE_MS = 12000;

const STATUS_COLHEITA = new Set([
  "FAVORAVEL",
  "AGUARDAR_MATURACAO",
  "SEM_JANELA_NO_HORIZONTE",
  "DADOS_INSUFICIENTES",
]);

const STATUS_EXPORTACAO = new Set([
  "FAVORAVEL",
  "NAO_FAVORAVEL",
  "SEM_JANELA_COLHEITA",
  "DADOS_INSUFICIENTES",
]);

function validarUrl(urlTexto) {
  let url;

  try {
    url = new URL(urlTexto);
  } catch {
    throw new ErroHttp(
      503,
      "Serviço Python de recomendações não configurado corretamente."
    );
  }

  const localhost = [
    "localhost",
    "127.0.0.1",
    "::1",
  ].includes(url.hostname);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    (url.protocol !== "https:" && !localhost) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new ErroHttp(
      503,
      "URL do serviço Python inválida; use HTTPS fora do ambiente local."
    );
  }

  return url;
}

function instanteValido(valor) {
  return (
    typeof valor === "string" &&
    Number.isFinite(Date.parse(valor)) &&
    /Z$/.test(valor)
  );
}

function validarResposta(resultado) {
  const listaDeTextos = (valor) =>
    Array.isArray(valor) &&
    valor.every(
      (item) => typeof item === "string"
    );

  const janelasColheitaValidas = (janelas) =>
    Array.isArray(janelas) &&
    janelas.every(
      (janela) =>
        instanteValido(janela?.inicio) &&
        instanteValido(janela?.fim)
    );

  const janelasExportacaoValidas = (janelas) =>
    Array.isArray(janelas) &&
    janelas.every((janela) =>
      [
        "colheitaInicio",
        "colheitaFim",
        "embarqueInicio",
        "embarqueFim",
        "chegadaInicio",
        "chegadaFim",
      ].every(
        (campo) =>
          instanteValido(janela?.[campo])
      )
    );

  if (
    !resultado ||
    typeof resultado !== "object" ||
    resultado.contractVersion !== "1.0" ||
    typeof resultado.modelVersion !== "string" ||
    !resultado.modelVersion.trim() ||
    !instanteValido(resultado.generatedAt) ||
    !resultado.harvest ||
    !STATUS_COLHEITA.has(resultado.harvest.status) ||
    !janelasColheitaValidas(resultado.harvest.windows) ||
    !listaDeTextos(resultado.harvest.reasons) ||
    !resultado.export ||
    !STATUS_EXPORTACAO.has(resultado.export.status) ||
    !janelasExportacaoValidas(resultado.export.windows) ||
    !listaDeTextos(resultado.export.reasons)
  ) {
    throw new ErroHttp(
      502,
      "Resposta inválida do serviço Python de recomendações."
    );
  }

  return resultado;
}

async function consultar(
  payload,
  {
    fetchImpl = fetch,
    env = process.env,
  } = {}
) {
  const urlTexto =
    env.PYTHON_RECOMMENDATION_URL;

  if (!urlTexto) {
    throw new ErroHttp(
      503,
      "Serviço Python de recomendações indisponível: URL não configurada."
    );
  }

  const url = validarUrl(urlTexto);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (env.PYTHON_RECOMMENDATION_TOKEN) {
    headers.Authorization =
      `Bearer ${env.PYTHON_RECOMMENDATION_TOKEN}`;
  }

  let resposta;

  try {
    resposta = await fetchImpl(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      redirect: "error",
    });
  } catch (erro) {
    if (
      erro?.name === "TimeoutError" ||
      erro?.name === "AbortError"
    ) {
      throw new ErroHttp(
        504,
        "Serviço Python de recomendações excedeu o tempo limite."
      );
    }

    throw new ErroHttp(
      503,
      "Serviço Python de recomendações indisponível."
    );
  }

  if (!resposta.ok) {
    if (
      resposta.status === 429 ||
      resposta.status >= 500
    ) {
      throw new ErroHttp(
        503,
        "Serviço Python de recomendações indisponível."
      );
    }

    throw new ErroHttp(
      502,
      "Serviço Python recusou a requisição; confira o contrato REST."
    );
  }

  let resultado;

  try {
    resultado = await resposta.json();
  } catch {
    throw new ErroHttp(
      502,
      "Serviço Python retornou uma resposta que não é JSON válido."
    );
  }

  return validarResposta(resultado);
}

module.exports = {
  consultar,
  validarResposta,
  validarUrl,
  TEMPO_LIMITE_MS,
};