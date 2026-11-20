const prisma = require("../config/prisma");

const {
  ErroHttp,
} = require("../middlewares/erros");

const {
  validarCotacao,
  objeto,
  CAMPOS_DEMANDA,
} = require("../validators/cotacaoMercadoValidator");

const CAMPOS = [
  "culturaId",
  "mercadoDestino",
  "paisDestino",
  "precoMedio",
  "moeda",
  "dataReferencia",
  "fonteNome",
  "fonteReferencia",
  "demandaEstimadaKg",
  ...CAMPOS_DEMANDA,
];

const incluir = {
  cultura: {
    select: {
      id: true,
      nome: true,
      variedade: true,
    },
  },
};

function formatar(
  cotacao,
  agora = new Date()
) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);

  const referencia = new Date(
    cotacao.dataReferencia
  );

  const idadeDias = Math.floor(
    (hoje - referencia) / 86400000
  );

  return {
    ...cotacao,

    precoMedio: Number(
      cotacao.precoMedio
    ),

    unidade:
      cotacao.unidade ?? "KG",

    demandaEstimadaKg:
      cotacao.demandaEstimadaKg == null
        ? null
        : Number(
            cotacao.demandaEstimadaKg
          ),

    dataReferencia:
      referencia
        .toISOString()
        .slice(0, 10),

    demandaInicio:
      cotacao.demandaInicio
        ? new Date(
            cotacao.demandaInicio
          ).toISOString().slice(0, 10)
        : null,

    demandaFim:
      cotacao.demandaFim
        ? new Date(
            cotacao.demandaFim
          ).toISOString().slice(0, 10)
        : null,

    origemRegistro:
      "DECLARADO_POR_ADMIN",

    verificacaoAutomaticaDaFonte: false,

    idadeDias,

    desatualizada:
      +agora - +referencia >
      7 * 86400000,

    aviso:
      "Cotação e eventual estimativa declaradas com fonte. " +
      "Não há verificação automática de documentos, " +
      "previsão de demanda ou conversão cambial.",
  };
}

async function garantirCultura(culturaId) {
  const cultura =
    await prisma.cultura.findUnique({
      where: {
        id: culturaId,
      },

      select: {
        id: true,
      },
    });

  if (!cultura) {
    throw new ErroHttp(
      404,
      "Cultura não encontrada."
    );
  }
}

async function obter(id) {
  const cotacao =
    await prisma.cotacaoMercado.findFirst({
      where: {
        id,
        status: "ATIVO",
      },

      include: incluir,
    });

  if (!cotacao) {
    throw new ErroHttp(
      404,
      "Cotação não encontrada."
    );
  }

  return cotacao;
}

async function listar(filtros) {
  const where = {
    status: "ATIVO",
  };

  for (const nome of [
    "culturaId",
    "mercadoDestino",
    "paisDestino",
    "moeda",
  ]) {
    if (
      filtros[nome] !== undefined
    ) {
      where[nome] = filtros[nome];
    }
  }

  if (filtros.de || filtros.ate) {
    where.dataReferencia = {
      ...(filtros.de
        ? {
            gte: filtros.de,
          }
        : {}),

      ...(filtros.ate
        ? {
            lte: filtros.ate,
          }
        : {}),
    };
  }

  const [dados, total] =
    await prisma.$transaction([
      prisma.cotacaoMercado.findMany({
        where,
        include: incluir,

        orderBy: [
          {
            dataReferencia: "desc",
          },
          {
            id: "desc",
          },
        ],

        skip:
          (filtros.pagina - 1) *
          filtros.limite,

        take: filtros.limite,
      }),

      prisma.cotacaoMercado.count({
        where,
      }),
    ]);

  return {
    dados: dados.map(
      (cotacao) => formatar(cotacao)
    ),

    paginacao: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,

      totalPaginas: Math.ceil(
        total / filtros.limite
      ),
    },
  };
}

async function buscarPorId(id) {
  return formatar(
    await obter(id)
  );
}

async function criar(
  corpo,
  usuario
) {
  const dados =
    validarCotacao(corpo);

  await garantirCultura(
    dados.culturaId
  );

  const cotacao =
    await prisma.cotacaoMercado.create({
      data: {
        ...dados,
        criadoPorId: usuario.id,
      },

      include: incluir,
    });

  return formatar(cotacao);
}

async function atualizar(
  id,
  corpo
) {
  objeto(corpo);

  const atual = await obter(id);

  const base = Object.fromEntries(
    CAMPOS.map(
      (campo) => [
        campo,
        atual[campo],
      ]
    )
  );

  base.precoMedio = Number(
    base.precoMedio
  );

  base.demandaEstimadaKg =
    base.demandaEstimadaKg == null
      ? null
      : Number(
          base.demandaEstimadaKg
        );

  for (const campo of [
    "dataReferencia",
    "demandaInicio",
    "demandaFim",
  ]) {
    if (base[campo]) {
      base[campo] = new Date(
        base[campo]
      ).toISOString().slice(0, 10);
    }
  }

  const candidato = {
    ...base,
    ...corpo,
  };

  if (
    Object.hasOwn(
      corpo,
      "demandaEstimadaKg"
    ) &&
    corpo.demandaEstimadaKg === null
  ) {
    for (
      const campo
      of CAMPOS_DEMANDA
    ) {
      candidato[campo] = null;
    }
  }

  const dados =
    validarCotacao(candidato);

  await garantirCultura(
    dados.culturaId
  );

  const { count } =
    await prisma.cotacaoMercado.updateMany({
      where: {
        id,
        status: "ATIVO",
      },

      data: dados,
    });

  if (!count) {
    throw new ErroHttp(
      404,
      "Cotação não encontrada."
    );
  }

  return buscarPorId(id);
}

async function remover(id) {
  const { count } =
    await prisma.cotacaoMercado.updateMany({
      where: {
        id,
        status: "ATIVO",
      },

      data: {
        status: "INATIVO",
      },
    });

  if (!count) {
    throw new ErroHttp(
      404,
      "Cotação não encontrada."
    );
  }
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
};