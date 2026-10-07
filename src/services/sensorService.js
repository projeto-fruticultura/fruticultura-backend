const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroLote, filtroSensor } = require("./escopoDono");

const ERRO_NAO_ENCONTRADO = "Sensor não encontrado.";

// Campos devolvidos ao front: o lote vem so com o necessario para exibir.
const SELECAO = {
  id: true,
  codigo: true,
  tipo: true,
  localizacao: true,
  dataInstalacao: true,
  status: true,
  loteId: true,
  lote: { select: { id: true, identificacao: true } },
};

// A data e gravada a meia-noite UTC, entao os 10 primeiros caracteres sao o dia certo.
function formatar(sensor) {
  return { ...sensor, dataInstalacao: sensor.dataInstalacao.toISOString().slice(0, 10) };
}

// O lote precisa ser visivel ao usuario (dono da propriedade, ou ADMIN) e estar ATIVO.
// Inexistente, de outra pessoa ou INATIVO: 404, a mesma resposta nos tres casos, para nao revelar
// quais ids de lote existem. Lote ATIVO de propriedade INATIVA: 400 (a propriedade foi excluida).
// O status do lote e conferido so aqui, e nao no filtroLote: filtroSensor nao pode herdar esse
// filtro, senao os sensores e as leituras de um lote inativo sumiriam do historico.
async function garantirLote(loteId, usuario) {
  const lote = await prisma.lote.findFirst({
    where: { id: loteId, status: "ATIVO", AND: [filtroLote(usuario)] },
    select: { propriedade: { select: { status: true } } },
  });
  if (!lote) {
    throw new ErroHttp(404, "Lote não encontrado.", { loteId: "lote não encontrado." });
  }
  if (lote.propriedade.status !== "ATIVO") {
    throw new ErroHttp(400, "Lote não encontrado.", { loteId: "lote não encontrado." });
  }
}

// codigo e @unique no schema: o banco recusa repetido com o erro P2002.
// Traduzimos para 409 sem repassar a mensagem interna do Prisma.
function traduzirCodigoRepetido(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    return new ErroHttp(409, "Já existe um sensor com esse código.", {
      codigo: "já existe um sensor com esse código.",
    });
  }
  return erro;
}

async function listar(usuario) {
  const sensores = await prisma.sensor.findMany({
    where: { status: "ATIVO", AND: [filtroSensor(usuario)] },
    orderBy: { codigo: "asc" },
    select: SELECAO,
  });
  return sensores.map(formatar);
}

async function buscarPorId(id, usuario) {
  // Sensor INATIVO ou de outro dono: 404, como se nao existisse.
  const sensor = await prisma.sensor.findFirst({
    where: { id, status: "ATIVO", AND: [filtroSensor(usuario)] },
    select: SELECAO,
  });
  if (!sensor) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  return formatar(sensor);
}

async function criar(dados, usuario) {
  // So aceita loteId de lote visivel: ninguem cria sensor na propriedade de outra pessoa.
  await garantirLote(dados.loteId, usuario);
  try {
    return formatar(await prisma.sensor.create({ data: dados, select: SELECAO }));
  } catch (erro) {
    throw traduzirCodigoRepetido(erro);
  }
}

async function atualizar(id, dados, usuario) {
  const filtro = { id, status: "ATIVO", AND: [filtroSensor(usuario)] };

  // Primeiro o 404: nao adianta validar o lote de um sensor que nao existe (ou e de outro dono).
  const existe = await prisma.sensor.findFirst({ where: filtro, select: { id: true } });
  if (!existe) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

  // O lote de destino tambem precisa ser visivel: ninguem move sensor para o lote de outra pessoa.
  await garantirLote(dados.loteId, usuario);

  let count;
  try {
    // updateMany com o filtro de dono no where: a regra vale na propria gravacao.
    ({ count } = await prisma.sensor.updateMany({ where: filtro, data: dados }));
  } catch (erro) {
    throw traduzirCodigoRepetido(erro);
  }
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

  return buscarPorId(id, usuario);
}

async function remover(id, usuario) {
  // Exclusao logica: as leituras futuras dependem do sensor, entao a linha fica no banco.
  // O filtro de dono no where faz o sensor de outra pessoa dar 404.
  const { count } = await prisma.sensor.updateMany({
    where: { id, status: "ATIVO", AND: [filtroSensor(usuario)] },
    data: { status: "INATIVO" },
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
