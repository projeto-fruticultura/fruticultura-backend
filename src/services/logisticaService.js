const prisma = require("../config/prisma");

const {
  ErroHttp,
} = require("../middlewares/erros");

const {
  filtroPropriedade,
  filtroRotaLogistica,
} = require("./escopoDono");

const MAIOR_INT = 2147483647;

const ERRO_NAO_ENCONTRADO =
  "Rota logística não encontrada.";

const SELECAO = {
  id: true,
  propriedadeId: true,
  origem: true,
  destino: true,
  modal: true,
  tempoEstimadoHoras: true,
  custo: true,
  transportadora: true,
  situacao: true,
  exigeRefrigeracaoRapida: true,
  colhidoEm: true,
  resfriadoEm: true,
  temperaturaResfriamentoC: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
};

function escopo(usuario) {
  return [
    {
      status: "ATIVO",
    },

    {
      propriedade: {
        status: "ATIVO",
      },
    },

    filtroRotaLogistica(usuario),
  ];
}

function formatar(rota) {
  const exige =
    rota.exigeRefrigeracaoRapida ?? null;

  return {
    ...rota,

    exigeRefrigeracaoRapida: exige,

    refrigeracao: {
      origem:
        exige === null
          ? "NAO_INFORMADO"
          : "DECLARACAO_OPERADOR",

      prazoReferenciaHoras:
        exige === true
          ? 6
          : null,

      comparadorPrazo:
        exige === true
          ? "MENOR_QUE"
          : null,

      temperaturaCargaVerificada: false,
    },

    tempoEstimadoHoras: Number(
      rota.tempoEstimadoHoras
    ),

    custo: Number(
      rota.custo
    ),
  };
}

function arredondar(valor, casas) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  const fator = 10 ** casas;

  return (
    Math.round(
      Number(valor) * fator
    ) / fator
  );
}

async function garantirPropriedade(
  propriedadeId,
  usuario
) {
  const propriedade =
    await prisma.propriedade.findFirst({
      where: {
        id: propriedadeId,

        AND: [
          filtroPropriedade(usuario),
        ],
      },

      select: {
        status: true,
      },
    });

  const erro = {
    propriedadeId:
      "propriedade não encontrada.",
  };

  if (!propriedade) {
    throw new ErroHttp(
      404,
      "Propriedade não encontrada.",
      erro
    );
  }

  if (propriedade.status !== "ATIVO") {
    throw new ErroHttp(
      400,
      "Propriedade não encontrada.",
      erro
    );
  }
}

async function listar(
  usuario,
  {
    propriedadeId,
    modal,
    situacao,
    pagina = 1,
    limite = 20,
  } = {}
) {
  const filtros = [];

  if (propriedadeId) {
    filtros.push({
      propriedadeId,
    });
  }

  if (modal) {
    filtros.push({
      modal,
    });
  }

  if (situacao) {
    filtros.push({
      situacao,
    });
  }

  const where = {
    AND: [
      ...escopo(usuario),
      ...filtros,
    ],
  };

  const skip = Math.min(
    (pagina - 1) * limite,
    MAIOR_INT
  );

  const [rotas, total] =
    await prisma.$transaction([
      prisma.rotaLogistica.findMany({
        where,

        orderBy: {
          id: "asc",
        },

        skip,
        take: limite,
        select: SELECAO,
      }),

      prisma.rotaLogistica.count({
        where,
      }),
    ]);

  return {
    dados: rotas.map(
      formatar
    ),

    paginacao: {
      pagina,
      limite,
      total,

      totalPaginas: Math.ceil(
        total / limite
      ),
    },
  };
}

async function buscarPorId(
  id,
  usuario
) {
  const rota =
    await prisma.rotaLogistica.findFirst({
      where: {
        id,
        AND: escopo(usuario),
      },

      select: SELECAO,
    });

  if (!rota) {
    throw new ErroHttp(
      404,
      ERRO_NAO_ENCONTRADO
    );
  }

  return formatar(rota);
}

async function criar(
  dados,
  usuario
) {
  await garantirPropriedade(
    dados.propriedadeId,
    usuario
  );

  const rota =
    await prisma.rotaLogistica.create({
      data: dados,
      select: SELECAO,
    });

  return formatar(rota);
}

async function atualizar(
  id,
  dados,
  usuario
) {
  const filtro = {
    id,
    AND: escopo(usuario),
  };

  const existe =
    await prisma.rotaLogistica.findFirst({
      where: filtro,

      select: {
        id: true,
      },
    });

  if (!existe) {
    throw new ErroHttp(
      404,
      ERRO_NAO_ENCONTRADO
    );
  }

  if (
    Object.keys(dados).length > 0
  ) {
    const { count } =
      await prisma.rotaLogistica.updateMany({
        where: filtro,
        data: dados,
      });

    if (count === 0) {
      throw new ErroHttp(
        404,
        ERRO_NAO_ENCONTRADO
      );
    }
  }

  return buscarPorId(
    id,
    usuario
  );
}

async function remover(
  id,
  usuario
) {
  const { count } =
    await prisma.rotaLogistica.updateMany({
      where: {
        id,
        AND: escopo(usuario),
      },

      data: {
        status: "INATIVO",
      },
    });

  if (count === 0) {
    throw new ErroHttp(
      404,
      ERRO_NAO_ENCONTRADO
    );
  }
}

async function compararPropriedades(
  ids,
  usuario
) {
  const propriedades =
    await prisma.propriedade.findMany({
      where: {
        id: {
          in: ids,
        },

        status: "ATIVO",

        AND: [
          filtroPropriedade(usuario),
        ],
      },

      select: {
        id: true,
        nome: true,
        cidade: true,
        uf: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  if (
    propriedades.length !== ids.length
  ) {
    throw new ErroHttp(
      404,
      "Uma ou mais propriedades não foram encontradas."
    );
  }

  const where = {
    propriedadeId: {
      in: ids,
    },

    status: "ATIVO",

    propriedade: {
      status: "ATIVO",

      AND: [
        filtroPropriedade(usuario),
      ],
    },
  };

  const [
    agregados,
    porSituacao,
    porModal,
  ] = await Promise.all([
    prisma.rotaLogistica.groupBy({
      by: [
        "propriedadeId",
      ],

      where,

      _count: {
        _all: true,
      },

      _sum: {
        custo: true,
      },

      _avg: {
        custo: true,
        tempoEstimadoHoras: true,
      },

      _min: {
        custo: true,
        tempoEstimadoHoras: true,
      },

      _max: {
        custo: true,
        tempoEstimadoHoras: true,
      },
    }),

    prisma.rotaLogistica.groupBy({
      by: [
        "propriedadeId",
        "situacao",
      ],

      where,

      _count: {
        _all: true,
      },
    }),

    prisma.rotaLogistica.groupBy({
      by: [
        "propriedadeId",
        "modal",
      ],

      where,

      _count: {
        _all: true,
      },
    }),
  ]);

  const mapaAgregados = new Map(
    agregados.map(
      (item) => [
        item.propriedadeId,
        item,
      ]
    )
  );

  const mapaSituacoes = new Map();
  const mapaModais = new Map();

  for (const item of porSituacao) {
    if (
      !mapaSituacoes.has(
        item.propriedadeId
      )
    ) {
      mapaSituacoes.set(
        item.propriedadeId,
        {}
      );
    }

    mapaSituacoes.get(
      item.propriedadeId
    )[item.situacao] =
      item._count._all;
  }

  for (const item of porModal) {
    if (
      !mapaModais.has(
        item.propriedadeId
      )
    ) {
      mapaModais.set(
        item.propriedadeId,
        {}
      );
    }

    mapaModais.get(
      item.propriedadeId
    )[item.modal] =
      item._count._all;
  }

  return {
    propriedadesComparadas:
      ids.length,

    calculadoEm:
      new Date().toISOString(),

    indicadores: propriedades.map(
      (propriedade) => {
        const agregado =
          mapaAgregados.get(
            propriedade.id
          );

        return {
          ...propriedade,

          rotasAtivas:
            agregado?._count?._all ?? 0,

          custoTotalRotas: arredondar(
            agregado?._sum?.custo ?? 0,
            2
          ),

          custoMedioRota: arredondar(
            agregado?._avg?.custo,
            2
          ),

          custoMinimoRota: arredondar(
            agregado?._min?.custo,
            2
          ),

          custoMaximoRota: arredondar(
            agregado?._max?.custo,
            2
          ),

          prazoMedioHoras: arredondar(
            agregado?._avg?.tempoEstimadoHoras,
            1
          ),

          prazoMinimoHoras: arredondar(
            agregado?._min?.tempoEstimadoHoras,
            1
          ),

          prazoMaximoHoras: arredondar(
            agregado?._max?.tempoEstimadoHoras,
            1
          ),

          rotasPorSituacao:
            mapaSituacoes.get(
              propriedade.id
            ) || {},

          rotasPorModal:
            mapaModais.get(
              propriedade.id
            ) || {},
        };
      }
    ),

    observacao:
      "Comparação descritiva das rotas ativas cadastradas. " +
      "Destinos e modais diferentes não representam " +
      "cotações diretamente equivalentes.",
  };
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
  compararPropriedades,
};