jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },

  sensor: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("bcrypt", () => ({
  hashSync: jest.fn(() => "hash-falso"),
  compare: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const prisma = require("../src/config/prisma");
const app = require("../src/app");

function token(id = 1) {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: String(id),
    }
  );
}

function autenticarComo(perfil) {
  prisma.usuario.findUnique.mockResolvedValue({
    id: 1,
    nome: "Usuário de teste",
    email: "teste@exemplo.com",
    perfil,
    status: "ATIVO",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("sem token, sensores retorna 401", async () => {
  const resposta =
    await request(app).get("/api/sensores");

  expect(resposta.status).toBe(401);
});

test("produtor não configura hardware", async () => {
  autenticarComo("PRODUTOR");

  const resposta = await request(app)
    .post("/api/sensores/config")
    .set("Authorization", `Bearer ${token()}`)
    .send({
      sensorId: 1,
      channelId: "123",
      readApiKey: "CHAVE",
    });

  expect(resposta.status).toBe(403);

  expect(
    prisma.sensor.update
  ).not.toHaveBeenCalled();
});

test("técnico não cria lotes", async () => {
  autenticarComo("TECNICO");

  const resposta = await request(app)
    .post("/api/lotes")
    .set("Authorization", `Bearer ${token()}`)
    .send({});

  expect(resposta.status).toBe(403);
});

test("conta inativa não usa token existente", async () => {
  prisma.usuario.findUnique.mockResolvedValue({
    id: 1,
    perfil: "PRODUTOR",
    status: "INATIVO",
  });

  const resposta = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token()}`);

  expect(resposta.status).toBe(401);
});

test("login válido retorna token sem senha", async () => {
  prisma.usuario.findUnique.mockResolvedValue({
    id: 1,
    nome: "Arthur",
    email: "arthur@exemplo.com",
    perfil: "PRODUTOR",
    status: "ATIVO",
    senha: "hash-da-senha",
  });

  bcrypt.compare.mockResolvedValue(true);

  const resposta = await request(app)
    .post("/api/auth/login")
    .send({
      email: "arthur@exemplo.com",
      senha: "SenhaTeste123!",
    });

  expect(resposta.status).toBe(200);
  expect(resposta.body.token).toBeTruthy();

  expect(
    resposta.body.usuario.senha
  ).toBeUndefined();
});

test("chave inválida não altera o sensor", async () => {
  autenticarComo("TECNICO");

  prisma.sensor.findFirst.mockResolvedValue({
    id: 1,
  });

  jest.spyOn(global, "fetch")
    .mockResolvedValue({
      status: 401,
    });

  const resposta = await request(app)
    .post("/api/sensores/config")
    .set("Authorization", `Bearer ${token()}`)
    .send({
      sensorId: 1,
      channelId: "123",
      readApiKey: "CHAVEINVALIDA",
    });

  expect(resposta.status).toBe(422);

  expect(
    prisma.sensor.update
  ).not.toHaveBeenCalled();
});

test("configuração válida salva sem retornar a chave", async () => {
  autenticarComo("TECNICO");

  prisma.sensor.findFirst.mockResolvedValue({
    id: 1,
  });

  prisma.sensor.update.mockResolvedValue({
    id: 1,
    codigo: "SENSOR-1",
    channelId: "123",
  });

  jest.spyOn(global, "fetch")
    .mockResolvedValue({
      status: 200,

      json: async () => ({
        channel: {
          id: 123,
        },
        feeds: [],
      }),
    });

  const resposta = await request(app)
    .post("/api/sensores/config")
    .set("Authorization", `Bearer ${token()}`)
    .send({
      sensorId: 1,
      channelId: "123",
      readApiKey: "CHAVESECRETA",
    });

  expect(resposta.status).toBe(200);

  expect(
    resposta.body.conectado
  ).toBe(true);

  expect(
    JSON.stringify(resposta.body)
  ).not.toContain("CHAVESECRETA");
});