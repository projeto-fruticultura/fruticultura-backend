const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroPropriedade, filtroRotaLogistica } = require("./escopoDono");

// Limite do Int do Postgres: o skip da pagina nunca passa disso (ver listar).
const MAIOR_INT = 2147483647;
const ERRO_NAO_ENCONTRADO = "Rota logística não encontrada.";

// Campos do modelo RotaLogistica. O dono nao aparece: ele e o da propriedade.
const SELECAO = {
  id: true,
  propriedadeId: true,
  origem: true,
  destino: true,
  modal: true,
  tempoEstimadoHoras: true,
  custo: true,
  transportadora: true,
  situacao: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
};

// Quem pode ver o registro: dono da propriedade (ou ADMIN), registro ATIVO e propriedade ATIVA.
// Registro INATIVO ou de propriedade INATIVA conta como excluido: some da lista e da 404 por id, PUT e DELETE.
// Dentro de AND para um filtro nunca sobrescrever o outro.
function escopo(usuario) {
  return [{ status: "ATIVO" }, { propriedade: { status: "ATIVO" } }, filtroRotaLogistica(usuario)];
}

// O Prisma devolve Decimal (que vira texto no JSON); o front espera numero.
function formatar(rota) {
  return {
    ...rota,
    tempoEstimadoHoras: Number(rota.tempoEstimadoHoras),
    custo: Number(rota.custo),
  };
}

// A propriedade precisa ser do usuario (ou ele ser ADMIN). Segue o cadastro de Lote:
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

// "filtros" ja vem validado (e com pagina e limite preenchidos) do logisticaValidator.
async function listar(usuario, { propriedadeId, modal, situacao, pagina = 1, limite = 20 } = {}) {
  const filtros = [];
  // propriedadeId de outra pessoa nao da erro: o filtro de dono continua valendo e a lista vem vazia.
  if (propriedadeId) filtros.push({ propriedadeId });
  if (modal) filtros.push({ modal });
  if (situacao) filtros.push({ situacao });

  // O escopo de dono entra SEMPRE; o dono nunca vem da query nem do body.
  const where = { AND: [...escopo(usuario), ...filtros] };
  // Pagina gigante nao estoura o Int do Prisma: a tabela nunca tera tantas linhas, a lista sai vazia.
  const skip = Math.min((pagina - 1) * limite, MAIOR_INT);

  // Lista e contagem na mesma transacao, com o mesmo where.
  const [rotas, total] = await prisma.$transaction([
    prisma.rotaLogistica.findMany({ where, orderBy: { id: "asc" }, skip, take: limite, select: SELECAO }),
    prisma.rotaLogistica.count({ where }),
  ]);

  return {
    dados: rotas.map(formatar),
    paginacao: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
  };
}

async function buscarPorId(id, usuario) {
  // Registro de outra pessoa, INATIVO ou de propriedade INATIVA: 404, como se nao existisse.
  // 404 (e nao 403) para nao revelar que o id existe.
  const rota = await prisma.rotaLogistica.findFirst({ where: { id, AND: escopo(usuario) }, select: SELECAO });
  if (!rota) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  return formatar(rota);
}

// "dados" ja vem do validator, so com os campos permitidos. status nunca vem do cliente: o banco usa ATIVO.
async function criar(dados, usuario) {
  await garantirPropriedade(dados.propriedadeId, usuario);
  return formatar(await prisma.rotaLogistica.create({ data: dados, select: SELECAO }));
}

// PUT parcial: o que nao veio mantem o valor salvo. propriedadeId nunca muda (o validator nem o devolve).
async function atualizar(id, dados, usuario) {
  const filtro = { id, AND: escopo(usuario) };

  const existe = await prisma.rotaLogistica.findFirst({ where: filtro, select: { id: true } });
  if (!existe) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);

  if (Object.keys(dados).length > 0) {
    // updateMany com o filtro de dono no where: a regra vale na propria gravacao.
    const { count } = await prisma.rotaLogistica.updateMany({ where: filtro, data: dados });
    if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
  }
  return buscarPorId(id, usuario);
}

// Exclusao logica: a linha nunca e apagada. Nao ha rota de reativar.
// O filtro de escopo exige o registro ATIVO, entao uma segunda tentativa de excluir da 404.
async function remover(id, usuario) {
  const { count } = await prisma.rotaLogistica.updateMany({
    where: { id, AND: escopo(usuario) },
    data: { status: "INATIVO" },
  });
  if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADO);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
