jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },
}));

const request = require("supertest");
const app = require("../src/app");

test(
  "cabeçalhos de segurança em resposta pública",
  async () => {
    const resposta = await request(app)
      .get("/api/health");

    expect(
      resposta.status
    ).toBe(200);

    expect(
      resposta.headers[
        "x-content-type-options"
      ]
    ).toBe("nosniff");

    expect(
      resposta.headers[
        "x-frame-options"
      ]
    ).toBe("DENY");

    expect(
      resposta.headers[
        "referrer-policy"
      ]
    ).toBe("no-referrer");

    expect(
      resposta.headers[
        "content-security-policy"
      ]
    ).toContain(
      "object-src 'none'"
    );

    expect(
      resposta.headers[
        "x-powered-by"
      ]
    ).toBeUndefined();
  }
);

test(
  "cabeçalhos também estão presentes no erro de autenticação",
  async () => {
    const resposta = await request(app)
      .get("/api/sensores");

    expect(
      resposta.status
    ).toBe(401);

    expect(
      resposta.headers[
        "x-content-type-options"
      ]
    ).toBe("nosniff");
  }
);

test(
  "JSON malformado retorna 400",
  async () => {
    const resposta = await request(app)
      .post("/api/auth/login")
      .set(
        "Content-Type",
        "application/json"
      )
      .send(
        '{"email":'
      );

    expect(
      resposta.status
    ).toBe(400);

    expect(
      resposta.body.erro
    ).toBe(
      "JSON inválido no corpo da requisição."
    );
  }
);

test(
  "corpo acima de 100kb retorna 413",
  async () => {
    const resposta = await request(app)
      .post("/api/auth/login")
      .send({
        email: "a".repeat(
          110000
        ),
      });

    expect(
      resposta.status
    ).toBe(413);
  }
);

test(
  "localhost não é forçado a HTTPS no teste",
  async () => {
    const resposta = await request(app)
      .get("/api/health");

    expect(
      resposta.headers[
        "strict-transport-security"
      ]
    ).toBeUndefined();

    expect(
      resposta.headers[
        "content-security-policy"
      ]
    ).not.toContain(
      "upgrade-insecure-requests"
    );
  }
);

test(
  "produção inclui HSTS e upgrade para HTTPS",
  async () => {
    const ambienteAnterior =
      process.env.NODE_ENV;

    try {
      process.env.NODE_ENV =
        "production";

      let appProducao;

      jest.isolateModules(() => {
        appProducao =
          require("../src/app");
      });

      const resposta =
        await request(appProducao)
          .get("/api/health");

      expect(
        resposta.status
      ).toBe(200);

      expect(
        resposta.headers[
          "strict-transport-security"
        ]
      ).toBe(
        "max-age=31536000"
      );

      expect(
        resposta.headers[
          "content-security-policy"
        ]
      ).toContain(
        "upgrade-insecure-requests"
      );
    } finally {
      if (
        ambienteAnterior === undefined
      ) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV =
          ambienteAnterior;
      }
    }
  }
);