jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

const prisma = require("../src/config/prisma");
const app = require("../src/app");

const ENDPOINT = "/api/produtividade/previsoes";

function token() {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    { subject: "1" }
  );
}

beforeEach(() => {
  jest.clearAllMocks();

  prisma.usuario.findUnique.mockResolvedValue({
    id: 1,
    nome: "Usuário de teste",
    email: "teste@exemplo.com",
    perfil: "PRODUTOR",
    status: "ATIVO",
  });
});

test("rejeita consulta sem autenticação", async () => {
  const resposta = await request(app)
    .get(ENDPOINT)
    .query({
      municipio: "Casa Nova (BA)",
      produto: "Goiaba",
      ano: "2026",
    });

  expect(resposta.status).toBe(401);
});

test("retorna previsão de produtividade existente", async () => {
  const resposta = await request(app)
    .get(ENDPOINT)
    .set("Authorization", `Bearer ${token()}`)
    .query({
      municipio: "Casa Nova (BA)",
      produto: "Goiaba",
      ano: "2026",
    });

  expect(resposta.status).toBe(200);
  expect(resposta.body).toMatchObject({
    municipio: "Casa Nova (BA)",
    produto: "Goiaba",
    anoPrevisao: 2026,
    produtividadePrevistaTHa: 24.989,
    metodo: "Persistencia",
    status: "EXPERIMENTAL",
    unidade: "t/ha",
  });

  expect(resposta.body.aviso).toMatch(/experimental/i);
});

test("rejeita parâmetros inválidos", async () => {
  const resposta = await request(app)
    .get(ENDPOINT)
    .set("Authorization", `Bearer ${token()}`)
    .query({
      municipio: "Casa Nova (BA)",
      produto: "Goiaba",
      ano: "abc",
    });

  expect(resposta.status).toBe(400);
});

test("retorna 404 para previsão inexistente", async () => {
  const resposta = await request(app)
    .get(ENDPOINT)
    .set("Authorization", `Bearer ${token()}`)
    .query({
      municipio: "Casa Nova (BA)",
      produto: "Goiaba",
      ano: "2030",
    });

  expect(resposta.status).toBe(404);
});