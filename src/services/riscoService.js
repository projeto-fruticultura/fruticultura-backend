const prisma = require("../config/prisma");

const GAP_MS = 15 * 60_000;

function calcular(
  leituras,
  cultura,
  temperaturaBase = null
) {
  const regras = {
    TEMPERATURA_ALTA: (leitura) =>
      leitura.temperatura >
      Number(cultura.temperaturaMax),

    TEMPERATURA_BAIXA: (leitura) =>
      leitura.temperatura <
      Number(cultura.temperaturaMin),

    UMIDADE_ALTA: (leitura) =>
      leitura.umidade >
      Number(cultura.umidadeMax),

    UMIDADE_BAIXA: (leitura) =>
      leitura.umidade <
      Number(cultura.umidadeMin),
  };

  const unicas = new Map(
    leituras.map((leitura) => [
      new Date(leitura.dataHoraLeitura).getTime(),
      leitura,
    ])
  );

  const ordenadas = [...unicas.values()].sort(
    (a, b) =>
      new Date(a.dataHoraLeitura) -
      new Date(b.dataHoraLeitura)
  );

  const alertas = [];

  let observadasMs = 0;
  let foraMs = 0;
  let grausDiaObservados = 0;

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const atual = ordenadas[i];

    const intervalo =
      new Date(atual.dataHoraLeitura) -
      new Date(anterior.dataHoraLeitura);

    if (intervalo <= 0 || intervalo > GAP_MS) {
      continue;
    }

    observadasMs += intervalo;

    const foraDaFaixa = Object.values(regras).some(
      (regra) => regra(anterior) && regra(atual)
    );

    if (foraDaFaixa) {
      foraMs += intervalo;
    }

    if (temperaturaBase !== null) {
      const temperaturaMedia =
        (anterior.temperatura + atual.temperatura) / 2;

      grausDiaObservados +=
        Math.max(
          0,
          temperaturaMedia - temperaturaBase
        ) *
        (intervalo / 86_400_000);
    }
  }

  for (const [tipo, critica] of Object.entries(regras)) {
    let inicio = null;
    let anterior = null;

    for (const leitura of ordenadas) {
      const instante =
        new Date(leitura.dataHoraLeitura);

      if (!critica(leitura)) {
        inicio = null;
        anterior = instante;
        continue;
      }

      if (
        !inicio ||
        !anterior ||
        instante - anterior > GAP_MS
      ) {
        inicio = instante;
      }

      anterior = instante;

      const duracaoMinutos =
        (instante - inicio) / 60_000;

      const classificacoes = [
        ["MODERADO", 120],
        ["ALTO", 360],
      ];

      for (const [nivel, minimo] of classificacoes) {
        if (duracaoMinutos < minimo) {
          continue;
        }

        const existente = alertas.find(
          (alerta) =>
            alerta.tipo === tipo &&
            alerta.nivel === nivel &&
            alerta.inicio.getTime() ===
              inicio.getTime()
        );

        if (existente) {
          existente.fim = instante;
          existente.duracaoMinutos =
            duracaoMinutos;
        } else {
          alertas.push({
            tipo,
            nivel,
            inicio,
            fim: instante,
            duracaoMinutos,
          });
        }
      }
    }
  }

  return {
    alertas,

    horasObservadas:
      observadasMs / 3_600_000,

    horasForaFaixa:
      foraMs / 3_600_000,

    adequacaoPercentual:
      observadasMs > 0
        ? 100 * (1 - foraMs / observadasMs)
        : null,

    grausDiaObservados:
      temperaturaBase === null
        ? null
        : grausDiaObservados,
  };
}

async function persistir(sensorId) {
  return prisma.$transaction(
    async (tx) => {
      // Serializa o recálculo do mesmo sensor.
      await tx.$queryRaw`
        SELECT 1::int AS locked
        FROM pg_advisory_xact_lock(
          ${sensorId}::bigint
        )
      `;

      const sensor = await tx.sensor.findUnique({
        where: {
          id: sensorId,
        },

        include: {
          lote: {
            include: {
              cultura: true,
            },
          },
        },
      });

      if (!sensor) {
        return;
      }

      const leituras =
        await tx.leitura.findMany({
          where: {
            sensorId,
          },

          orderBy: {
            dataHoraLeitura: "asc",
          },
        });

      const resultado = calcular(
        leituras,
        sensor.lote.cultura
      );

      const chaves =
        resultado.alertas.map((alerta) => ({
          tipo: alerta.tipo,
          inicio: alerta.inicio,
          nivel: alerta.nivel,
        }));

      // Remove episódios que deixaram de ser válidos
      // após chegada de leituras atrasadas.
      await tx.alertaRisco.deleteMany({
        where: {
          sensorId,

          ...(chaves.length > 0
            ? {
                NOT: {
                  OR: chaves,
                },
              }
            : {}),
        },
      });

      for (const alerta of resultado.alertas) {
        const chave = {
          sensorId,
          tipo: alerta.tipo,
          inicio: alerta.inicio,
          nivel: alerta.nivel,
        };

        await tx.alertaRisco.upsert({
          where: {
            sensorId_tipo_inicio_nivel: chave,
          },

          create: {
            sensorId,
            ...alerta,
          },

          update: {
            fim: alerta.fim,
            duracaoMinutos:
              alerta.duracaoMinutos,
          },
        });
      }

      return resultado;
    },

    {
      timeout: 30_000,
    }
  );
}

module.exports = {
  calcular,
  persistir,
};