jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },

  propriedade: {
    findMany: jest.fn(),
  },

  rotaLogistica: {
    groupBy: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const prisma = require("../src/config/prisma");

const ROTA =
  "/api/logistica/comparar?propriedadeIds=1,2";

function token() {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: "6",
    }
  );
}

const propriedades = [
  {
    id: 1,
    nome: "Propriedade A",
  },
  {
    id: 2,
    nome: "Propriedade B",
  },
];

beforeEach(() => {
  jest.resetAllMocks();

  prisma.usuario.findUnique.mockResolvedValue({
    id: 6,
    perfil: "ADMIN",
    status: "ATIVO",
  });

  prisma.propriedade.findMany.mockResolvedValue(
    propriedades
  );

  prisma.rotaLogistica.groupBy.mockImplementation(
    async ({ by }) => {
      if (by.length === 1) {
        return [
          {
            propriedadeId: 1,

            _count: {
              _all: 2,
            },

            _sum: {
              custo: "400.00",
            },

            _avg: {
              custo: "200.00",
              tempoEstimadoHoras: "4.0",
            },

            _min: {
              custo: "100.00",
              tempoEstimadoHoras: "2.0",
            },

            _max: {
              custo: "300.00",
              tempoEstimadoHoras: "6.0",
            },
          },
          {
            propriedadeId: 2,

            _count: {
              _all: 1,
            },

            _sum: {
              custo: "250.00",
            },

            _avg: {
              custo: "250.00",
              tempoEstimadoHoras: "3.0",
            },

            _min: {
              custo: "250.00",
              tempoEstimadoHoras: "3.0",
            },

            _max: {
              custo: "250.00",
              tempoEstimadoHoras: "3.0",
            },
          },
        ];
      }

      if (by.includes("modal")) {
        return [
          {
            propriedadeId: 1,
            modal: "RODOVIARIO",

            _count: {
              _all: 2,
            },
          },
        ];
      }

      return [
        {
          propriedadeId: 1,
          situacao: "PLANEJADA",

          _count: {
            _all: 2,
          },
        },
      ];
    }
  );
});

test(
  "API entrega custos, prazos e contagens com rotas simuladas",
  async () => {
    const resposta = await request(app)
      .get(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.status
    ).toBe(200);

    expect(
      resposta.body.indicadores[0]
    ).toMatchObject({
      rotasAtivas: 2,
      custoTotalRotas: 400,
      custoMedioRota: 200,
      custoMinimoRota: 100,
      custoMaximoRota: 300,
      prazoMedioHoras: 4,

      rotasPorModal: {
        RODOVIARIO: 2,
      },

      rotasPorSituacao: {
        PLANEJADA: 2,
      },
    });

    expect(
      resposta.body.indicadores[1]
    ).toMatchObject({
      custoMedioRota: 250,
      prazoMedioHoras: 3,
    });
  }
);

test(
  "propriedade fora do escopo não dispara agregação",
  async () => {
    prisma.propriedade.findMany.mockResolvedValue([
      propriedades[0],
    ]);

    const resposta = await request(app)
      .get(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.status
    ).toBe(404);

    expect(
      prisma.rotaLogistica.groupBy
    ).not.toHaveBeenCalled();
  }
);

test(
  "filtro de produtor é aplicado às propriedades e agregações",
  async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 6,
      perfil: "PRODUTOR",
      status: "ATIVO",
    });

    const resposta = await request(app)
      .get(ROTA)
      .set(
        "Authorization",
        `Bearer ${token()}`
      );

    expect(
      resposta.status
    ).toBe(200);

    const consultaPropriedades =
      prisma.propriedade.findMany
        .mock.calls[0][0];

    expect(
      consultaPropriedades.where.AND
    ).toContainEqual({
      usuarioId: 6,
    });

    for (
      const [argumentos]
      of prisma.rotaLogistica.groupBy.mock.calls
    ) {
      expect(
        argumentos.where.propriedade.AND
      ).toContainEqual({
        usuarioId: 6,
      });

      expect(
        argumentos.where.status
      ).toBe("ATIVO");
    }
  }
);