const { ErroHttp } = require("../middlewares/erros");
// Mesma validacao de inteiro e de data-hora do GET /leituras; importadas para nao manter duas copias.
const { lerInteiro, lerData } = require("./leituraValidator");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_INT = 2147483647;

const UMA_HORA_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * UMA_HORA_MS;

// Agrupar so aceita "hora" ou "dia". O texto que vai para o SQL (date_trunc) sai desta lista fechada,
// nunca do que a pessoa digitou.
const AGRUPAMENTOS = {
  hora: { unidade: "hour", janelaPadraoMs: UM_DIA_MS, maximoMs: 7 * UM_DIA_MS, maximoTexto: "7 dias" },
  dia: { unidade: "day", janelaPadraoMs: 7 * UM_DIA_MS, maximoMs: 90 * UM_DIA_MS, maximoTexto: "90 dias" },
};

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

// Data sem hora (AAAA-MM-DD) e o DIA EM RECIFE (UTC-3, sem horario de verao), e nao o dia em UTC como no
// GET /leituras. Motivo: o grafico agrupa por dia de Recife; se o filtro usasse o dia UTC, "08/10" no filtro
// e "08/10" no grafico cobririam horas diferentes (3 horas de diferenca).
// Inicio: 00:00:00.000 -03:00 = 03:00Z. Fim: 23:59:59.999 -03:00 = 02:59:59.999Z do dia seguinte.
function lerDiaRecife(texto, fimDoDia) {
  const partes = SO_DATA.exec(texto);
  if (!partes) return null;
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  // Date.UTC "pula" 2026-02-30 para marco; comparar as partes pega isso.
  const conferencia = new Date(Date.UTC(ano, mes - 1, dia));
  if (conferencia.getUTCFullYear() !== ano || conferencia.getUTCMonth() !== mes - 1 || conferencia.getUTCDate() !== dia) {
    return null;
  }
  return fimDoDia
    ? new Date(Date.UTC(ano, mes - 1, dia + 1, 2, 59, 59, 999))
    : new Date(Date.UTC(ano, mes - 1, dia, 3, 0, 0, 0));
}

// Sem hora: dia em Recife. Com hora (ISO em UTC): vale o instante exato, como no GET /leituras
// (o lerData recusa fuso com "+hh:mm").
function lerLimite(valor, fimDoDia) {
  if (typeof valor === "string" && SO_DATA.test(valor)) return lerDiaRecife(valor, fimDoDia);
  return lerData(valor, fimDoDia);
}

function lerIds(query, campos) {
  const filtros = {};
  for (const nome of ["propriedadeId", "loteId", "culturaId", "sensorId"]) {
    if (query[nome] === undefined) continue;
    const numero = lerInteiro(query[nome], 1, MAIOR_INT);
    if (numero === null) campos[nome] = `${nome} deve ser um número inteiro positivo.`;
    else filtros[nome] = numero;
  }
  return filtros;
}

// GET /dashboard/resumo: mostra o "agora", entao so os quatro filtros de id valem.
// Qualquer outro parametro (inclusive de e ate) e ignorado.
function validarFiltrosResumo(query) {
  const campos = {};
  const filtros = lerIds(query || {}, campos);

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Filtro inválido.", campos);
  }
  return filtros;
}

// GET /dashboard/medias: ids + agrupar + periodo (de, ate).
function validarFiltrosMedias(query) {
  const q = query || {};
  const campos = {};
  const filtros = lerIds(q, campos);

  let agrupar = "hora";
  if (q.agrupar !== undefined) {
    if (typeof q.agrupar === "string" && Object.hasOwn(AGRUPAMENTOS, q.agrupar)) agrupar = q.agrupar;
    else campos.agrupar = 'agrupar deve ser "hora" ou "dia".';
  }
  const regra = AGRUPAMENTOS[agrupar];

  const mensagemData = (nome) =>
    `${nome} deve ser uma data (AAAA-MM-DD, dia em Recife) ou data-hora ISO 8601 em UTC (ex.: 2026-10-08T12:00:00Z).`;
  let de;
  let ate;
  if (q.de !== undefined) {
    de = lerLimite(q.de, false);
    if (de === null) campos.de = mensagemData("de");
  }
  if (q.ate !== undefined) {
    ate = lerLimite(q.ate, true);
    if (ate === null) campos.ate = mensagemData("ate");
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Filtro inválido.", campos);
  }

  // Janela padrao: sem de e sem ate -> ultimas 24 h (hora) ou 7 dias (dia). So de -> ate agora.
  // So ate -> de = ate menos a janela padrao.
  if (!ate) ate = new Date();
  if (!de) de = new Date(ate.getTime() - regra.janelaPadraoMs);

  if (de > ate) {
    throw new ErroHttp(400, "Filtro inválido.", { de: "de não pode ser maior que ate." });
  }
  // Limite de periodo, para uma consulta nao varrer a tabela inteira. Exatamente o maximo ainda vale.
  if (ate.getTime() - de.getTime() > regra.maximoMs) {
    throw new ErroHttp(400, "Período muito grande.", {
      periodo: `Com agrupar=${agrupar}, o período máximo é de ${regra.maximoTexto}.`,
    });
  }

  return { agrupar, unidade: regra.unidade, ...filtros, de, ate };
}

module.exports = { validarFiltrosResumo, validarFiltrosMedias };
