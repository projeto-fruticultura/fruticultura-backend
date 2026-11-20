jest.mock("../src/config/prisma", () => ({}));

const request = require("supertest");

const app = require("../src/app");

const mercado =
  require("../src/services/mercadoService");

const {
  validarFiltrosPrecos,
} = require("../src/validators/mercadoValidator");

const {
  resumirMercado,
} = require("../src/services/resumoMercadoService");

const filtros = {
  produto: "UVA",
  uf: "PE",
  ceasa: null,
};

function registro(
  preco,
  unidade = "KG",
  data = "2026-11-18"
) {
  return {
    preco,
    unidade,
    data,
    produto: "UVA",
    uf: "PE",
    ceasa: "CEASA TESTE",
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

test(
  "média usa todas as observações do dia mais recente",
  () => {
    const resumo = resumirMercado(
      [
        registro(4),
        registro(8),

        registro(
          100,
          "KG",
          "2026-11-17"
        ),
      ],
      filtros
    );

    expect(
      resumo.precoMedio
    ).toBe(6);

    expect(
      resumo.dataReferencia
    ).toBe(
      "2026-11-18"
    );

    expect(
      resumo.moeda
    ).toBe("BRL");

    expect(
      resumo.demandaEstimada
    ).toBeNull();

    expect(
      resumo.precoExportacao
    ).toBeNull();
  }
);

test(
  "não mistura KG e caixa em uma média",
  () => {
    const resumo = resumirMercado(
      [
        registro(4),
        registro(
          60,
          "CAIXA"
        ),
      ],
      filtros
    );

    expect(
      resumo.precoMedio
    ).toBeNull();

    expect(
      resumo.unidade
    ).toBeNull();

    expect(
      resumo.precosMediosPorUnidade
    ).toHaveLength(2);
  }
);

test(
  "sem registros mantém valores desconhecidos",
  () => {
    const resumo = resumirMercado(
      [],
      filtros
    );

    expect(
      resumo.precoMedio
    ).toBeNull();

    expect(
      resumo.dataReferencia
    ).toBeNull();
  }
);

test.each([
  {
    limite: "1abc",
  },
  {
    limite: "0",
  },
  {
    limite: "101",
  },
  {
    produto: [
      "UVA",
      "MANGA",
    ],
  },
  {
    uf: ["PE"],
  },
  {
    ceasa: ["RECIFE"],
  },
])(
  "query ambígua é recusada: %p",
  (dados) => {
    expect(() =>
      validarFiltrosPrecos({
        produto: "UVA",
        uf: "PE",
        ...dados,
      })
    ).toThrow(
      "Filtro inválido."
    );
  }
);

test(
  "API preserva contrato antigo e acrescenta resumo",
  async () => {
    jest.spyOn(
      mercado,
      "obterRegistros"
    ).mockResolvedValue({
      registros: [
        registro(4),
        registro(8),
      ],

      baixadoEm: Date.parse(
        "2026-11-18T12:00:00Z"
      ),

      desatualizado: false,
    });

    const resposta = await request(app)
      .get(
        "/api/precos?produto=UVA&uf=PE&limite=1"
      );

    expect(
      resposta.status
    ).toBe(200);

    expect(
      resposta.body.historico
    ).toHaveLength(1);

    expect(
      resposta.body.precoAtual.preco
    ).toBe(4);

    expect(
      resposta.body.resumoMercado.precoMedio
    ).toBe(6);

    expect(
      resposta.body.resumoMercado
        .mercadoDestino.tipo
    ).toBe(
      "INTERNO"
    );

    expect(
      resposta.body.resumoMercado
        .demandaEstimada
    ).toBeNull();
  }
);