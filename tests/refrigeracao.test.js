jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },

  propriedade: {
    findFirst: jest.fn(),
  },

  rotaLogistica: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const prisma = require("../src/config/prisma");

const {
  validarLogistica,
} = require("../src/validators/logisticaValidator");

const {
  buscarPorId,
} = require("../src/services/logisticaService");

const base = {
  origem: "Petrolina",
  destino: "Recife",
  modal: "RODOVIARIO",
  tempoEstimadoHoras: 4,
  custo: 200,
  transportadora: "Operador de teste",
  situacao: "PLANEJADA",
  propriedadeId: 19,
};

function token() {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: "6",
    }
  );
}

beforeEach(() => {
  jest.resetAllMocks();

  prisma.usuario.findUnique.mockResolvedValue({
    id: 6,
    perfil: "ADMIN",
    status: "ATIVO",
  });

  prisma.propriedade.findFirst.mockResolvedValue({
    status: "ATIVO",
  });
});

test.each([
  true,
  false,
  null,
])(
  "aceita declaração %s",
  (valor) => {
    const dados = validarLogistica(
      {
        ...base,
        exigeRefrigeracaoRapida: valor,
      },
      "criar"
    );

    expect(
      dados.exigeRefrigeracaoRapida
    ).toBe(valor);
  }
);

test.each([
  "true",
  1,
  {},
  [],
])(
  "recusa tipo incorreto: %p",
  (valor) => {
    expect(() =>
      validarLogistica(
        {
          ...base,
          exigeRefrigeracaoRapida: valor,
        },
        "criar"
      )
    ).toThrow(
      "Dados inválidos."
    );
  }
);

test(
  "PUT omitido não apaga declaração anterior",
  () => {
    expect(
      validarLogistica(
        {
          custo: 250,
        },
        "atualizar"
      )
    ).toEqual({
      custo: 250,
    });
  }
);

test(
  "POST grava e devolve declaração com prazo estrito",
  async () => {
    prisma.rotaLogistica.create.mockResolvedValue({
      id: 99,
      ...base,
      exigeRefrigeracaoRapida: true,
    });

    const resposta = await request(app)
      .post("/api/logistica")
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send({
        ...base,
        exigeRefrigeracaoRapida: true,
      });

    expect(
      resposta.status
    ).toBe(201);

    const dadosGravados =
      prisma.rotaLogistica.create
        .mock.calls[0][0].data;

    expect(
      dadosGravados.exigeRefrigeracaoRapida
    ).toBe(true);

    expect(
      resposta.body.refrigeracao
    ).toEqual({
      origem: "DECLARACAO_OPERADOR",
      prazoReferenciaHoras: 6,
      comparadorPrazo: "MENOR_QUE",
      temperaturaCargaVerificada: false,
    });
  }
);

test(
  "rota antiga devolve condição desconhecida",
  async () => {
    prisma.rotaLogistica.findFirst.mockResolvedValue({
      id: 99,
      ...base,
    });

    const resposta = await buscarPorId(
      99,
      {
        id: 6,
        perfil: "ADMIN",
      }
    );

    expect(
      resposta.exigeRefrigeracaoRapida
    ).toBeNull();

    expect(
      resposta.refrigeracao.origem
    ).toBe(
      "NAO_INFORMADO"
    );

    expect(
      resposta.refrigeracao.prazoReferenciaHoras
    ).toBeNull();
  }
);

test(
  "TECNICO não altera declaração de uma rota",
  async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 6,
      perfil: "TECNICO",
      status: "ATIVO",
    });

    const resposta = await request(app)
      .put("/api/logistica/99")
      .set(
        "Authorization",
        `Bearer ${token()}`
      )
      .send({
        exigeRefrigeracaoRapida: true,
      });

    expect(
      resposta.status
    ).toBe(403);

    expect(
      prisma.rotaLogistica.updateMany
    ).not.toHaveBeenCalled();
  }
);