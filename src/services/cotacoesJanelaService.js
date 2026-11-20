const prisma = require("../config/prisma");

const {
  ErroHttp,
} = require("../middlewares/erros");

const {
  filtroLote,
} = require("./escopoDono");

async function resolverCotacoes(
  corpo,
  loteId,
  usuario,
  agora = new Date()
) {
  const internaId =
    corpo?.cotacaoInternaId;

  const externaId =
    corpo?.cotacaoExportacaoId;

  if (
    internaId === undefined &&
    externaId === undefined
  ) {
    return corpo;
  }

  const idsValidos = [
    internaId,
    externaId,
  ].every(
    (id) =>
      Number.isInteger(id) &&
      id > 0 &&
      id <= 2147483647
  );

  if (
    !idsValidos ||
    internaId === externaId
  ) {
    throw new ErroHttp(
      400,
      "Informe dois IDs distintos: cotacaoInternaId e cotacaoExportacaoId."
    );
  }

  const derivados = [
    "precoInternoKg",
    "precoExportacaoKg",
    "moeda",
    "fonteCotacao",
    "dataHoraCotacao",
  ];

  if (
    derivados.some(
      (campo) =>
        corpo[campo] !== undefined
    )
  ) {
    throw new ErroHttp(
      400,
      "Use IDs de cotações ou valores de cotação diretos, sem misturar as duas formas."
    );
  }

  const lote =
    await prisma.lote.findFirst({
      where: {
        id: loteId,
        status: "ATIVO",

        AND: [
          filtroLote(usuario),

          {
            propriedade: {
              status: "ATIVO",
            },
          },
        ],
      },

      select: {
        culturaId: true,
      },
    });

  if (!lote) {
    throw new ErroHttp(
      404,
      "Lote não encontrado."
    );
  }

  const cotacoes =
    await prisma.cotacaoMercado.findMany({
      where: {
        id: {
          in: [
            internaId,
            externaId,
          ],
        },

        status: "ATIVO",
      },

      select: {
        id: true,
        culturaId: true,
        mercadoDestino: true,
        moeda: true,
        unidade: true,
        precoMedio: true,
        dataReferencia: true,
      },
    });

  const interna = cotacoes.find(
    (cotacao) =>
      cotacao.id === internaId
  );

  const externa = cotacoes.find(
    (cotacao) =>
      cotacao.id === externaId
  );

  if (!interna || !externa) {
    throw new ErroHttp(
      404,
      "Cotação não encontrada ou inativa."
    );
  }

  if (
    interna.culturaId !== lote.culturaId ||
    externa.culturaId !== lote.culturaId
  ) {
    throw new ErroHttp(
      422,
      "As duas cotações precisam corresponder à cultura e variedade cadastradas no lote."
    );
  }

  if (
    interna.mercadoDestino !== "INTERNO" ||
    externa.mercadoDestino !== "EXPORTACAO"
  ) {
    throw new ErroHttp(
      422,
      "Os IDs precisam identificar mercado interno e exportação, nessa ordem."
    );
  }

  if (
    interna.moeda !== "BRL" ||
    externa.moeda !== "BRL"
  ) {
    throw new ErroHttp(
      422,
      "O motor atual usa BRL/kg. Não há conversão cambial automática; não compare BRL com USD ou EUR."
    );
  }

  if (
    interna.unidade !== "KG" ||
    externa.unidade !== "KG"
  ) {
    throw new ErroHttp(
      422,
      "O motor atual só compara preços por KG."
    );
  }

  const instantes = [
    interna,
    externa,
  ].map(
    (cotacao) =>
      +new Date(
        cotacao.dataReferencia
      )
  );

  const dataInvalida =
    instantes.some(
      (instante) =>
        !Number.isFinite(instante) ||
        instante > +agora ||
        +agora - instante >
          7 * 86400000
    );

  if (dataInvalida) {
    throw new ErroHttp(
      422,
      "As duas cotações precisam ter até sete dias e não podem estar no futuro."
    );
  }

  const precos = [
    interna,
    externa,
  ].map(
    (cotacao) =>
      Number(
        cotacao.precoMedio
      )
  );

  if (
    precos.some(
      (preco) =>
        !Number.isFinite(preco) ||
        preco <= 0
    )
  ) {
    throw new ErroHttp(
      422,
      "Cotação com preço inválido."
    );
  }

  return {
    ...corpo,

    precoInternoKg: precos[0],

    precoExportacaoKg: precos[1],

    moeda: "BRL",

    unidade: "KG",

    dataHoraCotacao: new Date(
      Math.min(...instantes)
    ).toISOString(),

    fonteCotacao:
      `CotacoesMercado ${internaId} e ${externaId}; ` +
      "referencias persistidas no cadastro de mercado.",
  };
}

module.exports = {
  resolverCotacoes,
};