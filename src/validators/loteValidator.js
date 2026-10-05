const { ErroHttp } = require("../middlewares/erros");
// Mesma regra de :id de Propriedades; importado para nao manter duas copias.
const { validarId } = require("./propriedadeValidator");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_ID = 2147483647;

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

module.exports = { validarFiltrosLote, validarId };
