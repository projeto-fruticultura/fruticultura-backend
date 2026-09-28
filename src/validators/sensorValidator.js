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
// id e status nunca vem do cliente.
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

module.exports = { validarSensor, validarId };
