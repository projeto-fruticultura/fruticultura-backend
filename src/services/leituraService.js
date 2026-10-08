const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
const { buscarLeituras } = require("./thingspeakService");
const { filtroLote, filtroSensor, filtroLeitura } = require("./escopoDono");

// Limite do Int do Postgres: o skip da pagina nunca passa disso (ver listar).
const MAIOR_INT = 2147483647;

// Busca as leituras no ThingSpeak e grava no banco, para o sensor definido em THINGSPEAK_SENSOR_CODIGO.
// Sem agendamento aqui: quem decide quando chamar (cron, rota) e outra etapa.
//
// Retorna { recebidas, descartadas, gravadas }:
// - recebidas: quantos feeds o ThingSpeak devolveu (validos + descartados);
// - descartadas: feeds com campo vazio, nao numerico ou fora das faixas;
// - gravadas: quantas leituras novas entraram no banco (as repetidas nao contam).
async function sincronizarLeituras({ results, fetchImpl } = {}) {
  const codigo = process.env.THINGSPEAK_SENSOR_CODIGO;
  if (!codigo) throw new Error("A variável de ambiente THINGSPEAK_SENSOR_CODIGO não foi definida.");

  // Confere o sensor antes de qualquer chamada de rede: sensor inexistente ou
  // inativo nao recebe leitura, e nao vale gastar a requisicao a toa.
  const sensor = await prisma.sensor.findUnique({ where: { codigo }, select: { id: true, status: true } });
  if (!sensor) throw new Error(`O sensor "${codigo}" não foi encontrado.`);
  if (sensor.status !== "ATIVO") throw new Error(`O sensor "${codigo}" não está ativo.`);

  const { leituras, descartadas } = await buscarLeituras({ results, fetchImpl });
  const recebidas = leituras.length + descartadas;

  if (leituras.length === 0) return { recebidas, descartadas, gravadas: 0 };

  // skipDuplicates + @@unique([sensorId, dataHoraLeitura]): se o mesmo trecho for buscado de novo,
  // o banco ignora as leituras que ja tem, em vez de duplicar ou dar erro.
  const { count } = await prisma.leitura.createMany({
    data: leituras.map((leitura) => ({ sensorId: sensor.id, ...leitura })),
    skipDuplicates: true,
  });

  return { recebidas, descartadas, gravadas: count };
}

// ---------- Consulta (GET /api/leituras) ----------

// Quem pode ver a leitura: dono da propriedade do sensor (ou ADMIN), e propriedade ATIVA.
// Leitura de sensor cujo lote e de propriedade INATIVA some (ate para ADMIN), como os lotes.
// NAO filtra pelo status do sensor: o historico de um sensor desativado continua consultavel.
// Dentro de AND para um filtro nunca sobrescrever o outro.
function escopoLeitura(usuario) {
  return [filtroLeitura(usuario), { sensor: { lote: { propriedade: { status: "ATIVO" } } } }];
}

// sensorId e loteId que nao existem ou estao fora do escopo do usuario dao o MESMO 404,
// para ninguem descobrir quais ids existem. Ja o propriedadeId nao precisa disso:
// segue o GET /lotes?propriedadeId=, que devolve lista vazia.
async function garantirSensorVisivel(sensorId, usuario) {
  const sensor = await prisma.sensor.findFirst({
    where: { id: sensorId, AND: [filtroSensor(usuario), { lote: { propriedade: { status: "ATIVO" } } }] },
    select: { id: true },
  });
  if (!sensor) throw new ErroHttp(404, "Sensor não encontrado.");
}

async function garantirLoteVisivel(loteId, usuario) {
  const lote = await prisma.lote.findFirst({
    where: { id: loteId, AND: [filtroLote(usuario), { propriedade: { status: "ATIVO" } }] },
    select: { id: true },
  });
  if (!lote) throw new ErroHttp(404, "Lote não encontrado.");
}

// "filtros" ja vem validado (e com pagina e limite preenchidos) do leituraValidator.
async function listar(usuario, { sensorId, loteId, propriedadeId, de, ate, pagina = 1, limite = 20 } = {}) {
  if (sensorId) await garantirSensorVisivel(sensorId, usuario);
  if (loteId) await garantirLoteVisivel(loteId, usuario);

  const filtros = [];
  if (sensorId) filtros.push({ sensorId });
  if (loteId) filtros.push({ sensor: { loteId } });
  if (propriedadeId) filtros.push({ sensor: { lote: { propriedadeId } } });
  // Limites inclusivos (gte e lte).
  if (de || ate) filtros.push({ dataHoraLeitura: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } });

  // O escopo de dono entra SEMPRE; o dono nunca vem da query nem do body.
  const where = { AND: [...escopoLeitura(usuario), ...filtros] };
  // Pagina gigante nao estoura o Int do Prisma: a tabela nunca tera tantas linhas, a lista sai vazia.
  const skip = Math.min((pagina - 1) * limite, MAIOR_INT);

  // Lista e contagem na mesma transacao, com o mesmo where.
  const [leituras, total] = await prisma.$transaction([
    prisma.leitura.findMany({
      where,
      // Mais recente primeiro; o id desempata leituras com o mesmo instante.
      orderBy: [{ dataHoraLeitura: "desc" }, { id: "desc" }],
      skip,
      take: limite,
      // So estes campos: nada de criadoEm nem de dados de sensor, lote ou propriedade.
      select: { id: true, sensorId: true, temperatura: true, umidade: true, dataHoraLeitura: true },
    }),
    prisma.leitura.count({ where }),
  ]);

  return {
    dados: leituras.map((l) => ({ ...l, dataHoraLeitura: l.dataHoraLeitura.toISOString() })),
    paginacao: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
  };
}

// escopoLeitura e garantirSensorVisivel tambem sao usados pelo dashboardService: a regra de dono e uma so.
module.exports = { sincronizarLeituras, listar, escopoLeitura, garantirSensorVisivel };
