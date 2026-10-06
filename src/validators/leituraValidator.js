const { ErroHttp } = require("../middlewares/erros");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_INT = 2147483647;
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

// A query chega sempre como texto, entao conferimos o formato antes de converter
// (Number() aceitaria "0x10" ou "1e2"). Lista repetida (?a=1&a=2) chega como array
// e nao e string, entao tambem cai como invalida.
function lerInteiro(valor, minimo, maximo) {
  if (typeof valor !== "string" || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return numero >= minimo && numero <= maximo ? numero : null;
}

// Aceita "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM[:SS[.mmm]]", com "Z" opcional. Sempre UTC:
// nao aceitamos fuso com "+hh:mm", porque o "+" na URL vira espaco e geraria erro confuso.
const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_DATA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z?$/;

// Data sem hora: "de" vale desde 00:00:00.000 e "ate" vale ate 23:59:59.999 daquele dia,
// para "ate=2026-09-29" incluir o dia 29 inteiro. Os dois limites sao inclusivos.
function lerData(valor, fimDoDia) {
  if (typeof valor !== "string") return null;

  let partes = FORMATO_DATA.exec(valor);
  let hora = fimDoDia ? 23 : 0;
  let minuto = fimDoDia ? 59 : 0;
  let segundo = fimDoDia ? 59 : 0;
  let milissegundo = fimDoDia ? 999 : 0;

  if (!partes) {
    partes = FORMATO_DATA_HORA.exec(valor);
    if (!partes) return null;
    hora = Number(partes[4]);
    minuto = Number(partes[5]);
    segundo = Number(partes[6] || 0);
    milissegundo = partes[7] ? Number(partes[7].padEnd(3, "0")) : 0;
    if (hora > 23 || minuto > 59 || segundo > 59) return null;
  }

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, milissegundo));
  // new Date "pula" 2026-02-30 para marco; comparar as partes pega isso.
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return data;
}

// Valida a query de GET /leituras. Tudo e opcional. Campos de dono (usuarioId, dono...) nao
// existem aqui: o que nao for reconhecido e ignorado, e o dono vem sempre do token.
function validarFiltrosLeitura(query) {
  const q = query || {};
  const campos = {};
  const filtros = {};

  for (const nome of ["sensorId", "loteId", "propriedadeId"]) {
    if (q[nome] === undefined) continue;
    const numero = lerInteiro(q[nome], 1, MAIOR_INT);
    if (numero === null) campos[nome] = `${nome} deve ser um número inteiro positivo.`;
    else filtros[nome] = numero;
  }

  const mensagemData = (nome) => `${nome} deve ser uma data (AAAA-MM-DD) ou data-hora ISO 8601 em UTC (ex.: 2026-09-29T10:00:00Z).`;
  if (q.de !== undefined) {
    const data = lerData(q.de, false);
    if (data === null) campos.de = mensagemData("de");
    else filtros.de = data;
  }
  if (q.ate !== undefined) {
    const data = lerData(q.ate, true);
    if (data === null) campos.ate = mensagemData("ate");
    else filtros.ate = data;
  }
  if (filtros.de && filtros.ate && filtros.de > filtros.ate) {
    campos.de = "de não pode ser maior que ate.";
  }

  filtros.pagina = 1;
  if (q.pagina !== undefined) {
    const numero = lerInteiro(q.pagina, 1, MAIOR_INT);
    if (numero === null) campos.pagina = "pagina deve ser um número inteiro maior ou igual a 1.";
    else filtros.pagina = numero;
  }

  filtros.limite = LIMITE_PADRAO;
  if (q.limite !== undefined) {
    const numero = lerInteiro(q.limite, 1, LIMITE_MAXIMO);
    if (numero === null) campos.limite = `limite deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.`;
    else filtros.limite = numero;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Filtro inválido.", campos);
  }

  return filtros;
}

module.exports = { validarFiltrosLeitura };
