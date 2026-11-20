jest.mock("../src/config/prisma", () => ({
  $transaction: jest.fn(),
}));

const prisma = require("../src/config/prisma");

const {
  persistir,
} = require("../src/services/riscoService");

const cultura = {
  temperaturaMin: 15,
  temperaturaMax: 30,
  umidadeMin: 40,
  umidadeMax: 80,
};

function serie(horas) {
  return Array.from(
    {
      length: horas * 6 + 1,
    },
    (_, indice) => ({
      temperatura: 35,
      umidade: 60,

      dataHoraLeitura: new Date(
        Date.UTC(
          2026,
          10,
          18,
          0,
          indice * 10
        )
      ),
    })
  );
}

let tx;

beforeEach(() => {
  jest.resetAllMocks();

  tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([]),

    sensor: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 40,

          lote: {
            cultura,
          },
        }),
    },

    leitura: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          serie(6)
        ),
    },

    alertaRisco: {
      deleteMany: jest
        .fn()
        .mockResolvedValue({
          count: 0,
        }),

      upsert: jest
        .fn()
        .mockResolvedValue({}),
    },
  };

  prisma.$transaction.mockImplementation(
    async (callback) => callback(tx)
  );
});

test(
  "episódio de seis horas persiste níveis moderado e alto em transação",
  async () => {
    const resultado = await persistir(40);

    expect(
      resultado.alertas.map(
        (alerta) => alerta.nivel
      )
    ).toEqual([
      "MODERADO",
      "ALTO",
    ]);

    expect(
      tx.$queryRaw
    ).toHaveBeenCalledTimes(1);

    expect(
      tx.alertaRisco.upsert
    ).toHaveBeenCalledTimes(2);

    expect(
      tx.alertaRisco.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sensorId: 40,
          tipo: "TEMPERATURA_ALTA",
          nivel: "ALTO",
          duracaoMinutos: 360,
        }),

        update: expect.objectContaining({
          duracaoMinutos: 360,
        }),
      })
    );
  }
);

test(
  "repetição utiliza as mesmas chaves de upsert",
  async () => {
    await persistir(40);

    const chaves =
      tx.alertaRisco.upsert.mock.calls.map(
        ([argumentos]) => argumentos.where
      );

    tx.alertaRisco.upsert.mockClear();

    await persistir(40);

    const novasChaves =
      tx.alertaRisco.upsert.mock.calls.map(
        ([argumentos]) => argumentos.where
      );

    expect(novasChaves).toEqual(chaves);
  }
);

test(
  "leitura normal atrasada quebra continuidade e remove episódio antigo",
  async () => {
    const leituras = serie(2);

    leituras.splice(7, 0, {
      temperatura: 25,
      umidade: 60,

      dataHoraLeitura: new Date(
        "2026-11-18T01:05:00Z"
      ),
    });

    leituras.sort(
      (a, b) =>
        a.dataHoraLeitura -
        b.dataHoraLeitura
    );

    tx.leitura.findMany.mockResolvedValue(
      leituras
    );

    const resultado = await persistir(40);

    expect(
      resultado.alertas
    ).toEqual([]);

    expect(
      tx.alertaRisco.upsert
    ).not.toHaveBeenCalled();

    expect(
      tx.alertaRisco.deleteMany
    ).toHaveBeenCalledWith({
      where: {
        sensorId: 40,
      },
    });
  }
);

test(
  "lacuna maior que quinze minutos impede falso episódio contínuo",
  async () => {
    const leituras = serie(6).filter(
      (_, indice) =>
        indice !== 12 &&
        indice !== 24
    );

    tx.leitura.findMany.mockResolvedValue(
      leituras
    );

    const resultado = await persistir(40);

    expect(
      resultado.alertas
    ).toEqual([]);
  }
);

test(
  "erro de escrita é propagado para a transação",
  async () => {
    tx.alertaRisco.upsert.mockRejectedValue(
      new Error("falha simulada")
    );

    await expect(
      persistir(40)
    ).rejects.toThrow(
      "falha simulada"
    );
  }
);