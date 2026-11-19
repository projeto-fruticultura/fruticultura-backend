const { ErroHttp } = require("../middlewares/erros");

const MAXIMO_PROPRIEDADES = 10;
const MAXIMO_ID = 2147483647;

function validarComparacaoLogistica(query) {
  const valor = query?.propriedadeIds;

  const partes =
    typeof valor === "string"
      ? valor.split(",")
      : [];

  if (
    partes.length < 2 ||
    partes.length > MAXIMO_PROPRIEDADES ||
    !partes.every((parte) => /^\d+$/.test(parte))
  ) {
    throw new ErroHttp(
      400,
      `Informe de 2 a ${MAXIMO_PROPRIEDADES} IDs separados por vírgula.`,
      {
        propriedadeIds:
          "Exemplo: ?propriedadeIds=1,2",
      }
    );
  }

  const ids = partes.map(Number);

  if (
    ids.some(
      (id) =>
        !Number.isInteger(id) ||
        id < 1 ||
        id > MAXIMO_ID
    ) ||
    new Set(ids).size !== ids.length
  ) {
    throw new ErroHttp(
      400,
      "Os IDs devem ser inteiros positivos, sem repetição.",
      {
        propriedadeIds:
          "Revise os IDs informados.",
      }
    );
  }

  return ids;
}

module.exports = {
  validarComparacaoLogistica,
  MAXIMO_PROPRIEDADES,
};