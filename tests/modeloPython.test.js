const {
  consultar,
  validarResposta,
} = require("../src/services/modeloPythonService");

function respostaValida() {
  return {
    contractVersion: "1.0",
    modelVersion: "modelo-test-v1",
    generatedAt: "2026-11-18T12:00:00.000Z",

    harvest: {
      status: "FAVORAVEL",

      windows: [
        {
          inicio: "2026-11-20T00:00:00.000Z",
          fim: "2026-11-20T23:59:59.999Z",
        },
      ],

      reasons: [],
    },

    export: {
      status: "NAO_FAVORAVEL",
      windows: [],
      reasons: ["Margem insuficiente"],
    },
  };
}

function respostaHttp(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test(
  "sem URL retorna 503 sem chamar a rede",
  async () => {
    const fetchImpl = jest.fn();

    await expect(
      consultar(
        {},
        {
          fetchImpl,
          env: {},
        }
      )
    ).rejects.toMatchObject({
      status: 503,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  }
);

test(
  "envia POST JSON e valida resposta v1",
  async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        respostaHttp(respostaValida())
      );

    const payload = {
      contractVersion: "1.0",
      lote: { id: 7 },
    };

    const url =
      "http://127.0.0.1:8000/v1/recommendations/harvest-export";

    const resultado = await consultar(
      payload,
      {
        fetchImpl,

        env: {
          PYTHON_RECOMMENDATION_URL: url,
        },
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      url,

      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );

    expect(resultado.modelVersion).toBe(
      "modelo-test-v1"
    );
  }
);

test(
  "envia token de serviço",
  async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        respostaHttp(respostaValida())
      );

    await consultar(
      {},
      {
        fetchImpl,

        env: {
          PYTHON_RECOMMENDATION_URL:
            "https://modelo.exemplo.org/v1/recommendations/harvest-export",

          PYTHON_RECOMMENDATION_TOKEN:
            "token-teste",
        },
      }
    );

    expect(
      fetchImpl.mock.calls[0][1]
        .headers.Authorization
    ).toBe("Bearer token-teste");
  }
);

test(
  "falha de rede retorna 503",
  async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValue(
        new Error("offline")
      );

    await expect(
      consultar(
        {},
        {
          fetchImpl,

          env: {
            PYTHON_RECOMMENDATION_URL:
              "http://localhost:8000/model",
          },
        }
      )
    ).rejects.toMatchObject({
      status: 503,
    });
  }
);

test(
  "timeout retorna 504",
  async () => {
    const erro = new Error("timed out");
    erro.name = "TimeoutError";

    const fetchImpl = jest
      .fn()
      .mockRejectedValue(erro);

    await expect(
      consultar(
        {},
        {
          fetchImpl,

          env: {
            PYTHON_RECOMMENDATION_URL:
              "http://localhost:8000/model",
          },
        }
      )
    ).rejects.toMatchObject({
      status: 504,
    });
  }
);

test(
  "recusa resposta fora do contrato",
  () => {
    expect(() =>
      validarResposta({
        contractVersion: "0.9",
      })
    ).toThrow(
      "Resposta inválida do serviço Python de recomendações."
    );
  }
);