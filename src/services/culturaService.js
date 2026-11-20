const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");

const openMeteoService = require("./openMeteoService");
const mercadoService = require("./mercadoService");
const ibgeService = require("./ibgeService");

const {
  PRODUTOS_ACEITOS,
} = require("../validators/mercadoValidator");

const ERRO_NAO_ENCONTRADA = "Cultura não encontrada.";

const AVISO_SEM_COTACAO =
  "Sem cotação da CONAB para esta cultura.";

const AVISO_COTACAO_INDISPONIVEL =
  "Cotação de mercado indisponível no momento.";

const AVISO_CLIMA_INDISPONIVEL =
  "Clima atual indisponível no momento.";

function erroPrisma(erro, codigo) {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === codigo
  );
}

// O Prisma devolve Decimal; a API entrega os limites como números.
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
  return new ErroHttp(
    409,
    `Cultura em uso por ${totalLotes} lote(s).`
  );
}

function erroComCotacoes(totalCotacoes) {
  return new ErroHttp(
    409,
    `Cultura possui ${totalCotacoes} cotação(ões) de mercado vinculada(s) e não pode ser excluída para preservar o histórico.`
  );
}

async function listar() {
  const culturas = await prisma.cultura.findMany({
    orderBy: {
      nome: "asc",
    },
  });

  return culturas.map(formatar);
}

async function buscarPorId(id) {
  const cultura = await prisma.cultura.findUnique({
    where: {
      id,
    },
  });

  if (!cultura) {
    throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
  }

  return formatar(cultura);
}

// Os dados recebidos já passaram pelo validator.
async function criar(dados) {
  const cultura = await prisma.cultura.create({
    data: dados,
  });

  return formatar(cultura);
}

async function atualizar(id, dados) {
  try {
    const cultura = await prisma.cultura.update({
      where: {
        id,
      },
      data: dados,
    });

    return formatar(cultura);
  } catch (erro) {
    if (erroPrisma(erro, "P2025")) {
      throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
    }

    throw erro;
  }
}

async function remover(id) {
  const cultura = await prisma.cultura.findUnique({
    where: {
      id,
    },
    select: {
      _count: {
        select: {
          lotes: true,
          cotacoesMercado: true,
        },
      },
    },
  });

  if (!cultura) {
    throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
  }

  // Inclui cotações inativas: elas também fazem parte do histórico.
  if (cultura._count.cotacoesMercado > 0) {
    throw erroComCotacoes(cultura._count.cotacoesMercado);
  }

  if (cultura._count.lotes > 0) {
    throw erroEmUso(cultura._count.lotes);
  }

  try {
    // Cultura não possui status; a exclusão é física.
    // As chaves estrangeiras também impedem apagar registros em uso.
    const { count } = await prisma.cultura.deleteMany({
      where: {
        id,
      },
    });

    if (count === 0) {
      throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
    }
  } catch (erro) {
    // Outra requisição pode vincular um lote ou uma cotação
    // entre a contagem inicial e a tentativa de exclusão.
    if (erroPrisma(erro, "P2003")) {
      const totalCotacoes = await prisma.cotacaoMercado.count({
        where: {
          culturaId: id,
        },
      });

      if (totalCotacoes > 0) {
        throw erroComCotacoes(totalCotacoes);
      }

      const totalLotes = await prisma.lote.count({
        where: {
          culturaId: id,
        },
      });

      if (totalLotes > 0) {
        throw erroEmUso(totalLotes);
      }

      throw new ErroHttp(
        409,
        "Cultura possui registros vinculados e não pode ser excluída."
      );
    }

    throw erro;
  }
}

// Consulta a CONAB somente para produtos reconhecidos.
// Quando a fonte estiver indisponível, retorna null e um aviso.
async function obterCotacao(nomeCultura, uf) {
  const produto = mercadoService.semAcento(nomeCultura);

  if (!PRODUTOS_ACEITOS.includes(produto)) {
    return {
      cotacaoMercado: null,
      avisoMercado: AVISO_SEM_COTACAO,
    };
  }

  try {
    const cotacaoMercado = await mercadoService.consultarPrecos({
      produto,
      uf,
      limite: 5,
    });

    return {
      cotacaoMercado,
    };
  } catch (erro) {
    console.error(
      `Cotação da CONAB indisponível para ${produto}: ${erro.message}`
    );

    return {
      cotacaoMercado: null,
      avisoMercado: AVISO_COTACAO_INDISPONIVEL,
    };
  }
}

async function obterDetalhesCompletos(
  culturaId,
  latitude,
  longitude,
  uf = "PE"
) {
  const cultura = await prisma.cultura.findUnique({
    where: {
      id: Number(culturaId),
    },
  });

  if (!cultura) {
    throw new ErroHttp(404, ERRO_NAO_ENCONTRADA);
  }

  // Clima atual e comparação com os limites da cultura.
  let clima = null;
  let alertas = null;

  try {
    clima = await openMeteoService.obterClimaAtual(
      latitude,
      longitude
    );

    alertas = {
      temperaturaForaDoRango:
        clima.temperaturaAtual < Number(cultura.temperaturaMin) ||
        clima.temperaturaAtual > Number(cultura.temperaturaMax),

      umidadeForaDoRango:
        clima.umidadeAtual < Number(cultura.umidadeMin) ||
        clima.umidadeAtual > Number(cultura.umidadeMax),
    };
  } catch (erro) {
    console.error(
      `Clima do Open-Meteo indisponível: ${erro.message}`
    );

    clima = null;
    alertas = null;
  }

  // Cotação da CONAB.
  const {
    cotacaoMercado,
    avisoMercado,
  } = await obterCotacao(cultura.nome, uf);

  // Estatísticas nacionais do IBGE.
  const estatisticas =
    await ibgeService.obterEstatisticasNacionais();

  return {
    cultura: formatar(cultura),
    condicoesAtuais: clima,
    alertas,
    cotacaoMercado,
    estatisticasAgricolas: estatisticas,

    ...(avisoMercado
      ? {
          avisoMercado,
        }
      : {}),

    ...(clima
      ? {}
      : {
          avisoClima: AVISO_CLIMA_INDISPONIVEL,
        }),
  };
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
  obterDetalhesCompletos,
};