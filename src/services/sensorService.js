const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");

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

// Lote de propriedade INATIVA conta como inexistente: a propriedade foi excluida.
async function garantirLote(loteId) {
  const lote = await prisma.lote.findFirst({
    where: { id: loteId, propriedade: { status: "ATIVO" } },
    select: { id: true },
  });
  if (!lote) {
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

async function listar() {
  const sensores = await prisma.sensor.findMany({
    where: { status: "ATIVO" },
    orderBy: { codigo: "asc" },
    select: SELECAO,
  });
  return sensores.map(formatar);
}

async function buscarPorId(id) {
  // Sensor INATIVO conta como excluido: responde 404 como se nao existisse.
  const sensor = await prisma.sensor.findFirst({
    where: { id, status: "ATIVO" },
    select: SELECAO,
  });
  if (!sensor) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  return formatar(sensor);
}

async function criar(dados) {
  await garantirLote(dados.loteId);
  try {
    return formatar(await prisma.sensor.create({ data: dados, select: SELECAO }));
  } catch (erro) {
    throw traduzirCodigoRepetido(erro);
  }
}

async function atualizar(id, dados) {
  // Primeiro o 404: nao adianta validar o lote de um sensor que nao existe.
  const existe = await prisma.sensor.findFirst({ where: { id, status: "ATIVO" }, select: { id: true } });
  if (!existe) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

  await garantirLote(dados.loteId);
  try {
    return formatar(await prisma.sensor.update({ where: { id }, data: dados, select: SELECAO }));
  } catch (erro) {
    throw traduzirCodigoRepetido(erro);
  }
}

async function remover(id) {
  // Exclusao logica: as leituras futuras dependem do sensor, entao a linha fica no banco.
  const { count } = await prisma.sensor.updateMany({
    where: { id, status: "ATIVO" },
    data: { status: "INATIVO" },
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
