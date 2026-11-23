const produtividadeService = require("../services/produtividadeService");
const { ErroHttp } = require("../middlewares/erros");

function consultar(req, res) {
  const { municipio, produto, ano } = req.query;

  if (
    typeof municipio !== "string" ||
    !municipio.trim() ||
    typeof produto !== "string" ||
    !produto.trim() ||
    typeof ano !== "string" ||
    !/^\d{4}$/.test(ano)
  ) {
    throw new ErroHttp(
      400,
      "Informe municipio, produto e ano válido (AAAA)."
    );
  }

  const previsao = produtividadeService.consultarPrevisao(
    municipio,
    produto,
    Number(ano)
  );

  if (!previsao) {
    throw new ErroHttp(
      404,
      "Não existe previsão de produtividade para os parâmetros informados."
    );
  }

  res.status(200).json({
    ...previsao,
    unidade: "t/ha",
    aviso:
      "Estimativa experimental. A procedência e a consistência dos dados históricos ainda dependem de auditoria.",
  });
}

module.exports = {
  consultar,
};