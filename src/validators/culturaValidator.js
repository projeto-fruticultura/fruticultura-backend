const { ErroHttp } = require("../middlewares/erros");
// Mesma regra de :id de Propriedades; importado para nao manter duas copias.
const { validarId } = require("./propriedadeValidator");
// Mesma lista de UFs do GET /api/precos; importada para nao manter duas copias.
const { UFS } = require("./mercadoValidator");

// UF usada na cotacao quando a query nao traz ?uf=.
const UF_PADRAO = "PE";

function validarTextoObrigatorio(valor, min, max) {
  if (valor === undefined || valor === null || valor === "") return "é obrigatório.";
  if (typeof valor !== "string") return "deve ser um texto.";
  const limpo = valor.trim();
  if (limpo.length < min || limpo.length > max) return `deve ter entre ${min} e ${max} caracteres.`;
  return null;
}

function validarTextoOpcional(valor, max) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") return "deve ser um texto.";
  if (valor.trim().length > max) return `deve ter no máximo ${max} caracteres.`;
  return null;
}

// Texto vazio (ou so espacos) vira null, para nao gravar texto vazio.
function textoOuNull(valor) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

// Numero de verdade (texto "23" e recusado, como em Propriedades), na faixa e com ate 2 casas,
// que e o que cabe no Decimal(5, 2) do schema.
function validarDecimal(valor, min, max) {
  if (valor === undefined || valor === null || valor === "") return "é obrigatório.";
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "deve ser um número.";
  if (valor < min || valor > max) return `deve estar entre ${min} e ${max}.`;
  // Nessa faixa, String() so usa notacao cientifica para valores minusculos (ex.: 1e-7),
  // que tambem devem ser recusados.
  if (!/^-?\d+(\.\d{1,2})?$/.test(String(valor))) return "deve ter no máximo 2 casas decimais.";
  return null;
}

// Valida uma faixa minimo/maximo; so compara se os dois ja passaram na validacao individual.
function validarFaixa(corpo, campos, campoMin, campoMax, min, max) {
  const erroMin = validarDecimal(corpo[campoMin], min, max);
  if (erroMin) campos[campoMin] = `${campoMin} ${erroMin}`;
  const erroMax = validarDecimal(corpo[campoMax], min, max);
  if (erroMax) campos[campoMax] = `${campoMax} ${erroMax}`;
  if (!erroMin && !erroMax && corpo[campoMin] > corpo[campoMax]) {
    campos[campoMin] = `${campoMin} não pode ser maior que ${campoMax}.`;
  }
}

// Valida o corpo do POST/PUT e devolve so os campos permitidos.
// id e relacoes (ex.: lotes) nunca vem do cliente.
function validarCultura(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados da cultura em JSON.");
  }

  const campos = {};

  const erroNome = validarTextoObrigatorio(corpo.nome, 2, 100);
  if (erroNome) campos.nome = `nome ${erroNome}`;

  const erroVariedade = validarTextoOpcional(corpo.variedade, 100);
  if (erroVariedade) campos.variedade = `variedade ${erroVariedade}`;

  const erroDescricao = validarTextoOpcional(corpo.descricao, 1000);
  if (erroDescricao) campos.descricao = `descricao ${erroDescricao}`;

  validarFaixa(corpo, campos, "temperaturaMin", "temperaturaMax", -50, 60);
  validarFaixa(corpo, campos, "umidadeMin", "umidadeMax", 0, 100);

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  return {
    nome: corpo.nome.trim(),
    variedade: textoOuNull(corpo.variedade),
    descricao: textoOuNull(corpo.descricao),
    temperaturaMin: corpo.temperaturaMin,
    temperaturaMax: corpo.temperaturaMax,
    umidadeMin: corpo.umidadeMin,
    umidadeMax: corpo.umidadeMax,
  };
}

// A query string sempre chega como texto, entao aqui converter para numero e correto.
// O formato e conferido antes: Number() aceitaria "0x10" ou "1e2".
function converterCoordenada(valor, nome, min, max) {
  if (valor === undefined || valor === "") return { erro: `${nome} é obrigatória.` };
  if (typeof valor !== "string" || !/^-?\d+(\.\d+)?$/.test(valor.trim())) {
    return { erro: `${nome} deve ser um número.` };
  }
  const numero = Number(valor.trim());
  if (numero < min || numero > max) return { erro: `${nome} deve estar entre ${min} e ${max}.` };
  return { numero };
}

function validarCoordenadas(query) {
  const lat = converterCoordenada(query.lat, "lat", -90, 90);
  const lon = converterCoordenada(query.lon, "lon", -180, 180);

  const campos = {};
  if (lat.erro) campos.lat = lat.erro;
  if (lon.erro) campos.lon = lon.erro;
  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Coordenadas inválidas.", campos);
  }

  return { latitude: lat.numero, longitude: lon.numero };
}

// ?uf= e opcional (sem ele, usa PE). Com ele, vale a mesma regra do GET /api/precos: sigla de um estado,
// sem diferenca de maiuscula. Vazio, numero ou lista repetida (?uf=BA&uf=PE, que chega como array) dao 400.
function validarUf(query) {
  const bruto = query.uf;
  if (bruto === undefined) return UF_PADRAO;
  const uf = typeof bruto === "string" ? bruto.trim().toUpperCase() : "";
  if (!UFS.includes(uf)) {
    throw new ErroHttp(400, "UF inválida.", { uf: "uf deve ser a sigla de um estado, como PE ou BA." });
  }
  return uf;
}

module.exports = { validarCultura, validarCoordenadas, validarUf, validarId };
