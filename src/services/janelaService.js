const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { filtroLote } = require("./escopoDono");
const { obterPrevisao } = require("./previsaoJanelaService");
const { calcularJanelas } = require("./motorJanelas");

async function consultar(
  loteId,
  parametros,
  usuario,
  { fetchImpl, agora = new Date() } = {},
) {
  const lote = await prisma.lote.findFirst({
    where: {
      id: loteId,
      status: "ATIVO",
      AND: [
        filtroLote(usuario),
        { propriedade: { status: "ATIVO" } },
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
    throw new ErroHttp(404, "Lote não encontrado.");
  }

  const sensor = await prisma.sensor.findFirst({
    where: {
      id: parametros.sensorId,
      loteId,
      status: "ATIVO",
    },
    select: { id: true },
  });

  if (!sensor) {
    throw new ErroHttp(
      404,
      "Sensor ativo não encontrado no lote.",
    );
  }

  let rota;

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
        "Rota ativa não encontrada na propriedade do lote.",
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
    },
    orderBy: { dataHoraLeitura: "asc" },
    take: 50001,
  });

  if (leituras.length > 50000) {
    throw new ErroHttp(
      422,
      "Histórico excede 50000 amostras. Informe uma referência térmica consolidada mais recente.",
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
      "Lote/propriedade sem coordenadas para previsão.",
    );
  }

  const latitude = Number(latitudeBruta);
  const longitude = Number(longitudeBruta);

  const previsao = await obterPrevisao(latitude, longitude, {
    fetchImpl,
    agora,
  });

  const resultado = calcularJanelas({
    lote,
    leituras,
    parametros,
    previsao,
    rota,
    agora,
  });

  return {
    loteId,
    sensorId: sensor.id,
    cultura: lote.cultura,
    faseFenologica: lote.faseFenologica,

    coordenadasUtilizadas: {
      latitude,
      longitude,
      origem:
        lote.latitude != null && lote.longitude != null
          ? "LOTE"
          : "PROPRIEDADE",
    },

    ...resultado,
  };
}

module.exports = { consultar };