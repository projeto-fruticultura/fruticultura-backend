const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroSensor } = require("./escopoDono");

// Configura o canal do ThingSpeak de um sensor: testa as credenciais e so grava se o ThingSpeak aceitar.
// O agendador de leituras continua usando as variaveis de ambiente globais (thingspeakService).
//
// ATENCAO: a chave de leitura vai na URL (parametro api_key), como no thingspeakService. Por isso, neste
// arquivo, nem a URL, nem o erro bruto do fetch, nem o erro bruto do Prisma (que traz os dados da consulta,
// inclusive a chave) sao impressos ou repassados: todo erro vira um ErroHttp novo, com mensagem fixa.

// Host fixo: da entrada do usuario, so o id do canal (ja validado como digitos) entra no caminho.
const URL_BASE = "https://api.thingspeak.com/channels";
// Mais curto que o do agendador (10 s): aqui ha uma pessoa esperando a resposta.
const TIMEOUT_MS = 5_000;

const ERRO_NAO_ENCONTRADO = "Sensor não encontrado.";
const ERRO_CREDENCIAIS = "Credenciais do ThingSpeak inválidas (canal ou chave de leitura). Nada foi salvo.";
const ERRO_INDISPONIVEL = "ThingSpeak indisponível. Tente novamente mais tarde. Nada foi salvo.";
const ERRO_TIMEOUT = `ThingSpeak indisponível: não respondeu em ${TIMEOUT_MS / 1000} segundos. Nada foi salvo.`;

// Sensor visivel ao usuario (ADMIN: qualquer um; TECNICO: so das propriedades vinculadas), ATIVO e de
// propriedade ATIVA. Fora disso: 404, a mesma resposta para inexistente e de outra pessoa.
function escopo(sensorId, usuario) {
  return {
    id: sensorId,
    status: "ATIVO",
    AND: [filtroSensor(usuario), { lote: { propriedade: { status: "ATIVO" } } }],
  };
}

function erroDeRede(erro) {
  if (erro && (erro.name === "TimeoutError" || erro.name === "AbortError")) return new ErroHttp(504, ERRO_TIMEOUT);
  return new ErroHttp(502, ERRO_INDISPONIVEL);
}

// Le 1 registro do canal so para confirmar o acesso. Sucesso e so HTTP 200 com o corpo de um canal.
async function testarCanal(channelId, readApiKey, fetchImpl) {
  const url = new URL(`${URL_BASE}/${channelId}/feeds.json`);
  url.searchParams.set("api_key", readApiKey);
  url.searchParams.set("results", "1");

  // O mesmo sinal de timeout cobre a requisicao e a leitura do corpo.
  const sinal = AbortSignal.timeout(TIMEOUT_MS);

  let resposta;
  try {
    // redirect "error": a URL com a chave nunca e reenviada para outro endereco.
    resposta = await fetchImpl(url.toString(), {
      signal: sinal,
      redirect: "error",
      headers: { Accept: "application/json" },
    });
  } catch (erro) {
    throw erroDeRede(erro);
  }

  // 429 e limite de uso do ThingSpeak, nao credencial errada: conta como indisponivel.
  if (resposta.status === 429) throw new ErroHttp(502, ERRO_INDISPONIVEL);
  if (resposta.status >= 400 && resposta.status < 500) throw new ErroHttp(422, ERRO_CREDENCIAIS);
  if (resposta.status !== 200) throw new ErroHttp(502, ERRO_INDISPONIVEL);

  let corpo;
  try {
    corpo = await resposta.json();
  } catch (erro) {
    // Corpo que nao e JSON (ex.: pagina de erro em HTML) e falha do ThingSpeak, nao da credencial.
    if (erro instanceof SyntaxError) throw new ErroHttp(502, ERRO_INDISPONIVEL);
    throw erroDeRede(erro);
  }

  // Algumas APIs do ThingSpeak respondem 200 com -1 quando a chave nao confere: sem a lista de feeds,
  // o acesso ao canal nao foi confirmado.
  if (!corpo || typeof corpo !== "object" || !Array.isArray(corpo.feeds)) {
    throw new ErroHttp(422, ERRO_CREDENCIAIS);
  }
}

// "dados" ja vem do validator: { sensorId, channelId, readApiKey }.
// fetchImpl existe para teste, como no thingspeakService.
async function configurar(dados, usuario, { fetchImpl = fetch } = {}) {
  const { sensorId, channelId, readApiKey } = dados;

  // Primeiro o escopo: sensor que o usuario nao pode configurar nao dispara chamada externa.
  // Esta consulta nao leva a chave, entao um erro aqui pode seguir para o middleware normalmente.
  const sensor = await prisma.sensor.findFirst({ where: escopo(sensorId, usuario), select: { id: true } });
  if (!sensor) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

  await testarCanal(channelId, readApiKey, fetchImpl);

  try {
    // Mesmo filtro no where: se o sensor saiu do escopo durante o teste, nada e gravado.
    // select (lista do que sai) em vez de omit: a chave nunca entra na resposta.
    const salvo = await prisma.sensor.update({
      where: escopo(sensorId, usuario),
      data: { channelId, readApiKey },
      select: { id: true, codigo: true, channelId: true },
    });
    return { ...salvo, conectado: true };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
    }
    // So o codigo ou o tipo do erro vai para o log: a mensagem do Prisma repete o "data" com a chave.
    console.error(`Config ThingSpeak: falha ao gravar o sensor ${sensorId} (${(erro && (erro.code || erro.name)) || "erro desconhecido"}).`);
    throw new ErroHttp(500, "Erro interno. Tente novamente mais tarde.");
  }
}

module.exports = { configurar };
