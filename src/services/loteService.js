const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroLote } = require("./escopoDono");

const ERRO_NAO_ENCONTRADO = "Lote não encontrado.";

// Campos do modelo Lote, mais a cultura (so o que a tela precisa) e a contagem de sensores.
const SELECAO = {
  id: true,
  identificacao: true,
  area: true,
  dataPlantacao: true,
  colheitaEstimada: true,
  situacao: true,
  propriedadeId: true,
  culturaId: true,
  cultura: { select: { id: true, nome: true, variedade: true } },
  // So sensores ATIVO: sensor excluido (INATIVO) nao conta, como na lista de propriedades.
  _count: { select: { sensores: { where: { status: "ATIVO" } } } },
};

// Quem pode ver o lote: dono da propriedade (ou ADMIN) e propriedade ATIVA.
// Lote de propriedade INATIVA conta como excluido: some da lista e da 404 por id.
// Dentro de AND para um filtro nunca sobrescrever o outro.
function escopo(usuario) {
  return [filtroLote(usuario), { propriedade: { status: "ATIVO" } }];
}

// O Prisma devolve Decimal (que vira texto no JSON); o front espera numero.
// As datas sao @db.Date, gravadas a meia-noite UTC: os 10 primeiros caracteres sao o dia certo.
function formatar(lote) {
  const { _count, ...campos } = lote;
  return {
    ...campos,
    area: Number(campos.area),
    dataPlantacao: campos.dataPlantacao.toISOString().slice(0, 10),
    colheitaEstimada: campos.colheitaEstimada ? campos.colheitaEstimada.toISOString().slice(0, 10) : null,
    totalSensores: _count.sensores,
  };
}

async function listar(usuario, { propriedadeId } = {}) {
  const lotes = await prisma.lote.findMany({
    // propriedadeId de outra pessoa nao da erro: o filtro de dono continua valendo e a lista vem vazia.
    where: { AND: escopo(usuario), ...(propriedadeId ? { propriedadeId } : {}) },
    orderBy: { id: "asc" },
    select: SELECAO,
  });
  return lotes.map(formatar);
}

async function buscarPorId(id, usuario) {
  // Lote de outra pessoa (ou de propriedade INATIVA): 404, como se nao existisse.
  // 404 (e nao 403) para nao revelar que o id existe.
  const lote = await prisma.lote.findFirst({
    where: { id, AND: escopo(usuario) },
    select: SELECAO,
  });
  if (!lote) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  return formatar(lote);
}

module.exports = { listar, buscarPorId };
