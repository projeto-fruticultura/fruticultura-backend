const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { filtroSensor } = require("./escopoDono");
const { escopoLeitura, garantirSensorVisivel, garantirLoteVisivel } = require("./leituraService");
const alertaService = require("./alertaService");

// Janela das medias do resumo: as ultimas 24 horas a partir de agora.
const JANELA_MEDIAS_HORAS = 24;

// Filtros de id (opcionais) como condicoes sobre o SENSOR; o resumo e o medias usam as mesmas.
// Para filtrar leituras, basta embrulhar cada uma em { sensor: ... }.
function filtrosDeSensor({ sensorId, loteId, propriedadeId, culturaId }) {
  const filtros = [];
  if (sensorId) filtros.push({ id: sensorId });
  if (loteId) filtros.push({ loteId });
  if (propriedadeId) filtros.push({ lote: { propriedadeId } });
  if (culturaId) filtros.push({ lote: { culturaId } });
  return filtros;
}

// O "agora" so vem de sensor, lote e propriedade ATIVOS (o mesmo conjunto dos alertas):
// algo desativado nao pode aparecer como a situacao de hoje. (O historico continua incluindo os inativos.)
const SENSOR_ATIVO = { status: "ATIVO", lote: { status: "ATIVO", propriedade: { status: "ATIVO" } } };

const arredondar = (numero) => Math.round(Number(numero) * 100) / 100;

// Resumo do "agora": a leitura mais recente, quantos alertas existem, quantos sensores ativos, o total de leituras
// e as medias das ultimas 24 h, no escopo do usuario.
// O dono vem sempre do token (usuario), nunca da query. sensorId e loteId de outra pessoa e inexistentes
// dao o mesmo 404; propriedadeId e culturaId fora do escopo (ou inexistentes) dao resposta vazia, sem erro.
async function resumo(usuario, { propriedadeId, loteId, culturaId, sensorId } = {}) {
  if (sensorId) await garantirSensorVisivel(sensorId, usuario);
  if (loteId) await garantirLoteVisivel(loteId, usuario);

  const filtrosSensor = filtrosDeSensor({ sensorId, loteId, propriedadeId, culturaId });
  const filtrosLeitura = filtrosSensor.map((filtro) => ({ sensor: filtro }));

  // Janela das medias: de 24 h atras ate agora (leitura com data no futuro nao entra).
  const ate = new Date();
  const de = new Date(ate.getTime() - JANELA_MEDIAS_HORAS * 60 * 60 * 1000);

  const [ultima, alertas, sensoresAtivos, totalLeituras, medias] = await Promise.all([
    prisma.leitura.findFirst({
      where: { AND: [...escopoLeitura(usuario), { sensor: SENSOR_ATIVO }, ...filtrosLeitura] },
      // Mais recente primeiro; o id desempata leituras com o mesmo instante.
      orderBy: [{ dataHoraLeitura: "desc" }, { id: "desc" }],
      select: {
        sensorId: true,
        temperatura: true,
        umidade: true,
        dataHoraLeitura: true,
        sensor: { select: { codigo: true } },
      },
    }),
    alertaService.listar(usuario, { propriedadeId, loteId, culturaId, sensorId }),
    // Mesmo conjunto "ativos" da ultima leitura.
    prisma.sensor.count({
      where: {
        AND: [filtroSensor(usuario), { lote: { propriedade: { status: "ATIVO" } } }, SENSOR_ATIVO, ...filtrosSensor],
      },
    }),
    // Historico inteiro, o MESMO conjunto do GET /leituras (inclui sensor e lote inativos): bate com paginacao.total.
    prisma.leitura.count({ where: { AND: [...escopoLeitura(usuario), ...filtrosLeitura] } }),
    // Medias das ultimas 24 h no conjunto "ativos". Sem leitura na janela, _avg vem null (nunca 0).
    prisma.leitura.aggregate({
      where: {
        AND: [
          ...escopoLeitura(usuario),
          { sensor: SENSOR_ATIVO },
          ...filtrosLeitura,
          { dataHoraLeitura: { gte: de, lte: ate } },
        ],
      },
      _avg: { temperatura: true, umidade: true },
    }),
  ]);

  return {
    ultimaLeitura: ultima
      ? {
          sensorId: ultima.sensorId,
          sensorCodigo: ultima.sensor.codigo,
          temperatura: ultima.temperatura,
          umidade: ultima.umidade,
          dataHoraLeitura: ultima.dataHoraLeitura.toISOString(),
        }
      : null,
    totalAlertas: alertas.total,
    sensoresAtivos,
    totalLeituras,
    temperaturaMedia: medias._avg.temperatura === null ? null : arredondar(medias._avg.temperatura),
    umidadeMedia: medias._avg.umidade === null ? null : arredondar(medias._avg.umidade),
    janelaMediasHoras: JANELA_MEDIAS_HORAS,
  };
}

// Medias de temperatura e umidade por hora ou por dia (em Recife). "filtros" ja vem validado.
async function medias(usuario, { agrupar, unidade, propriedadeId, loteId, culturaId, sensorId, de, ate }) {
  if (sensorId) await garantirSensorVisivel(sensorId, usuario);
  if (loteId) await garantirLoteVisivel(loteId, usuario);

  const resposta = (dados) => ({
    agrupar,
    fuso: "America/Recife",
    de: de.toISOString(),
    ate: ate.toISOString(),
    dados,
  });

  // 1) Descobre os sensores visiveis com o Prisma: a regra de dono fica so em escopoDono, nunca copiada para SQL.
  // Mesmo escopo do GET /leituras: nao filtra status do sensor nem do lote, para o historico continuar visivel.
  const filtros = filtrosDeSensor({ sensorId, loteId, propriedadeId, culturaId });

  const sensores = await prisma.sensor.findMany({
    where: { AND: [filtroSensor(usuario), { lote: { propriedade: { status: "ATIVO" } } }, ...filtros] },
    select: { id: true },
  });
  const ids = sensores.map((sensor) => sensor.id);
  if (ids.length === 0) return resposta([]);

  // 2) Uma unica consulta, so com valores parametrizados (nada de texto do usuario dentro do SQL).
  // "unidade" ('hour' ou 'day') vem de uma lista fechada do validator.
  // A coluna dataHoraLeitura e TIMESTAMP sem fuso e o Prisma grava UTC nela. Por isso a conversao tem dois passos:
  // AT TIME ZONE 'UTC' diz "isto e UTC" e AT TIME ZONE 'America/Recife' converte para a hora de Recife.
  // Usar so o segundo passo trataria o valor como se ja fosse hora de Recife e erraria 3 horas.
  // De/ate vao como texto ISO com ::timestamp. O "Z" e ignorado de proposito nesse tipo, e o texto e sempre UTC
  // (toISOString), entao o valor casa com o que esta gravado, sem depender do fuso da sessao do Postgres.
  const linhas = await prisma.$queryRaw(Prisma.sql`
    SELECT date_trunc(${unidade}, ("dataHoraLeitura" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Recife') AS periodo,
           AVG("temperatura") AS "temperaturaMedia",
           AVG("umidade") AS "umidadeMedia",
           COUNT(*)::int AS quantidade
    FROM "Leitura"
    WHERE "sensorId" IN (${Prisma.join(ids)})
      AND "dataHoraLeitura" >= ${de.toISOString()}::timestamp
      AND "dataHoraLeitura" <= ${ate.toISOString()}::timestamp
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return resposta(
    linhas.map((linha) => ({
      // O Postgres devolve a hora local de Recife SEM fuso, e o Prisma a entrega como um Date que "parece UTC".
      // Entao os campos do Date ja sao a hora de Recife: e so escrever o deslocamento fixo -03:00
      // (Recife nao tem horario de verao).
      periodo: linha.periodo.toISOString().slice(0, 19) + "-03:00",
      temperaturaMedia: arredondar(linha.temperaturaMedia),
      umidadeMedia: arredondar(linha.umidadeMedia),
      quantidade: Number(linha.quantidade),
    }))
  );
}

module.exports = { resumo, medias };
