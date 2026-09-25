const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");

const ERRO_NAO_ENCONTRADA = "Propriedade não encontrada.";

// Soma os sensores ativos de todos os lotes de cada propriedade.
// Uma unica query para todas as propriedades (nada de query dentro de loop):
// traz um registro por lote com a contagem dos sensores dele, e somamos em memoria.
async function contarSensores(propriedadeIds) {
  const lotes = await prisma.lote.findMany({
    where: { propriedadeId: { in: propriedadeIds } },
    select: {
      propriedadeId: true,
      _count: { select: { sensores: { where: { status: "ATIVO" } } } },
    },
  });

  const totais = new Map();
  for (const lote of lotes) {
    totais.set(lote.propriedadeId, (totais.get(lote.propriedadeId) || 0) + lote._count.sensores);
  }
  return totais;
}

// O Prisma devolve Decimal (que vira texto no JSON); o front espera numero.
function formatar(propriedade, totalSensores) {
  const { _count, ...campos } = propriedade;
  return {
    ...campos,
    area: Number(campos.area),
    latitude: Number(campos.latitude),
    longitude: Number(campos.longitude),
    totalLotes: _count ? _count.lotes : 0,
    totalSensores,
  };
}

async function listar() {
  const propriedades = await prisma.propriedade.findMany({
    where: { status: "ATIVO" },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cidade: true, uf: true, _count: { select: { lotes: true } } },
  });

  const sensores = await contarSensores(propriedades.map((p) => p.id));

  return propriedades.map((p) => ({
    id: p.id,
    nome: p.nome,
    cidade: p.cidade,
    uf: p.uf,
    totalLotes: p._count.lotes,
    totalSensores: sensores.get(p.id) || 0,
  }));
}

async function buscarPorId(id) {
  // Propriedade INATIVA conta como excluida: responde 404 como se nao existisse.
  const propriedade = await prisma.propriedade.findFirst({
    where: { id, status: "ATIVO" },
    include: { _count: { select: { lotes: true } } },
  });
  if (!propriedade) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);

  const sensores = await contarSensores([id]);
  return formatar(propriedade, sensores.get(id) || 0);
}

async function criar(dados) {
  // TODO(BE11): trocar pelo usuário logado (req.usuario.id)
  // Enquanto o login nao existe, o dono e o admin do seed. Nunca aceitar usuarioId do body.
  const dono = await prisma.usuario.findUnique({
    where: { email: process.env.SEED_ADMIN_EMAIL || "" },
    select: { id: true },
  });
  if (!dono) {
    console.error("Usuario do SEED_ADMIN_EMAIL nao encontrado. Rode npm run db:seed.");
    throw new ErroHttp(500, "Não foi possível definir o responsável pela propriedade.");
  }

  const propriedade = await prisma.propriedade.create({
    data: { ...dados, usuarioId: dono.id },
  });
  // Recem-criada: ainda nao tem lotes nem sensores.
  return formatar(propriedade, 0);
}

async function atualizar(id, dados) {
  // updateMany permite filtrar por status: so edita se existir e estiver ATIVA.
  const { count } = await prisma.propriedade.updateMany({
    where: { id, status: "ATIVO" },
    data: dados,
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);

  return buscarPorId(id);
}

async function remover(id) {
  // Exclusao logica: a linha fica no banco para nao perder o historico ligado a ela.
  const { count } = await prisma.propriedade.updateMany({
    where: { id, status: "ATIVO" },
    data: { status: "INATIVO" },
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
