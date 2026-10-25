const { ErroHttp } = require("../middlewares/erros");
// Mesma regra de :id de Propriedades; importado para nao manter duas copias.
const { validarId } = require("./propriedadeValidator");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_ID = 2147483647;

function validarTexto(valor, min, max) {
  if (valor === undefined || valor === null || valor === "") return "é obrigatório.";
  if (typeof valor !== "string") return "deve ser um texto.";
  const limpo = valor.trim();
  if (limpo.length < min || limpo.length > max) return `deve ter entre ${min} e ${max} caracteres.`;
  return null;
}

// Data de hoje no fuso do servidor, no mesmo formato AAAA-MM-DD da entrada.
function hojeComoTexto() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function validarDataInstalacao(valor) {
  if (valor === undefined || valor === null || valor === "") return "dataInstalacao é obrigatória.";
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return "dataInstalacao deve estar no formato AAAA-MM-DD.";
  }
  // new Date aceita 2026-02-30 e "pula" para marco; comparar as partes pega isso.
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return "dataInstalacao não é uma data válida.";
  }
  // Mesmo formato dos dois lados, entao a comparacao de texto funciona.
  if (valor > hojeComoTexto()) return "dataInstalacao não pode ser no futuro.";
  return null;
}

// Valida o corpo do POST/PUT e devolve so os campos permitidos.
// id e status nunca vem do cliente. channelId e readApiKey tambem nao: sao definidos so pela
// configuracao do ThingSpeak, que testa a conexao antes de salvar. Como qualquer campo fora da
// lista abaixo, sao ignorados (e nao recusados), para o front poder reenviar o sensor que leu no GET.
function validarSensor(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados do sensor em JSON.");
  }

  const campos = {};

  const erroCodigo = validarTexto(corpo.codigo, 1, 45);
  if (erroCodigo) campos.codigo = `codigo ${erroCodigo}`;

  const erroTipo = validarTexto(corpo.tipo, 1, 45);
  if (erroTipo) campos.tipo = `tipo ${erroTipo}`;

  const { localizacao } = corpo;
  if (localizacao !== undefined && localizacao !== null) {
    if (typeof localizacao !== "string") campos.localizacao = "localizacao deve ser um texto.";
    else if (localizacao.trim().length > 150) campos.localizacao = "localizacao deve ter no máximo 150 caracteres.";
  }

  const erroData = validarDataInstalacao(corpo.dataInstalacao);
  if (erroData) campos.dataInstalacao = erroData;

  const { loteId } = corpo;
  if (loteId === undefined || loteId === null || loteId === "") campos.loteId = "loteId é obrigatório.";
  // Exige numero de verdade: "1" (texto) e recusado, como area/latitude em Propriedades.
  else if (typeof loteId !== "number" || !Number.isInteger(loteId) || loteId < 1 || loteId > MAIOR_ID) {
    campos.loteId = "loteId deve ser um número inteiro positivo.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  // Localizacao vazia (ou so espacos) vira null, para nao gravar texto vazio.
  const localizacaoLimpa = typeof localizacao === "string" ? localizacao.trim() : "";

  return {
    codigo: corpo.codigo.trim(),
    tipo: corpo.tipo.trim(),
    localizacao: localizacaoLimpa || null,
    // Meia-noite UTC: o Postgres guarda so a data (@db.Date), sem deslocar o dia.
    dataInstalacao: new Date(`${corpo.dataInstalacao}T00:00:00.000Z`),
    loteId,
  };
}

// ---------- POST /sensores/config ----------

// Corpo estrito: devolve so sensorId, channelId e readApiKey; o resto e ignorado.
// Sem trim: espaco no canal ou na chave e erro de digitacao, e "consertar" esconderia isso.
// channelId e texto (como no banco) e so digitos: ele entra no caminho da URL do ThingSpeak.
// As mensagens nunca repetem o valor recebido: a chave e segredo.
function validarConfigThingSpeak(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados da configuração em JSON.");
  }

  const { sensorId, channelId, readApiKey } = corpo;
  const campos = {};

  if (sensorId === undefined || sensorId === null) campos.sensorId = "sensorId é obrigatório.";
  // Numero de verdade: "1" (texto) e recusado, como loteId.
  else if (typeof sensorId !== "number" || !Number.isInteger(sensorId) || sensorId < 1 || sensorId > MAIOR_ID) {
    campos.sensorId = "sensorId deve ser um número inteiro positivo.";
  }

  if (channelId === undefined || channelId === null) campos.channelId = "channelId é obrigatório.";
  else if (typeof channelId !== "string" || !/^\d{1,20}$/.test(channelId)) {
    campos.channelId = "channelId deve ser um texto com 1 a 20 dígitos (só números, sem espaços).";
  }

  if (readApiKey === undefined || readApiKey === null) campos.readApiKey = "readApiKey é obrigatória.";
  else if (typeof readApiKey !== "string" || !/^[A-Za-z0-9]{1,64}$/.test(readApiKey)) {
    campos.readApiKey = "readApiKey deve ter de 1 a 64 letras ou números (sem espaços).";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  return { sensorId, channelId, readApiKey };
}

module.exports = { validarSensor, validarId, validarConfigThingSpeak };
