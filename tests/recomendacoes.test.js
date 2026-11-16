// POST /api/lotes/:id/recomendacoes: autenticar precisa rodar antes de exigirPerfil("ADMIN", "TECNICO").
// Prisma mockado: nenhum teste aqui toca banco.
jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },

  lote: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

const prisma = require("../src/config/prisma");
const app = require("../src/app");

const ROTA = "/api/lotes/1/recomendacoes";

// Corpo valido para recomendar() (todas as faixas do recomendacaoService).
const corpo = {
  grausDiaAcumulados: 1200,
  grausDiaAlvo: 1000,
  chuvaPrevistaMm: 0,
  chuvaLimiteMm: 5,
  umidadePrevista: 50,
  umidadeLimite: 80,
  horasAteResfriamento: 5,
  tempoTransporteHoras: 24,
  vidaUtilHoras: 72,
  precoInternoKg: 5,
  precoExportacaoKg: 9,
  custoInternoKg: 1,
  custoExportacaoKg: 3,
  cadeiaFrioGarantida: true,
};

function token(id = 1) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(id),
  });
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

test("recomendações sem token retorna 401", async () => {
  const resposta = await request(app).post(ROTA).send(corpo);

  expect(resposta.status).toBe(401);
  expect(prisma.lote.findFirst).not.toHaveBeenCalled();
});

test("produtor não acessa recomendações (403)", async () => {
  autenticarComo("PRODUTOR");

  const resposta = await request(app)
    .post(ROTA)
    .set("Authorization", `Bearer ${token()}`)
    .send(corpo);

  expect(resposta.status).toBe(403);
  expect(prisma.lote.findFirst).not.toHaveBeenCalled();
});

test.each(["TECNICO", "ADMIN"])(
  "%s autenticado recebe a recomendação (nem 401 nem 403)",
  async (perfil) => {
    autenticarComo(perfil);
    prisma.lote.findFirst.mockResolvedValue({ id: 1 });
    prisma.lote.findUnique.mockResolvedValue({
      faseFenologica: "MATURACAO",
    });

    const resposta = await request(app)
      .post(ROTA)
      .set("Authorization", `Bearer ${token()}`)
      .send(corpo);

    expect(resposta.status).not.toBe(401);
    expect(resposta.status).not.toBe(403);
    expect(resposta.status).toBe(200);
    expect(resposta.body.regraVersao).toBe("heuristica-v1");
  }
);

test("técnico com lote inexistente recebe 404, nunca 500", async () => {
  autenticarComo("TECNICO");
  prisma.lote.findFirst.mockResolvedValue(null);

  const resposta = await request(app)
    .post("/api/lotes/999/recomendacoes")
    .set("Authorization", `Bearer ${token()}`)
    .send(corpo);

  expect(resposta.status).toBe(404);
  expect(resposta.body.erro).toBe("Lote não encontrado.");
  expect(prisma.lote.findUnique).not.toHaveBeenCalled();
});

test("as demais rotas de lotes continuam protegidas: GET /api/lotes sem token retorna 401", async () => {
  const resposta = await request(app).get("/api/lotes");

  expect(resposta.status).toBe(401);
});
