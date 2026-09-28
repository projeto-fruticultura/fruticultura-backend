// Popula o banco com dados iniciais. Pode rodar varias vezes: so cria o que ainda nao existe.
require("dotenv").config({ quiet: true });
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Custo 10: equilibrio entre seguranca e tempo de hash.
const CUSTO_BCRYPT = 10;

// valores provisórios, a definir pelo grupo
const CULTURAS = [
  { nome: "Goiaba", variedade: "Paluma", temperaturaMin: 23, temperaturaMax: 30, umidadeMin: 50, umidadeMax: 80 },
  { nome: "Manga", variedade: "Tommy Atkins", temperaturaMin: 24, temperaturaMax: 32, umidadeMin: 40, umidadeMax: 70 },
  { nome: "Uva", variedade: "Vitória", temperaturaMin: 20, temperaturaMax: 30, umidadeMin: 40, umidadeMax: 70 },
];

// Iguais ao prototipo. Coordenadas aproximadas da zona rural de cada cidade.
const PROPRIEDADES = [
  {
    nome: "Fazenda São Jorge",
    area: 120.5,
    cidade: "Petrolina",
    uf: "PE",
    latitude: -9.3346,
    longitude: -40.6072,
    prefixoSensor: "SJ",
    sensoresPorLote: 2,
    lotes: [
      { cultura: "Manga", area: 30, dataPlantacao: "2021-03-15", colheitaEstimada: "2026-11-20", situacao: "EM_PRODUCAO" },
      { cultura: "Manga", area: 25, dataPlantacao: "2022-05-10", colheitaEstimada: "2026-12-05", situacao: "EM_PRODUCAO" },
      { cultura: "Uva", area: 20, dataPlantacao: "2023-08-01", colheitaEstimada: "2026-10-30", situacao: "EM_PRODUCAO" },
      { cultura: "Goiaba", area: 15, dataPlantacao: "2025-02-20", colheitaEstimada: null, situacao: "EM_CRESCIMENTO" },
    ],
  },
  {
    nome: "Fazenda do Vorcaro",
    area: 45,
    cidade: "Juazeiro",
    uf: "BA",
    latitude: -9.447,
    longitude: -40.441,
    prefixoSensor: "VO",
    sensoresPorLote: 1,
    lotes: [
      { cultura: "Goiaba", area: 20, dataPlantacao: "2022-09-12", colheitaEstimada: "2026-11-10", situacao: "EM_PRODUCAO" },
      { cultura: "Manga", area: 18, dataPlantacao: "2024-04-05", colheitaEstimada: null, situacao: "EM_CRESCIMENTO" },
    ],
  },
  {
    nome: "Fazenda Santa Luiza",
    area: 210.75,
    cidade: "Petrolina",
    uf: "PE",
    latitude: -9.2987,
    longitude: -40.5389,
    prefixoSensor: "SL",
    sensoresPorLote: 2,
    lotes: [
      { cultura: "Uva", area: 35, dataPlantacao: "2020-06-18", colheitaEstimada: "2026-10-15", situacao: "EM_PRODUCAO" },
      { cultura: "Uva", area: 30, dataPlantacao: "2021-07-22", colheitaEstimada: "2026-11-01", situacao: "EM_PRODUCAO" },
      { cultura: "Manga", area: 40, dataPlantacao: "2019-03-03", colheitaEstimada: "2026-12-15", situacao: "EM_PRODUCAO" },
      { cultura: "Manga", area: 35, dataPlantacao: "2023-01-25", colheitaEstimada: null, situacao: "EM_CRESCIMENTO" },
      { cultura: "Goiaba", area: 25, dataPlantacao: "2022-11-08", colheitaEstimada: "2026-10-25", situacao: "EM_PRODUCAO" },
      { cultura: "Goiaba", area: 20, dataPlantacao: "2025-05-14", colheitaEstimada: null, situacao: "EM_CRESCIMENTO" },
    ],
  },
];

async function criarAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_SENHA;
  // Sem senha fixa no codigo: se faltar no .env, o seed para aqui.
  if (!email || !senha) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA no .env antes de rodar o seed.");
  }

  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  // update vazio: rodar de novo nao altera um admin que ja existe.
  return prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { nome: "Administrador", email, senha: senhaHash, perfil: "ADMIN" },
  });
}

async function criarCulturas() {
  const idPorNome = {};
  for (const cultura of CULTURAS) {
    // Cultura.nome nao e unico no schema, entao nao da para usar upsert: checa antes.
    let registro = await prisma.cultura.findFirst({ where: { nome: cultura.nome } });
    if (!registro) {
      registro = await prisma.cultura.create({ data: cultura });
    }
    idPorNome[cultura.nome] = registro.id;
  }
  return idPorNome;
}

async function criarPropriedades(usuarioId, culturaIdPorNome) {
  for (const p of PROPRIEDADES) {
    const existente = await prisma.propriedade.findFirst({ where: { nome: p.nome, usuarioId } });
    if (existente) {
      console.log(`- ${p.nome}: ja existe, mantida`);
      continue;
    }

    // Criacao aninhada: propriedade, lotes e sensores entram juntos ou nada entra.
    await prisma.propriedade.create({
      data: {
        nome: p.nome,
        area: p.area,
        cidade: p.cidade,
        uf: p.uf,
        latitude: p.latitude,
        longitude: p.longitude,
        usuarioId,
        lotes: {
          create: p.lotes.map((lote, i) => ({
            identificacao: `Lote ${i + 1}`,
            area: lote.area,
            dataPlantacao: new Date(lote.dataPlantacao),
            colheitaEstimada: lote.colheitaEstimada ? new Date(lote.colheitaEstimada) : null,
            situacao: lote.situacao,
            culturaId: culturaIdPorNome[lote.cultura],
            sensores: {
              create: Array.from({ length: p.sensoresPorLote }, (_, s) => ({
                // Codigo unico e previsivel, ex.: SJ-L1-S2.
                codigo: `${p.prefixoSensor}-L${i + 1}-S${s + 1}`,
                tipo: "TEMPERATURA_UMIDADE",
                localizacao: `Lote ${i + 1}, ponto ${s + 1}`,
                dataInstalacao: new Date(lote.dataPlantacao),
              })),
            },
          })),
        },
      },
    });
    console.log(`- ${p.nome}: criada`);
  }
}

async function main() {
  const admin = await criarAdmin();
  console.log("Admin pronto (id " + admin.id + ")");
  const culturaIdPorNome = await criarCulturas();
  console.log("Culturas prontas: " + Object.keys(culturaIdPorNome).join(", "));
  await criarPropriedades(admin.id, culturaIdPorNome);
}

main()
  .catch((erro) => {
    console.error("Falha no seed:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
