const fs = require("node:fs");
const path = require("node:path");

const CAMINHO_CSV = path.resolve(
  __dirname,
  "../../ml/produtividade/valesafra_previsoes_produtividade_2026.csv"
);

function listarPrevisoes() {
  const conteudo = fs.readFileSync(CAMINHO_CSV, "utf8");
  const linhas = conteudo.trim().split(/\r?\n/);

  const cabecalhoEsperado =
    "municipio,produto,ano_previsao,produtividade_prevista_t_ha,metodo";

  if (linhas.shift()?.replace(/^\uFEFF/, "") !== cabecalhoEsperado) {
    throw new Error("Formato do CSV de produtividade inválido.");
  }

  return linhas.map((linha) => {
    const campos = linha.split(",");

    if (campos.length !== 5) {
      throw new Error("Registro inválido no CSV de produtividade.");
    }

    const [
      municipio,
      produto,
      ano,
      produtividade,
      metodo,
    ] = campos;

    const anoNumerico = Number(ano);
    const produtividadeNumerica = Number(produtividade);

    if (
      !municipio ||
      !produto ||
      !metodo ||
      !Number.isInteger(anoNumerico) ||
      !Number.isFinite(produtividadeNumerica) ||
      produtividadeNumerica < 0
    ) {
      throw new Error("Valores inválidos no CSV de produtividade.");
    }

    return {
      municipio,
      produto,
      anoPrevisao: anoNumerico,
      produtividadePrevistaTHa: produtividadeNumerica,
      metodo,
      status: "EXPERIMENTAL",
    };
  });
}

function consultarPrevisao(municipio, produto, ano) {
  const previsoes = listarPrevisoes();

  const normalizar = (texto) =>
    String(texto).trim().toLocaleLowerCase("pt-BR");

  return previsoes.find(
    (previsao) =>
      normalizar(previsao.municipio) === normalizar(municipio) &&
      normalizar(previsao.produto) === normalizar(produto) &&
      previsao.anoPrevisao === ano
  ) || null;
}

module.exports = {
  listarPrevisoes,
  consultarPrevisao,
};