jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },

  cultura: {
    findUnique: jest.fn(),
  },

  cotacaoMercado: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },

  $transaction: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");

const prisma =
  require("../src/config/prisma");

const {
  validarCotacao,
  validarFiltrosCotacoes,
} = require("../src/validators/cotacaoMercadoValidator");

const ROTA =
  "/api/mercado/cotacoes";

const agora = new Date(
  "2026-11-20T12:00:00Z"
);

function token() {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: "6",
    }
  );
}

const base = {
  culturaId: 3,
  mercadoDestino: "EXPORTACAO",
  paisDestino: "US",
  precoMedio: 2.3456,
  moeda: "USD",
  dataReferencia: "2026-11-18",
  fonteNome: "FIXTURE DE TESTE",

  fonteReferencia:
    "Documento simulado; não é cotação real",
};

const comDemanda = {
  ...base,

  demandaEstimadaKg: 1000,

  demandaInicio: "2026-12-01",

  demandaFim: "2026-12-31",

  fonteDemanda:
    "FIXTURE de previsão externa",

  metodoDemanda:
    "Estimativa fornecida por relatório simulado para este teste",
};

function registro(dados = base) {
  return {
    id: 99,

    ...validarCotacao(
      dados,
      agora
    ),

    criadoPorId: 6,

    status: "ATIVO",

    cultura: {
      id: 3,
      nome: "Uva",
      variedade: "Vitória",
    },
  };
}

function perfil(valor) {
  prisma.usuario.findUnique.mockResolvedValue({
    id: 6,
    perfil: valor,
    status: "ATIVO",
  });
}

beforeEach(() => {
  jest.resetAllMocks();

  perfil("ADMIN");

  prisma.cultura.findUnique.mockResolvedValue({
    id: 3,
  });

  prisma.cotacaoMercado.findFirst.mockResolvedValue(
    registro()
  );

  prisma.cotacaoMercado.findMany.mockResolvedValue([
    registro(),
  ]);

  prisma.cotacaoMercado.count.mockResolvedValue(
    1
  );

  prisma.cotacaoMercado.create.mockImplementation(
    async ({ data }) => ({
      id: 99,
      ...data,
    })
  );

  prisma.cotacaoMercado.updateMany.mockResolvedValue({
    count: 1,
  });

  prisma.$transaction.mockImplementation(
    async (itens) =>
      Promise.all(itens)
  );
});

test(
  "sem JWT não lê cotações",
  async () => {
    const resposta =
      await request(app).get(ROTA);

    expect(
      resposta.status
    ).toBe(401);
  }
);

test.each([
  "PRODUTOR",
  "TECNICO",
])(
  "%s consulta mas não publica preço",
  async (valor) => {
    perfil(valor);

    const consulta = await request(app)
      .get(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      consulta.status
    ).toBe(200);

    const gravacao = await request(app)
      .post(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send(base);

    expect(
      gravacao.status
    ).toBe(403);

    expect(
      prisma.cotacaoMercado.create
    ).not.toHaveBeenCalled();
  }
);

test(
  "ADMIN cadastra cotação com autoria real",
  async () => {
    const resposta = await request(app)
      .post(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send({
        ...base,
        criadoPorId: 900,
        status: "INATIVO",
      });

    expect(
      resposta.status
    ).toBe(201);

    const dados =
      prisma.cotacaoMercado.create
        .mock.calls[0][0].data;

    expect(
      dados.criadoPorId
    ).toBe(6);

    expect(
      dados.status
    ).toBeUndefined();

    expect(
      resposta.body
    ).toMatchObject({
      moeda: "USD",
      unidade: "KG",
      precoMedio: 2.3456,
      demandaEstimadaKg: null,

      origemRegistro:
        "DECLARADO_POR_ADMIN",

      verificacaoAutomaticaDaFonte:
        false,
    });
  }
);

test(
  "moedas diferentes não são convertidas ou agregadas",
  async () => {
    prisma.cotacaoMercado.findMany.mockResolvedValue([
      registro(),

      registro({
        ...base,
        moeda: "BRL",
        precoMedio: 10,
      }),
    ]);

    const resposta = await request(app)
      .get(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.body.dados.map(
        (cotacao) => cotacao.moeda
      )
    ).toEqual([
      "USD",
      "BRL",
    ]);

    expect(
      resposta.body.precoMedio
    ).toBeUndefined();
  }
);

test(
  "demanda exige período, fonte e método",
  () => {
    expect(
      validarCotacao(
        comDemanda,
        agora
      ).demandaEstimadaKg
    ).toBe(1000);

    expect(() =>
      validarCotacao(
        {
          ...base,
          demandaEstimadaKg: 1000,
        },
        agora
      )
    ).toThrow(
      "Cotação inválida."
    );
  }
);

test(
  "demanda zero não é confundida com ausência",
  () => {
    expect(
      validarCotacao(
        {
          ...comDemanda,
          demandaEstimadaKg: 0,
        },
        agora
      ).demandaEstimadaKg
    ).toBe(0);
  }
);

test.each([
  { precoMedio: -1 },
  { precoMedio: "2.34" },
  { precoMedio: 2.12345 },
  { moeda: "ZZZ" },
  { dataReferencia: "2099-01-01" },
  { dataReferencia: "2026-02-30" },
  { fonteReferencia: "" },
  { mercadoDestino: "OUTRO" },
  { paisDestino: "BR" },
  { culturaId: "3" },
])(
  "entrada inválida é recusada: %p",
  (alteracao) => {
    expect(() =>
      validarCotacao(
        {
          ...base,
          ...alteracao,
        },
        agora
      )
    ).toThrow(
      "Cotação inválida."
    );
  }
);

test(
  "mercado interno usa BR",
  () => {
    const interno = {
      ...base,
      mercadoDestino: "INTERNO",
    };

    delete interno.paisDestino;

    expect(
      validarCotacao(
        interno,
        agora
      ).paisDestino
    ).toBe("BR");

    expect(() =>
      validarCotacao(
        {
          ...interno,
          paisDestino: "US",
        },
        agora
      )
    ).toThrow();
  }
);

test(
  "fim da demanda não pode anteceder início",
  () => {
    expect(() =>
      validarCotacao(
        {
          ...comDemanda,
          demandaFim: "2026-11-30",
        },
        agora
      )
    ).toThrow();
  }
);

test(
  "API não grava fonte vazia",
  async () => {
    const resposta = await request(app)
      .post(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send({
        ...base,
        fonteNome: "",
      });

    expect(
      resposta.status
    ).toBe(400);

    expect(
      prisma.cotacaoMercado.create
    ).not.toHaveBeenCalled();
  }
);

test(
  "cultura ausente impede gravação",
  async () => {
    prisma.cultura.findUnique.mockResolvedValue(
      null
    );

    const resposta = await request(app)
      .post(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send(base);

    expect(
      resposta.status
    ).toBe(404);

    expect(
      prisma.cotacaoMercado.create
    ).not.toHaveBeenCalled();
  }
);

test(
  "filtros são aplicados antes de paginar",
  async () => {
    const resposta = await request(app)
      .get(
        ROTA +
        "?culturaId=3" +
        "&mercadoDestino=EXPORTACAO" +
        "&moeda=USD" +
        "&pagina=2" +
        "&limite=5"
      )
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.status
    ).toBe(200);

    const consulta =
      prisma.cotacaoMercado.findMany
        .mock.calls[0][0];

    expect(
      consulta
    ).toMatchObject({
      where: {
        status: "ATIVO",
        culturaId: 3,
        mercadoDestino: "EXPORTACAO",
        moeda: "USD",
      },

      skip: 5,
      take: 5,
    });
  }
);

test.each([
  {
    culturaId: ["3", "4"],
  },
  {
    limite: "2x",
  },
  {
    moeda: ["BRL", "USD"],
  },
  {
    de: "2026-02-30",
  },
])(
  "filtro inválido: %p",
  (query) => {
    expect(() =>
      validarFiltrosCotacoes(
        query
      )
    ).toThrow(
      "Filtros inválidos."
    );
  }
);

test(
  "PUT preserva valores omitidos e autoria",
  async () => {
    const resposta = await request(app)
      .put(ROTA + "/99")
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send({
        precoMedio: 3,
        criadoPorId: 900,
      });

    expect(
      resposta.status
    ).toBe(200);

    const dados =
      prisma.cotacaoMercado.updateMany
        .mock.calls[0][0].data;

    expect(
      dados
    ).toMatchObject({
      precoMedio: 3,
      moeda: "USD",
      fonteNome: base.fonteNome,
    });

    expect(
      dados.criadoPorId
    ).toBeUndefined();
  }
);

test(
  "PUT null remove demanda e metadados",
  async () => {
    prisma.cotacaoMercado.findFirst.mockResolvedValue(
      registro(comDemanda)
    );

    const resposta = await request(app)
      .put(ROTA + "/99")
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send({
        demandaEstimadaKg: null,
      });

    expect(
      resposta.status
    ).toBe(200);

    const dados =
      prisma.cotacaoMercado.updateMany
        .mock.calls[0][0].data;

    expect([
      dados.demandaEstimadaKg,
      dados.demandaInicio,
      dados.demandaFim,
      dados.fonteDemanda,
      dados.metodoDemanda,
    ]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  }
);

test(
  "DELETE inativa sem apagar histórico",
  async () => {
    const resposta = await request(app)
      .delete(ROTA + "/99")
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.status
    ).toBe(204);

    expect(
      prisma.cotacaoMercado.updateMany
    ).toHaveBeenCalledWith({
      where: {
        id: 99,
        status: "ATIVO",
      },

      data: {
        status: "INATIVO",
      },
    });
  }
);

test(
  "cotação inexistente ou inativa retorna 404",
  async () => {
    prisma.cotacaoMercado.findFirst.mockResolvedValue(
      null
    );

    const resposta = await request(app)
      .get(ROTA + "/99")
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.status
    ).toBe(404);
  }
);

test(
  "cultura com cotação não pode ser apagada",
  async () => {
    prisma.cultura.findUnique.mockResolvedValue({
      _count: {
        lotes: 0,
        cotacoesMercado: 1,
      },
    });

    prisma.cultura.deleteMany =
      jest.fn();

    const culturas =
      require("../src/services/culturaService");

    await expect(
      culturas.remover(3)
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(
      prisma.cultura.deleteMany
    ).not.toHaveBeenCalled();
  }
);

test(
  "preço por caixa não é rotulado como KG",
  () => {
    expect(() =>
      validarCotacao(
        {
          ...base,
          unidade: "CAIXA",
        },
        agora
      )
    ).toThrow(
      "Cotação inválida."
    );
  }
);

test(
  "demanda em tonelada não é aceita como KG",
  () => {
    expect(() =>
      validarCotacao(
        {
          ...comDemanda,
          unidadeDemanda: "T",
        },
        agora
      )
    ).toThrow(
      "Cotação inválida."
    );
  }
);