const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const openMeteoService = require("./openMeteoService");
const mercadoService = require("./mercadoService");
const ibgeService = require("./ibgeService");
const { PRODUTOS_ACEITOS } = require("../validators/mercadoValidator");

const ERRO_NAO_ENCONTRADA = "Cultura não encontrada.";
const AVISO_SEM_COTACAO = "Sem cotação da CONAB para esta cultura.";
const AVISO_COTACAO_INDISPONIVEL = "Cotação de mercado indisponível no momento.";
const AVISO_CLIMA_INDISPONIVEL = "Clima atual indisponível no momento.";

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

// Cotacao da CONAB para a cultura. O nome da cultura (sem acento, em maiusculas) precisa ser um dos produtos
// aceitos pelo mercado; se nao for, a consulta nem e feita. Se a consulta falhar (503 ou qualquer erro), a
// cotacao vem null com um aviso: o resto dos detalhes continua valendo. Nunca se inventa preco.
// No log vai so a mensagem curta, nunca o objeto de erro inteiro.
async function obterCotacao(nomeCultura, uf) {
  const produto = mercadoService.semAcento(nomeCultura);
  if (!PRODUTOS_ACEITOS.includes(produto)) {
    return { cotacaoMercado: null, avisoMercado: AVISO_SEM_COTACAO };
  }
  try {
    return { cotacaoMercado: await mercadoService.consultarPrecos({ produto, uf, limite: 5 }) };
  } catch (erro) {
    console.error(`Cotação da CONAB indisponível para ${produto}: ${erro.message}`);
    return { cotacaoMercado: null, avisoMercado: AVISO_COTACAO_INDISPONIVEL };
  }
}

async function obterDetalhesCompletos(culturaId, latitude, longitude, uf = "PE") {
  const cultura = await prisma.cultura.findUnique({
    where: { id: Number(culturaId) },
  });

  if (!cultura) throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);

  // 1. Clima (Open-Meteo). Se falhar, o clima e os alertas vem null com um aviso e o resto segue valendo:
  // sem clima nao da para calcular alerta, e nunca se inventa valor. No log vai so a mensagem curta.
  let clima = null;
  let alertas = null;
  try {
    clima = await openMeteoService.obterClimaAtual(latitude, longitude);
    alertas = {
      temperaturaForaDoRango:
        clima.temperaturaAtual < Number(cultura.temperaturaMin) ||
        clima.temperaturaAtual > Number(cultura.temperaturaMax),
      umidadeForaDoRango:
        clima.umidadeAtual < Number(cultura.umidadeMin) ||
        clima.umidadeAtual > Number(cultura.umidadeMax),
    };
  } catch (erro) {
    console.error(`Clima do Open-Meteo indisponível: ${erro.message}`);
    clima = null;
    alertas = null;
  }

  // 2. Cotação de mercado (CONAB); se faltar, o resto da resposta segue normal
  const { cotacaoMercado, avisoMercado } = await obterCotacao(cultura.nome, uf);

  // 3. Estatísticas (IBGE Nacional)
  const estatisticas = await ibgeService.obterEstatisticasNacionais();

  return {
    cultura: formatar(cultura),
    condicoesAtuais: clima,
    alertas,
    cotacaoMercado,
    estatisticasAgricolas: estatisticas,
    // Os avisos so aparecem quando falta a cotacao ou o clima.
    ...(avisoMercado ? { avisoMercado } : {}),
    ...(clima ? {} : { avisoClima: AVISO_CLIMA_INDISPONIVEL }),
  };
}

module.exports = { listar, buscarPorId, criar, atualizar, remover, obterDetalhesCompletos };
