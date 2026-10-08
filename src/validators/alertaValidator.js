const { ErroHttp } = require("../middlewares/erros");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_INT = 2147483647;

// A query chega sempre como texto, entao conferimos o formato antes de converter
// (Number() aceitaria "0x10" ou "1e2"). Lista repetida (?a=1&a=2) chega como array
// e nao e string, entao tambem cai como invalida.
function lerInteiro(valor) {
  if (typeof valor !== "string" || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return numero >= 1 && numero <= MAIOR_INT ? numero : null;
}

// Valida a query de GET /alertas. Os dois filtros sao opcionais. Campos de dono (usuarioId, dono...)
// nao existem aqui: o que nao for reconhecido e ignorado, e o dono vem sempre do token.
function validarFiltrosAlerta(query) {
  const q = query || {};
  const campos = {};
  const filtros = {};

  for (const nome of ["propriedadeId", "loteId"]) {
    if (q[nome] === undefined) continue;
    const numero = lerInteiro(q[nome]);
    if (numero === null) campos[nome] = `${nome} deve ser um número inteiro positivo.`;
    else filtros[nome] = numero;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Filtro inválido.", campos);
  }
  return filtros;
}

module.exports = { validarFiltrosAlerta };
