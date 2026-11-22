const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { filtroLote } = require("./escopoDono");
const { avaliarLimites } = require("./alertaService");
const { temperaturaValida, umidadeValida } = require("./regrasNumericas");

const UMA_HORA_MS = 3_600_000;
const dataRecife = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

async function areas(usuario, propriedadeId, agora) {
  const lotes = await prisma.lote.findMany({
    where: {
      propriedadeId,
      status: "ATIVO",
      AND: [filtroLote(usuario), { propriedade: { status: "ATIVO" } }],
    },
    select: {
      area: true,
      cultura: {
        select: { temperaturaMin: true, temperaturaMax: true, umidadeMin: true, umidadeMax: true },
      },
      sensores: { where: { status: "ATIVO" }, select: { id: true } },
    },
  });

  const sensores = lotes.flatMap((lote) => lote.sensores.map(({ id }) => id));
  const ultimas = new Map();
  for (let cursor = 0; cursor < sensores.length; cursor += 1000) {
    const ids = sensores.slice(cursor, cursor + 1000);
    const leituras = await prisma.$queryRaw`
      SELECT leitura."sensorId", leitura."dataHoraLeitura", leitura.temperatura, leitura.umidade
      FROM unnest(ARRAY[${Prisma.join(ids)}]::int[]) AS sensor(id)
      CROSS JOIN LATERAL (
        SELECT "sensorId", "dataHoraLeitura", temperatura, umidade FROM "Leitura"
        WHERE "sensorId" = sensor.id ORDER BY "dataHoraLeitura" DESC LIMIT 1
      ) AS leitura
    `;
    for (const leitura of leituras) ultimas.set(leitura.sensorId, leitura);
  }

  const hectares = { protecao: 0, risco: 0, semDados: 0 };
  for (const lote of lotes) {
    let verificados = 0;
    let risco = false;
    for (const { id } of lote.sensores) {
      const leitura = ultimas.get(id);
      if (!leitura) continue;
      const idade = +agora - +leitura.dataHoraLeitura;
      if (idade < 0 || idade > UMA_HORA_MS ||
          !temperaturaValida(leitura.temperatura) || !umidadeValida(leitura.umidade)) continue;
      verificados += 1;
      if (avaliarLimites(leitura, lote.cultura, agora).length > 0) risco = true;
    }

    // Um sensor recente fora da faixa indica risco. Para proteção todos devem ser verificados.
    const classificacao = risco ? "risco"
      : verificados > 0 && verificados === lote.sensores.length ? "protecao" : "semDados";
    hectares[classificacao] += Math.round(Number(lote.area) * 100);
  }

  return {
    protecao: hectares.protecao / 100,
    risco: hectares.risco / 100,
    semDados: hectares.semDados / 100,
  };
}

async function alertasDoDia(usuario, propriedadeId, agora) {
  const inicioDia = new Date(`${dataRecife.format(agora)}T00:00:00-03:00`);
  // Um episódio pode mudar de nível. Contamos uma vez por sensor, tipo e início.
  const episodios = await prisma.alertaRisco.groupBy({
    by: ["sensorId", "tipo", "inicio"],
    where: {
      inicio: { lte: agora },
      fim: { gte: inicioDia },
      sensor: {
        lote: { propriedadeId, AND: [filtroLote(usuario)] },
      },
    },
  });
  return { total: episodios.length, inicioDia: inicioDia.toISOString(), fuso: "America/Recife" };
}

module.exports = { areas, alertasDoDia };
