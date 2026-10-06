// So fala com o ThingSpeak e traduz o formato. Nao toca no banco (quem grava e o leituraService).
//
// ATENCAO: a chave de leitura vai na URL (parametro api_key), porque a documentacao do ThingSpeak
// so descreve essa forma para LER um canal privado. Por isso, em nenhum lugar deste arquivo
// a URL ou o erro bruto do fetch sao impressos ou repassados: ambos podem conter a chave.

const URL_BASE = "https://api.thingspeak.com/channels";
const TIMEOUT_MS = 10_000;
// Limite da propria API do ThingSpeak para "results".
const MAXIMO_RESULTS = 8000;

// Faixas plausiveis. Valor fora delas indica sensor com defeito e nao deve entrar no historico.
const TEMPERATURA_MIN = -10;
const TEMPERATURA_MAX = 60;
const UMIDADE_MIN = 0;
const UMIDADE_MAX = 100;

// O ThingSpeak devolve os campos como texto ("29.30"). Aceitamos so decimal simples:
// Number("") vale 0 e Number("1e2") vale 100, e nenhum dos dois e uma leitura valida.
const FORMATO_NUMERO = /^-?\d+(\.\d+)?$/;

const MENSAGEM_FORMATO = "A resposta do ThingSpeak veio em formato inesperado.";

function exigirVariavel(nome) {
  const valor = process.env[nome];
  // A mensagem diz so o nome da variavel, nunca o valor.
  if (!valor) throw new Error(`A variável de ambiente ${nome} não foi definida.`);
  return valor;
}

// Devolve o numero, ou null se o campo for nulo, vazio ou nao numerico.
function lerNumero(campo) {
  if (typeof campo !== "string" && typeof campo !== "number") return null;
  const texto = String(campo).trim();
  if (!FORMATO_NUMERO.test(texto)) return null;
  return Number(texto);
}

// Converte um feed em leitura, ou devolve null se ele deve ser descartado.
function converterFeed(feed) {
  if (!feed || typeof feed !== "object") return null;

  // created_at ja vem em UTC (formato "2026-10-06T14:05:00Z").
  if (typeof feed.created_at !== "string") return null;
  const dataHoraLeitura = new Date(feed.created_at);
  if (Number.isNaN(dataHoraLeitura.getTime())) return null;

  // field1 = temperatura e field2 = umidade. field3 (temp. maxima) e field4 (alerta) sao ignorados.
  const temperatura = lerNumero(feed.field1);
  const umidade = lerNumero(feed.field2);
  if (temperatura === null || umidade === null) return null;
  if (temperatura < TEMPERATURA_MIN || temperatura > TEMPERATURA_MAX) return null;
  if (umidade < UMIDADE_MIN || umidade > UMIDADE_MAX) return null;

  return { dataHoraLeitura, temperatura, umidade };
}

// Traduz qualquer falha do fetch em mensagem generica. Nunca repassa o erro original:
// a mensagem ou a causa dele pode trazer a URL com a chave.
function erroDeRede(erro) {
  if (erro && (erro.name === "TimeoutError" || erro.name === "AbortError")) {
    return new Error(`O ThingSpeak não respondeu em ${TIMEOUT_MS / 1000} segundos.`);
  }
  return new Error("Falha de rede ao consultar o ThingSpeak.");
}

async function buscarLeituras({ results = 100, fetchImpl = fetch } = {}) {
  const canal = exigirVariavel("THINGSPEAK_CHANNEL_ID");
  const chave = exigirVariavel("THINGSPEAK_READ_KEY");

  // So digitos: o id entra no caminho da URL, entao nada de "/" ou "?" vindos do .env.
  if (!/^\d+$/.test(canal)) throw new Error("A variável de ambiente THINGSPEAK_CHANNEL_ID deve conter só dígitos.");
  if (!Number.isInteger(results) || results < 1 || results > MAXIMO_RESULTS) {
    throw new Error(`O parâmetro results deve ser um inteiro entre 1 e ${MAXIMO_RESULTS}.`);
  }

  const url = new URL(`${URL_BASE}/${canal}/feeds.json`);
  url.searchParams.set("api_key", chave);
  url.searchParams.set("results", String(results));

  // O mesmo sinal de timeout cobre a requisicao e a leitura do corpo.
  const sinal = AbortSignal.timeout(TIMEOUT_MS);

  let resposta;
  try {
    resposta = await fetchImpl(url.toString(), { signal: sinal, headers: { Accept: "application/json" } });
  } catch (erro) {
    throw erroDeRede(erro);
  }

  // So o status HTTP vai na mensagem, nunca a URL.
  if (!resposta.ok) throw new Error(`O ThingSpeak respondeu com status HTTP ${resposta.status}.`);

  let corpo;
  try {
    corpo = await resposta.json();
  } catch (erro) {
    if (erro instanceof SyntaxError) throw new Error(MENSAGEM_FORMATO);
    throw erroDeRede(erro);
  }

  if (!corpo || !Array.isArray(corpo.feeds)) throw new Error(MENSAGEM_FORMATO);

  const leituras = [];
  let descartadas = 0;
  for (const feed of corpo.feeds) {
    const leitura = converterFeed(feed);
    if (leitura) leituras.push(leitura);
    else descartadas += 1;
  }

  return { leituras, descartadas };
}

module.exports = { buscarLeituras };
