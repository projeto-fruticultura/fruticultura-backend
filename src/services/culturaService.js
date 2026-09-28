const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const openMeteoService = require("./openMeteoService");
const mercadoService = require("./mercadoService");
const ibgeService = require("./ibgeService");

const ERRO_NAO_ENCONTRADA = "Cultura não encontrada.";

function erroPrisma(erro, codigo) {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === codigo;
}

// O Prisma devolve Decimal (que vira texto no JSON); o front espera numero.
function formatar(cultura) {
  return {
    ...cultura,
    temperaturaMin: Number(cultura.temperaturaMin),
    temperaturaMax: Number(cultura.temperaturaMax),
    umidadeMin: Number(cultura.umidadeMin),
    umidadeMax: Number(cultura.umidadeMax),
  };
}

function erroEmUso(totalLotes) {
  return new ErroHttp(409, `Cultura em uso por ${totalLotes} lote(s).`);
}

async function listar() {
  const culturas = await prisma.cultura.findMany({ orderBy: { nome: "asc" } });
  return culturas.map(formatar);
}

async function buscarPorId(id) {
  const cultura = await prisma.cultura.findUnique({ where: { id } });
  if (!cultura) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
  return formatar(cultura);
}

// "dados" ja vem do validator, so com os campos permitidos.
async function criar(dados) {
  return formatar(await prisma.cultura.create({ data: dados }));
}

async function atualizar(id, dados) {
  try {
    return formatar(await prisma.cultura.update({ where: { id }, data: dados }));
  } catch (erro) {
    // P2025: o registro a atualizar nao existe.
    if (erroPrisma(erro, "P2025")) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
    throw erro;
  }
}

async function remover(id) {
  const cultura = await prisma.cultura.findUnique({
    where: { id },
    select: { _count: { select: { lotes: true } } },
  });
  if (!cultura) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
  // Decisao do grupo: cultura com lotes nao pode ser apagada.
  if (cultura._count.lotes > 0) throw erroEmUso(cultura._count.lotes);

  try {
    // Cultura nao tem status, entao a exclusao e de verdade.
    // deleteMany nao lanca erro se outra requisicao apagou antes; o count indica isso.
    const { count } = await prisma.cultura.deleteMany({ where: { id } });
    if (count === 0) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
  } catch (erro) {
    // P2003: um lote foi ligado a cultura entre a contagem e o delete.
    if (erroPrisma(erro, "P2003")) {
      throw erroEmUso(await prisma.lote.count({ where: { culturaId: id } }));
    }
    throw erro;
  }
}

async function obterDetalhesCompletos(culturaId, latitude, longitude) {
  const cultura = await prisma.cultura.findUnique({
    where: { id: Number(culturaId) },
  });

  if (!cultura) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);

  // 1. Clima (Open-Meteo)
  const clima = await openMeteoService.obterClimaAtual(latitude, longitude);

  const alertaTemperatura =
    clima.temperaturaAtual < Number(cultura.temperaturaMin) ||
    clima.temperaturaAtual > Number(cultura.temperaturaMax);

  const alertaUmidade =
    clima.umidadeAtual < Number(cultura.umidadeMin) ||
    clima.umidadeAtual > Number(cultura.umidadeMax);

  // 2. Preços Reais (Mercado Livre API)
  const mercado = await mercadoService.obterPrecosReais(cultura.nome);

  // 3. Estatísticas (IBGE Nacional)
  const estatisticas = await ibgeService.obterEstatisticasNacionais();

  return {
    cultura: formatar(cultura),
    condicoesAtuais: clima,
    alertas: {
      temperaturaForaDoRango: alertaTemperatura,
      umidadeForaDoRango: alertaUmidade,
    },
    cotacaoMercado: mercado,
    estatisticasAgricolas: estatisticas
  };
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, obterDetalhesCompletos };
