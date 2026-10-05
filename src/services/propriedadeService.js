const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroPropriedade } = require("./escopoDono");

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

async function listar(usuario) {
  const propriedades = await prisma.propriedade.findMany({
    where: { status: "ATIVO", AND: [filtroPropriedade(usuario)] },
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

async function buscarPorId(id, usuario) {
  // Propriedade INATIVA ou de outro dono: 404, como se nao existisse.
  // 404 (e nao 403) para nao revelar que o id existe.
  const propriedade = await prisma.propriedade.findFirst({
    where: { id, status: "ATIVO", AND: [filtroPropriedade(usuario)] },
    include: { _count: { select: { lotes: true } } },
  });
  if (!propriedade) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);

  const sensores = await contarSensores([id]);
  return formatar(propriedade, sensores.get(id) || 0);
}

async function criar(dados, usuario) {
  // O dono e sempre o usuario logado (para ADMIN, ele mesmo). Nunca vem do body:
  // o validator ja descarta usuarioId, entao ninguem cria propriedade em nome de outro.

  // 1. Mapeamento de coordenadas centrais por UF para preenchimento automático
  const coordenadasUf = {
    AC: { lat: -9.97, lon: -67.81 },
    AL: { lat: -9.66, lon: -35.73 },
    AP: { lat: 0.03, lon: -51.06 },
    AM: { lat: -3.11, lon: -60.02 },
    BA: { lat: -12.97, lon: -38.51 },
    CE: { lat: -3.71, lon: -38.54 },
    DF: { lat: -15.79, lon: -47.88 },
    ES: { lat: -20.31, lon: -40.33 },
    GO: { lat: -16.68, lon: -49.25 },
    MA: { lat: -2.53, lon: -44.30 },
    MT: { lat: -15.60, lon: -56.09 },
    MS: { lat: -20.44, lon: -54.64 },
    MG: { lat: -19.91, lon: -43.93 },
    PA: { lat: -1.45, lon: -48.49 },
    PB: { lat: -7.11, lon: -34.86 },
    PR: { lat: -25.42, lon: -49.27 },
    PE: { lat: -8.04, lon: -34.87 },
    PI: { lat: -5.08, lon: -42.80 },
    RJ: { lat: -22.90, lon: -43.17 },
    RN: { lat: -5.79, lon: -35.20 },
    RS: { lat: -30.03, lon: -51.23 },
    RO: { lat: -8.76, lon: -63.90 },
    RR: { lat: 2.82, lon: -60.67 },
    SC: { lat: -27.59, lon: -48.54 },
    SP: { lat: -23.55, lon: -46.63 },
    SE: { lat: -10.94, lon: -37.07 },
    TO: { lat: -10.17, lon: -48.33 }
  };

  let dadosParaCriar = { ...dados };

  // 2. Se a UF foi informada mas latitude/longitude vieram vazias, preenche automaticamente
  if (dadosParaCriar.uf && (!dadosParaCriar.latitude || !dadosParaCriar.longitude)) {
    const ufMaiuscula = dadosParaCriar.uf.toUpperCase();
    const coordsRegiao = coordenadasUf[ufMaiuscula] || { lat: -9.33, lon: -40.60 }; // Padrão Vale se não achar
    
    if (!dadosParaCriar.latitude) dadosParaCriar.latitude = coordsRegiao.lat;
    if (!dadosParaCriar.longitude) dadosParaCriar.longitude = coordsRegiao.lon;
  }

  const propriedade = await prisma.propriedade.create({
    data: { ...dadosParaCriar, usuarioId: usuario.id },
  });
  
  // Recem-criada: ainda nao tem lotes nem sensores.
  return formatar(propriedade, 0);
}

async function atualizar(id, dados, usuario) {
  // updateMany permite filtrar por status e dono: so edita se existir, estiver ATIVA
  // e for do usuario. Outro dono conta como 0 linhas, ou seja, 404.
  const { count } = await prisma.propriedade.updateMany({
    where: { id, status: "ATIVO", AND: [filtroPropriedade(usuario)] },
    data: dados,
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);

  return buscarPorId(id, usuario);
}

async function remover(id, usuario) {
  // Exclusao logica: a linha fica no banco para nao perder o historico ligado a ela.
  // O filtro de dono no where faz a propriedade de outra pessoa dar 404.
  const { count } = await prisma.propriedade.updateMany({
    where: { id, status: "ATIVO", AND: [filtroPropriedade(usuario)] },
    data: { status: "INATIVO" },
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };