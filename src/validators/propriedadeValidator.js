const { ErroHttp } = require("../middlewares/erros");

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// Limites das colunas: acima disso o Postgres recusaria e viraria erro 500.
const AREA_MAXIMA = 99999999.99; // Decimal(10, 2)
const MAIOR_ID = 2147483647; // Int do Postgres

function ehNumero(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

function validarTexto(valor, min, max) {
  if (valor === undefined || valor === null || valor === "") return "é obrigatório.";
  if (typeof valor !== "string") return "deve ser um texto.";
  const limpo = valor.trim();
  if (limpo.length < min || limpo.length > max) return `deve ter entre ${min} e ${max} caracteres.`;
  return null;
}

function validarFaixa(valor, min, max) {
  if (valor === undefined || valor === null || valor === "") return "é obrigatório.";
  if (!ehNumero(valor)) return "deve ser um número.";
  if (valor < min || valor > max) return `deve estar entre ${min} e ${max}.`;
  return null;
}

// Valida o corpo do POST/PUT e devolve so os campos permitidos.
// id, status, usuarioId e datas nunca vem do cliente.
function validarPropriedade(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados da propriedade em JSON.");
  }

  const campos = {};

  const erroNome = validarTexto(corpo.nome, 3, 255);
  if (erroNome) campos.nome = `nome ${erroNome}`;

  const { area } = corpo;
  if (area === undefined || area === null || area === "") campos.area = "area é obrigatória.";
  else if (!ehNumero(area)) campos.area = "area deve ser um número.";
  else if (area <= 0) campos.area = "area deve ser maior que zero.";
  else if (area > AREA_MAXIMA) campos.area = `area deve ser no máximo ${AREA_MAXIMA}.`;
  else if (!/^\d+(\.\d{1,2})?$/.test(String(area))) campos.area = "area deve ter no máximo 2 casas decimais.";

  const erroCidade = validarTexto(corpo.cidade, 2, 100);
  if (erroCidade) campos.cidade = `cidade ${erroCidade}`;

  const { uf } = corpo;
  if (uf === undefined || uf === null || uf === "") campos.uf = "uf é obrigatória.";
  else if (typeof uf !== "string" || !UFS.includes(uf.trim().toUpperCase())) {
    campos.uf = "uf deve ser a sigla de um estado brasileiro (ex.: PE, BA).";
  }

  // Latitude opcional: só valida se o cliente realmente enviou algum valor
  if (corpo.latitude !== undefined && corpo.latitude !== null && corpo.latitude !== "") {
    const erroLatitude = validarFaixa(corpo.latitude, -90, 90);
    if (erroLatitude) campos.latitude = `latitude ${erroLatitude}`;
  }

  // Longitude opcional: só valida se o cliente realmente enviou algum valor
  if (corpo.longitude !== undefined && corpo.longitude !== null && corpo.longitude !== "") {
    const erroLongitude = validarFaixa(corpo.longitude, -180, 180);
    if (erroLongitude) campos.longitude = `longitude ${erroLongitude}`;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  return {
    nome: corpo.nome.trim(),
    area,
    cidade: corpo.cidade.trim(),
    uf: uf.trim().toUpperCase(),
    latitude: corpo.latitude,
    longitude: corpo.longitude,
  };
}

function validarId(valor) {
  const id = Number(valor);
  if (!/^\d+$/.test(valor) || id < 1 || id > MAIOR_ID) {
    throw new ErroHttp(400, "id inválido: deve ser um número inteiro positivo.");
  }
  return id;
}

module.exports = { validarPropriedade, validarId, UFS };