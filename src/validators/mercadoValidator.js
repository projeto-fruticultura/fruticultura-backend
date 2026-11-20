const {
  ErroHttp,
} = require("../middlewares/erros");

const PRODUTOS_ACEITOS = [
  "UVA",
  "MANGA",
  "BANANA",
  "GOIABA",
  "MELAO",
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA",
  "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB",
  "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP",
  "SE", "TO",
];

function validarFiltrosPrecos(origem) {
  const dados = origem || {};
  const erros = {};

  const produto =
    typeof dados.produto === "string"
      ? dados.produto
          .trim()
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .toUpperCase()
      : null;

  const uf =
    typeof dados.uf === "string"
      ? dados.uf
          .trim()
          .toUpperCase()
      : null;

  if (
    !PRODUTOS_ACEITOS.includes(
      produto
    )
  ) {
    erros.produto =
      "Informe um produto: " +
      PRODUTOS_ACEITOS.join(", ") +
      ".";
  }

  if (!UFS.includes(uf)) {
    erros.uf =
      "UF inválida ou não informada.";
  }

  let ceasa = null;

  if (dados.ceasa !== undefined) {
    if (
      typeof dados.ceasa !== "string" ||
      !dados.ceasa.trim() ||
      dados.ceasa.trim().length > 150
    ) {
      erros.ceasa =
        "ceasa deve ser um texto de 1 a 150 caracteres.";
    } else {
      ceasa = dados.ceasa.trim();
    }
  }

  let limite = 10;

  if (dados.limite !== undefined) {
    if (
      typeof dados.limite !== "string" ||
      !/^\d+$/.test(dados.limite) ||
      Number(dados.limite) < 1 ||
      Number(dados.limite) > 100
    ) {
      erros.limite =
        "limite deve ser um inteiro de 1 a 100.";
    } else {
      limite = Number(
        dados.limite
      );
    }
  }

  if (
    Object.keys(erros).length > 0
  ) {
    throw new ErroHttp(
      400,
      "Filtro inválido.",
      erros
    );
  }

  return {
    produto,
    uf,
    ceasa,
    limite,
  };
}

module.exports = {
  validarFiltrosPrecos,
  PRODUTOS_ACEITOS,
  UFS,
};