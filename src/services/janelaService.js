const { randomUUID } = require("node:crypto");

const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroLote } = require("./escopoDono");

const {
  obterPrevisao,
} = require("./previsaoJanelaService");

const {
  calcularJanelas,
} = require("./motorJanelas");

const modeloPython =
  require("./modeloPythonService");

async function carregarContexto(
  loteId,
  parametros,
  usuario,
  {
    fetchImpl,
    agora = new Date(),
  } = {}
) {
  const lote = await prisma.lote.findFirst({
    where: {
      id: loteId,
      status: "ATIVO",

      AND: [
        filtroLote(usuario),
        {
          propriedade: {
            status: "ATIVO",
          },
        },
      ],
    },

    include: {
      propriedade: true,

      cultura: {
        select: {
          nome: true,
          variedade: true,
        },
      },
    },
  });

  if (!lote) {
    throw new ErroHttp(
      404,
      "Lote não encontrado."
    );
  }

  const sensor = await prisma.sensor.findFirst({
    where: {
      id: parametros.sensorId,
      loteId,
      status: "ATIVO",
    },

    select: {
      id: true,
    },
  });

  if (!sensor) {
    throw new ErroHttp(
      404,
      "Sensor ativo não encontrado no lote."
    );
  }

  let rota = null;

  if (parametros.rotaLogisticaId !== undefined) {
    rota = await prisma.rotaLogistica.findFirst({
      where: {
        id: parametros.rotaLogisticaId,
        propriedadeId: lote.propriedadeId,
        status: "ATIVO",
      },

      select: {
        id: true,
        tempoEstimadoHoras: true,
      },
    });

    if (!rota) {
      throw new ErroHttp(
        404,
        "Rota ativa não encontrada na propriedade do lote."
      );
    }
  }

  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);

  const leituras = await prisma.leitura.findMany({
    where: {
      sensorId: sensor.id,

      dataHoraLeitura: {
        gte: parametros.dataHoraReferencia,
        lte: hoje,
      },
    },

    select: {
      dataHoraLeitura: true,
      temperatura: true,
      umidade: true,
    },

    orderBy: {
      dataHoraLeitura: "asc",
    },

    take: 50001,
  });

  if (leituras.length > 50000) {
    throw new ErroHttp(
      422,
      "Histórico excede 50000 amostras. " +
      "Informe uma referência térmica consolidada mais recente."
    );
  }

  const latitudeBruta =
    lote.latitude ?? lote.propriedade.latitude;

  const longitudeBruta =
    lote.longitude ?? lote.propriedade.longitude;

  if (
    latitudeBruta === null ||
    latitudeBruta === undefined ||
    longitudeBruta === null ||
    longitudeBruta === undefined
  ) {
    throw new ErroHttp(
      422,
      "Lote/propriedade sem coordenadas para previsão."
    );
  }

  const latitude = Number(latitudeBruta);
  const longitude = Number(longitudeBruta);

  const previsao = await obterPrevisao(
    latitude,
    longitude,
    {
      fetchImpl,
      agora,
    }
  );

  return {
    lote,
    sensor,
    rota,
    leituras,
    previsao,
    latitude,
    longitude,

    origemCoordenadas:
      lote.latitude != null &&
      lote.longitude != null
        ? "LOTE"
        : "PROPRIEDADE",

    agora,
  };
}

function metadadosContexto(
  loteId,
  parametros,
  contexto
) {
  return {
    loteId,
    sensorId: contexto.sensor.id,
    cultura: contexto.lote.cultura,
    faseFenologica:
      contexto.lote.faseFenologica,

    coordenadasUtilizadas: {
      latitude: contexto.latitude,
      longitude: contexto.longitude,
      origem: contexto.origemCoordenadas,
      estimadasUf: (
        contexto.lote.latitude == null && contexto.lote.propriedade.latitudeEstimadaUf === true
      ) || (
        contexto.lote.longitude == null && contexto.lote.propriedade.longitudeEstimadaUf === true
      ),
    },
  };
}

async function consultar(
  loteId,
  parametros,
  usuario,
  opcoes = {}
) {
  const contexto = await carregarContexto(
    loteId,
    parametros,
    usuario,
    opcoes
  );

  const resultado = calcularJanelas({
    lote: contexto.lote,
    leituras: contexto.leituras,
    parametros,
    previsao: contexto.previsao,
    rota: contexto.rota,
    agora: contexto.agora,
  });

  return {
    ...metadadosContexto(
      loteId,
      parametros,
      contexto
    ),

    ...resultado,
  };
}

function criarContratoPython(
  loteId,
  parametros,
  contexto
) {
  const exportacao =
    parametros.rotaLogisticaId === undefined
      ? null
      : {
          rotaLogisticaId:
            parametros.rotaLogisticaId,

          horasAteResfriamento:
            parametros.horasAteResfriamento,

          vidaUtilHoras:
            parametros.vidaUtilHoras,

          precoInternoKg:
            parametros.precoInternoKg,

          precoExportacaoKg:
            parametros.precoExportacaoKg,

          custoInternoKg:
            parametros.custoInternoKg,

          custoExportacaoKg:
            parametros.custoExportacaoKg,

          cadeiaFrioGarantida:
            parametros.cadeiaFrioGarantida,

          moeda: parametros.moeda,

          dataHoraCotacao:
            parametros.dataHoraCotacao.toISOString(),

          fonteCotacao:
            parametros.fonteCotacao,
        };

  return {
    contractVersion: "1.0",
    requestId: randomUUID(),
    requestedAt: contexto.agora.toISOString(),

    lote: {
      id: contexto.lote.id,
      identificacao:
        contexto.lote.identificacao,

      faseFenologica:
        contexto.lote.faseFenologica,

      cultura: contexto.lote.cultura,

      coordenadas: {
        latitude: contexto.latitude,
        longitude: contexto.longitude,
        origem: contexto.origemCoordenadas,
      },
    },

    sensor: {
      id: contexto.sensor.id,
    },

    parametrosAgronomicos: {
      dataHoraReferencia:
        parametros.dataHoraReferencia.toISOString(),

      grausDiaReferencia:
        parametros.grausDiaReferencia,

      temperaturaBaseC:
        parametros.temperaturaBase,

      grausDiaAlvo:
        parametros.grausDiaAlvo,

      chuvaMaximaMmDia:
        parametros.chuvaMaxMm,

      umidadeArMaximaPercentual:
        parametros.umidadeArMaxPercentual,

      fonte: parametros.fonteParametros,
      versao: parametros.versaoParametros,
    },

    historico: contexto.leituras.map(
      (leitura) => ({
        instante:
          leitura.dataHoraLeitura.toISOString(),

        temperaturaC:
          leitura.temperatura,

        umidadeLegadaPercentual:
          leitura.umidade,

        semanticaUmidade:
          "NAO_IDENTIFICADA_NO_SCHEMA_ATUAL",
      })
    ),

    previsaoDiaria: {
      fonte: contexto.previsao.fonte,
      timezone: contexto.previsao.timezone,

      dias: contexto.previsao.dias.map(
        (dia) => ({
          data: dia.data,

          temperaturaMediaC:
            dia.temperaturaMedia,

          precipitacaoMm:
            dia.chuvaMm,

          umidadeRelativaMediaPercentual:
            dia.umidadeAr,
        })
      ),
    },

    logistica: contexto.rota
      ? {
          rotaId: contexto.rota.id,

          tempoEstimadoHoras: Number(
            contexto.rota.tempoEstimadoHoras
          ),
        }
      : null,

    parametrosExportacao: exportacao,
  };
}

async function consultarPython(
  loteId,
  parametros,
  usuario,
  opcoes = {}
) {
  const contexto = await carregarContexto(
    loteId,
    parametros,
    usuario,
    opcoes
  );

  const payload = criarContratoPython(
    loteId,
    parametros,
    contexto
  );

  const resultado =
    await modeloPython.consultar(
      payload,

      opcoes.fetchImpl
        ? {
            fetchImpl: opcoes.fetchImpl,
          }
        : {}
    );

  return {
    ...metadadosContexto(
      loteId,
      parametros,
      contexto
    ),

    fonteModelo: "SERVICO_PYTHON",

    ...resultado,
  };
}

module.exports = {
  consultar,
  consultarPython,
  criarContratoPython,
};