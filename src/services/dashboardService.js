const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { filtroSensor } = require("./escopoDono");
const { escopoLeitura, garantirSensorVisivel } = require("./leituraService");
const alertaService = require("./alertaService");

// Resumo do "agora": a leitura mais recente e quantos alertas existem, no escopo do usuario.
// O dono vem sempre do token (usuario), nunca da query. sensorId de outra pessoa e sensorId inexistente
// dao o mesmo 404; propriedadeId e culturaId fora do escopo (ou inexistentes) dao resposta vazia, sem erro.
async function resumo(usuario, { propriedadeId, culturaId, sensorId } = {}) {
  if (sensorId) await garantirSensorVisivel(sensorId, usuario);

  const filtros = [];
  if (sensorId) filtros.push({ sensorId });
  if (propriedadeId) filtros.push({ sensor: { lote: { propriedadeId } } });
  if (culturaId) filtros.push({ sensor: { lote: { culturaId } } });

  const [ultima, alertas] = await Promise.all([
    prisma.leitura.findFirst({
      where: {
        AND: [
          ...escopoLeitura(usuario),
          // O "agora" so vem de sensor, lote e propriedade ATIVOS (o mesmo conjunto dos alertas):
          // leitura de algo desativado nao pode aparecer como a situacao de hoje.
          // (O historico, em /medias, continua incluindo os inativos.)
          { sensor: { status: "ATIVO", lote: { status: "ATIVO", propriedade: { status: "ATIVO" } } } },
          ...filtros,
        ],
      },
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
    alertaService.listar(usuario, { propriedadeId, culturaId, sensorId }),
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
  };
}

// Medias de temperatura e umidade por hora ou por dia (em Recife). "filtros" ja vem validado.
async function medias(usuario, { agrupar, unidade, propriedadeId, culturaId, sensorId, de, ate }) {
  if (sensorId) await garantirSensorVisivel(sensorId, usuario);

  const resposta = (dados) => ({
    agrupar,
    fuso: "America/Recife",
    de: de.toISOString(),
    ate: ate.toISOString(),
    dados,
  });

  // 1) Descobre os sensores visiveis com o Prisma: a regra de dono fica so em escopoDono, nunca copiada para SQL.
  // Mesmo escopo do GET /leituras: nao filtra status do sensor nem do lote, para o historico continuar visivel.
  const filtros = [];
  if (sensorId) filtros.push({ id: sensorId });
  if (propriedadeId) filtros.push({ lote: { propriedadeId } });
  if (culturaId) filtros.push({ lote: { culturaId } });

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

  const arredondar = (numero) => Math.round(Number(numero) * 100) / 100;

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
