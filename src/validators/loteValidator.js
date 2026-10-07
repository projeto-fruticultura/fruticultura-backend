const { ErroHttp } = require("../middlewares/erros");
// Mesma regra de :id de Propriedades; importado para nao manter duas copias.
const { validarId } = require("./propriedadeValidator");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_ID = 2147483647;
const AREA_MAXIMA = 99999999.99; // Decimal(10, 2)
const IDENTIFICACAO_MAXIMO = 100; // VarChar(100)
const SITUACAO_MAXIMO = 30; // VarChar(30)
const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------- GET /lotes ----------

// Valida a query de GET /lotes. O filtro propriedadeId e opcional; se vier, precisa ser
// um inteiro positivo. A query chega sempre como texto, entao conferimos o formato antes
// de converter (Number() aceitaria "0x10" ou "1e2"). Lista repetida (?a=1&a=2) chega como
// array e tambem e recusada.
function validarFiltrosLote(query) {
  const { propriedadeId } = query || {};
  const campos = {};
  let propriedadeIdNumero;

  if (propriedadeId !== undefined) {
    const valido =
      typeof propriedadeId === "string" &&
      /^\d+$/.test(propriedadeId) &&
      Number(propriedadeId) >= 1 &&
      Number(propriedadeId) <= MAIOR_ID;
    if (valido) propriedadeIdNumero = Number(propriedadeId);
    else campos.propriedadeId = "propriedadeId deve ser um número inteiro positivo.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Filtro inválido.", campos);
  }

  return { propriedadeId: propriedadeIdNumero };
}

// ---------- DELETE /lotes/:id?confirmar=true ----------

// Ausente = false. Qualquer valor diferente de "true" (inclusive "false", "1" ou vazio) e erro:
// confirmar e uma decisao explicita de inativar tambem os sensores.
function validarConfirmar(query) {
  const valor = query ? query.confirmar : undefined;
  if (valor === undefined) return false;
  if (valor === "true") return true;
  throw new ErroHttp(400, "Parâmetro inválido.", { confirmar: "confirmar deve ser true (ou ser omitido)." });
}

// ---------- POST e PUT ----------

// Aceita so "AAAA-MM-DD" de data real. new Date "pula" 2026-02-30 para marco, entao
// comparamos as partes. Meia-noite UTC: o Postgres guarda so a data (@db.Date), sem deslocar o dia.
function lerData(valor) {
  if (typeof valor !== "string") return null;
  const partes = FORMATO_DATA.exec(valor);
  if (!partes) return null;
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return data;
}

// Colheita antes do plantio e erro; datas iguais sao aceitas. Usada no POST e, no PUT,
// pelo service, que combina o que veio com o que ja esta salvo.
function lancarSeDatasInvertidas(dataPlantacao, colheitaEstimada) {
  if (dataPlantacao && colheitaEstimada && colheitaEstimada < dataPlantacao) {
    throw new ErroHttp(400, "Dados inválidos.", {
      colheitaEstimada: "colheitaEstimada não pode ser anterior a dataPlantacao.",
    });
  }
}

// Texto: sem espacos sobrando nas pontas, de 1 ate "maximo" caracteres.
function lerTexto(corpo, nome, maximo, campos, obrigatorio) {
  const valor = corpo[nome];
  if (valor === undefined) {
    if (obrigatorio) campos[nome] = `${nome} é obrigatório.`;
    return undefined;
  }
  if (valor === null) {
    campos[nome] = obrigatorio ? `${nome} é obrigatório.` : `${nome} não pode ser nulo.`;
    return undefined;
  }
  if (typeof valor !== "string") {
    campos[nome] = `${nome} deve ser um texto.`;
    return undefined;
  }
  const limpo = valor.trim();
  if (limpo.length < 1 || limpo.length > maximo) {
    campos[nome] = `${nome} deve ter entre 1 e ${maximo} caracteres.`;
    return undefined;
  }
  return limpo;
}

// Mesmas regras de area de Propriedade: numero de verdade (nao texto), maior que 0, ate 2 casas.
function lerArea(corpo, campos, obrigatorio) {
  const valor = corpo.area;
  if (valor === undefined) {
    if (obrigatorio) campos.area = "area é obrigatória.";
    return undefined;
  }
  if (valor === null) {
    campos.area = obrigatorio ? "area é obrigatória." : "area não pode ser nula.";
    return undefined;
  }
  if (typeof valor !== "number" || !Number.isFinite(valor)) campos.area = "area deve ser um número.";
  else if (valor <= 0) campos.area = "area deve ser maior que zero.";
  else if (valor > AREA_MAXIMA) campos.area = `area deve ser no máximo ${AREA_MAXIMA}.`;
  else if (!/^\d+(\.\d{1,2})?$/.test(String(valor))) campos.area = "area deve ter no máximo 2 casas decimais.";
  else return valor;
  return undefined;
}

function lerCampoData(corpo, nome, campos, { obrigatorio, aceitaNulo }) {
  const valor = corpo[nome];
  if (valor === undefined) {
    if (obrigatorio) campos[nome] = `${nome} é obrigatória.`;
    return undefined;
  }
  if (valor === null) {
    if (aceitaNulo) return null;
    campos[nome] = obrigatorio ? `${nome} é obrigatória.` : `${nome} não pode ser nula.`;
    return undefined;
  }
  const data = lerData(valor);
  if (data === null) {
    campos[nome] = `${nome} deve ser uma data real no formato AAAA-MM-DD.`;
    return undefined;
  }
  return data;
}

// Inteiro positivo de verdade (numero, nao texto), como loteId em Sensores.
function lerIdNumerico(corpo, nome, campos, obrigatorio) {
  const valor = corpo[nome];
  if (valor === undefined || valor === null) {
    if (obrigatorio) campos[nome] = `${nome} é obrigatório.`;
    else if (valor === null) campos[nome] = `${nome} não pode ser nulo.`;
    return undefined;
  }
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 1 || valor > MAIOR_ID) {
    campos[nome] = `${nome} deve ser um número inteiro positivo.`;
    return undefined;
  }
  return valor;
}

// Numero de verdade, na faixa, com ate 8 casas (o que cabe em Decimal(10,8) e Decimal(11,8)).
function erroCoordenada(nome, valor, minimo, maximo) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return `${nome} deve ser um número.`;
  if (valor < minimo || valor > maximo) return `${nome} deve estar entre ${minimo} e ${maximo}.`;
  if (!/^-?\d+(\.\d{1,8})?$/.test(String(valor))) return `${nome} deve ter no máximo 8 casas decimais.`;
  return null;
}

// Latitude e longitude andam juntas: as duas numeros, ou as duas null (limpa o ponto), ou nenhuma.
// Retorna undefined se nao foram enviadas; { latitude, longitude } se foram.
function lerCoordenadas(corpo, campos) {
  const { latitude, longitude } = corpo;
  const temLat = latitude !== undefined;
  const temLon = longitude !== undefined;
  if (!temLat && !temLon) return undefined;

  if (temLat !== temLon) {
    campos[temLat ? "longitude" : "latitude"] = "latitude e longitude devem ser enviadas juntas (ou nenhuma).";
    return undefined;
  }
  if (latitude === null && longitude === null) return { latitude: null, longitude: null };
  if (latitude === null || longitude === null) {
    campos[latitude === null ? "latitude" : "longitude"] = "latitude e longitude devem ser enviadas juntas (ou as duas nulas).";
    return undefined;
  }

  const erroLat = erroCoordenada("latitude", latitude, -90, 90);
  const erroLon = erroCoordenada("longitude", longitude, -180, 180);
  if (erroLat) campos.latitude = erroLat;
  if (erroLon) campos.longitude = erroLon;
  return erroLat || erroLon ? undefined : { latitude, longitude };
}

// Valida o corpo do POST (modo "criar") ou do PUT (modo "atualizar") e devolve so os campos permitidos.
// id, status e (no PUT) propriedadeId nunca vem do cliente: sao ignorados, como qualquer campo desconhecido.
// No PUT tudo e opcional: o que for omitido mantem o valor salvo.
function validarLote(corpo, modo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados do lote em JSON.");
  }
  const criar = modo === "criar";
  const campos = {};

  const dados = {
    identificacao: lerTexto(corpo, "identificacao", IDENTIFICACAO_MAXIMO, campos, criar),
    situacao: lerTexto(corpo, "situacao", SITUACAO_MAXIMO, campos, criar),
    area: lerArea(corpo, campos, criar),
    dataPlantacao: lerCampoData(corpo, "dataPlantacao", campos, { obrigatorio: criar, aceitaNulo: false }),
    // colheitaEstimada e a unica data opcional: null limpa (no PUT) ou significa "sem data" (no POST).
    colheitaEstimada: lerCampoData(corpo, "colheitaEstimada", campos, { obrigatorio: false, aceitaNulo: true }),
    culturaId: lerIdNumerico(corpo, "culturaId", campos, criar),
  };
  if (criar) dados.propriedadeId = lerIdNumerico(corpo, "propriedadeId", campos, true);

  const coordenadas = lerCoordenadas(corpo, campos);
  if (coordenadas) Object.assign(dados, coordenadas);

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  // Regra das datas dentro do proprio corpo; no PUT o service completa com o que esta salvo.
  lancarSeDatasInvertidas(dados.dataPlantacao, dados.colheitaEstimada);

  if (criar) {
    // No POST, o que nao veio vira null (e nao "undefined"), para o Prisma gravar nulo.
    return {
      ...dados,
      colheitaEstimada: dados.colheitaEstimada ?? null,
      latitude: dados.latitude ?? null,
      longitude: dados.longitude ?? null,
    };
  }
  // No PUT, remove o que nao veio: undefined nao pode virar "limpar o campo".
  return Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined));
}

module.exports = { validarFiltrosLote, validarConfirmar, validarLote, lancarSeDatasInvertidas, validarId };
