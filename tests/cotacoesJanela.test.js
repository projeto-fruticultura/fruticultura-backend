jest.mock("../src/config/prisma", () => ({
  lote: {
    findFirst: jest.fn(),
  },

  cotacaoMercado: {
    findMany: jest.fn(),
  },
}));

const prisma =
  require("../src/config/prisma");

const {
  resolverCotacoes,
} = require("../src/services/cotacoesJanelaService");

const agora =
  new Date(
    "2026-11-20T12:00:00Z"
  );

const usuario = {
  id: 6,
  perfil: "PRODUTOR",
};

const pedido = {
  cotacaoInternaId: 1,
  cotacaoExportacaoId: 2,
  custoInternoKg: 1,
  custoExportacaoKg: 3,
};

let cotacoes;

beforeEach(() => {
  jest.resetAllMocks();

  prisma.lote.findFirst.mockResolvedValue({
    culturaId: 3,
  });

  cotacoes = [
    {
      id: 1,
      culturaId: 3,
      mercadoDestino: "INTERNO",
      moeda: "BRL",
      unidade: "KG",
      precoMedio: "5.00",

      dataReferencia: new Date(
        "2026-11-18T00:00:00Z"
      ),
    },

    {
      id: 2,
      culturaId: 3,
      mercadoDestino: "EXPORTACAO",
      moeda: "BRL",
      unidade: "KG",
      precoMedio: "9.00",

      dataReferencia: new Date(
        "2026-11-19T00:00:00Z"
      ),
    },
  ];

  prisma.cotacaoMercado.findMany.mockImplementation(
    async () => cotacoes
  );
});

test(
  "contrato antigo não consulta cotação por ID",
  async () => {
    const antigo = {
      precoInternoKg: 5,
      precoExportacaoKg: 9,
    };

    expect(
      await resolverCotacoes(
        antigo,
        19,
        usuario,
        agora
      )
    ).toBe(antigo);

    expect(
      prisma.cotacaoMercado.findMany
    ).not.toHaveBeenCalled();
  }
);

test(
  "busca preços BRL da cultura do lote e preserva custos",
  async () => {
    const resultado =
      await resolverCotacoes(
        pedido,
        19,
        usuario,
        agora
      );

    expect(resultado).toMatchObject({
      precoInternoKg: 5,
      precoExportacaoKg: 9,
      custoInternoKg: 1,
      custoExportacaoKg: 3,
      moeda: "BRL",
      unidade: "KG",

      dataHoraCotacao:
        "2026-11-18T00:00:00.000Z",
    });

    expect(
      resultado.fonteCotacao
    ).toContain(
      "1 e 2"
    );

    const consulta =
      prisma.lote.findFirst
        .mock.calls[0][0];

    expect(
      consulta.where.AND[0]
    ).toEqual({
      propriedade: {
        usuarioId: 6,
      },
    });
  }
);

test(
  "lote fora do escopo bloqueia consulta dos preços",
  async () => {
    prisma.lote.findFirst.mockResolvedValue(
      null
    );

    await expect(
      resolverCotacoes(
        pedido,
        19,
        usuario,
        agora
      )
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(
      prisma.cotacaoMercado.findMany
    ).not.toHaveBeenCalled();
  }
);

test.each([
  "moeda",
  "culturaId",
  "mercadoDestino",
  "dataReferencia",
])(
  "cotação incompatível: %s",
  async (campo) => {
    cotacoes[1][campo] = {
      moeda: "USD",
      culturaId: 99,
      mercadoDestino: "INTERNO",

      dataReferencia: new Date(
        "2026-11-01T00:00:00Z"
      ),
    }[campo];

    await expect(
      resolverCotacoes(
        pedido,
        19,
        usuario,
        agora
      )
    ).rejects.toMatchObject({
      status: 422,
    });
  }
);

test(
  "IDs não podem ser misturados com preços diretos",
  async () => {
    await expect(
      resolverCotacoes(
        {
          ...pedido,
          precoInternoKg: 99,
        },
        19,
        usuario,
        agora
      )
    ).rejects.toMatchObject({
      status: 400,
    });
  }
);

test(
  "cotação ausente ou inativa retorna 404",
  async () => {
    cotacoes.pop();

    await expect(
      resolverCotacoes(
        pedido,
        19,
        usuario,
        agora
      )
    ).rejects.toMatchObject({
      status: 404,
    });
  }
);