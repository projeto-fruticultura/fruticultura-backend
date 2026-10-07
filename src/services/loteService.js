const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroPropriedade, filtroLoteAtivo } = require("./escopoDono");
const { lancarSeDatasInvertidas } = require("../validators/loteValidator");

const ERRO_NAO_ENCONTRADO = "Lote não encontrado.";

// Campos do modelo Lote, mais a cultura (so o que a tela precisa) e a contagem de sensores.
const SELECAO = {
  id: true,
  identificacao: true,
  area: true,
  dataPlantacao: true,
  colheitaEstimada: true,
  situacao: true,
  status: true,
  latitude: true,
  longitude: true,
  propriedadeId: true,
  culturaId: true,
  cultura: { select: { id: true, nome: true, variedade: true } },
  // So sensores ATIVO: sensor excluido (INATIVO) nao conta, como na lista de propriedades.
  _count: { select: { sensores: { where: { status: "ATIVO" } } } },
};

// Quem pode ver o lote: dono da propriedade (ou ADMIN), lote ATIVO e propriedade ATIVA.
// Lote INATIVO ou de propriedade INATIVA conta como excluido: some da lista e da 404 por id, PUT e DELETE.
// O filtro de lote ATIVO e so das rotas de Lotes (filtroLoteAtivo): sensores e leituras
// de um lote inativo continuam visiveis, para nao esconder o historico.
// Dentro de AND para um filtro nunca sobrescrever o outro.
function escopo(usuario) {
  return [filtroLoteAtivo(usuario), { propriedade: { status: "ATIVO" } }];
}

// O Prisma devolve Decimal (que vira texto no JSON); o front espera numero (ou null, sem coordenadas).
// As datas sao @db.Date, gravadas a meia-noite UTC: os 10 primeiros caracteres sao o dia certo.
function formatar(lote) {
  const { _count, ...campos } = lote;
  return {
    ...campos,
    area: Number(campos.area),
    dataPlantacao: campos.dataPlantacao.toISOString().slice(0, 10),
    colheitaEstimada: campos.colheitaEstimada ? campos.colheitaEstimada.toISOString().slice(0, 10) : null,
    latitude: campos.latitude === null ? null : Number(campos.latitude),
    longitude: campos.longitude === null ? null : Number(campos.longitude),
    totalSensores: _count.sensores,
  };
}

// A propriedade precisa ser do usuario (ou ele ser ADMIN). Segue o cadastro de Sensor com o lote:
// inexistente ou de outra pessoa: 404, a mesma resposta nos dois casos (nao revela quais ids existem);
// visivel mas INATIVA: 400, porque a propriedade foi excluida.
async function garantirPropriedade(propriedadeId, usuario) {
  const propriedade = await prisma.propriedade.findFirst({
    where: { id: propriedadeId, AND: [filtroPropriedade(usuario)] },
    select: { status: true },
  });
  const erro = { propriedadeId: "propriedade não encontrada." };
  if (!propriedade) throw new ErroHttp(404, "Propriedade não encontrada.", erro);
  if (propriedade.status !== "ATIVO") throw new ErroHttp(400, "Propriedade não encontrada.", erro);
}

// Cultura nao tem dono (e um cadastro geral): inexistente e 404, como o lote no cadastro de Sensor.
async function garantirCultura(culturaId) {
  const cultura = await prisma.cultura.findUnique({ where: { id: culturaId }, select: { id: true } });
  if (!cultura) throw new ErroHttp(404, "Cultura não encontrada.", { culturaId: "cultura não encontrada." });
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
  // Lote de outra pessoa, INATIVO ou de propriedade INATIVA: 404, como se nao existisse.
  // 404 (e nao 403) para nao revelar que o id existe.
  const lote = await prisma.lote.findFirst({
    where: { id, AND: escopo(usuario) },
    select: SELECAO,
  });
  if (!lote) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  return formatar(lote);
}

// "dados" ja vem do validator, so com os campos permitidos. status nunca vem do cliente: o banco usa ATIVO.
async function criar(dados, usuario) {
  await garantirPropriedade(dados.propriedadeId, usuario);
  await garantirCultura(dados.culturaId);
  return formatar(await prisma.lote.create({ data: dados, select: SELECAO }));
}

// PUT parcial: o que nao veio mantem o valor salvo. propriedadeId nunca muda (o validator nem o devolve).
async function atualizar(id, dados, usuario) {
  const filtro = { id, AND: escopo(usuario) };

  const salvo = await prisma.lote.findFirst({ where: filtro, select: { dataPlantacao: true, colheitaEstimada: true } });
  if (!salvo) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

  // A regra das datas vale sobre o resultado final: o que veio combinado com o que ja esta salvo.
  lancarSeDatasInvertidas(
    dados.dataPlantacao ?? salvo.dataPlantacao,
    dados.colheitaEstimada === undefined ? salvo.colheitaEstimada : dados.colheitaEstimada
  );
  if (dados.culturaId !== undefined) await garantirCultura(dados.culturaId);

  if (Object.keys(dados).length > 0) {
    // updateMany com o filtro de dono no where: a regra vale na propria gravacao.
    const { count } = await prisma.lote.updateMany({ where: filtro, data: dados });
    if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  }
  return buscarPorId(id, usuario);
}

// Exclusao logica: a linha nunca e apagada (preserva o historico de leituras). Nao ha rota de reativar.
// Lote sem sensores ATIVOS: inativa direto. Com sensores ATIVOS: 409 com a contagem, a menos que
// confirmar seja true; ai os sensores ATIVOS e o lote viram INATIVOS numa unica transacao (tudo ou nada).
async function remover(id, usuario, { confirmar = false } = {}) {
  await prisma.$transaction(async (tx) => {
    const lote = await tx.lote.findFirst({
      where: { id, AND: escopo(usuario) },
      select: { _count: { select: { sensores: { where: { status: "ATIVO" } } } } },
    });
    if (!lote) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

    const totalSensores = lote._count.sensores;
    if (totalSensores > 0 && !confirmar) {
      throw new ErroHttp(
        409,
        `O lote tem ${totalSensores} sensor(es) ativo(s). Para inativar o lote e os sensores, repita com ?confirmar=true.`,
        undefined,
        { totalSensores }
      );
    }

    await tx.sensor.updateMany({ where: { loteId: id, status: "ATIVO" }, data: { status: "INATIVO" } });
    const { count } = await tx.lote.updateMany({ where: { id, status: "ATIVO" }, data: { status: "INATIVO" } });
    // Se o lote sumiu entre a consulta e a gravacao, o erro desfaz tambem a inativacao dos sensores.
    if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  });
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
