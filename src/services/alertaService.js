const prisma = require("../config/prisma");
const { filtroSensor } = require("./escopoDono");

// Leitura com mais minutos que isto e marcada como desatualizada (o alerta continua valendo).
const MINUTOS_LEITURA_DESATUALIZADA = 60;

// Regra pura, sem banco: compara a leitura com os limites da cultura e devolve 0, 1 ou 2 alertas.
// Valor igual ao limite e normal; so alerta se for estritamente menor que o minimo ou maior que o maximo.
// Os limites vem do Prisma como Decimal, por isso passam por Number() antes de comparar.
// "agora" existe para a regra nao depender do relogio (padrao: a hora atual).
function avaliarLimites(leitura, cultura, agora = new Date()) {
  const dataHoraLeitura = new Date(leitura.dataHoraLeitura);
  const idadeMinutos = (agora.getTime() - dataHoraLeitura.getTime()) / 60000;
  const base = {
    dataHoraLeitura: dataHoraLeitura.toISOString(),
    leituraDesatualizada: idadeMinutos > MINUTOS_LEITURA_DESATUALIZADA,
  };

  const alertas = [];
  const verificar = (valor, minimo, maximo, tipoBaixa, tipoAlta) => {
    const min = Number(minimo);
    const max = Number(maximo);
    if (valor < min) alertas.push({ tipo: tipoBaixa, valor, limite: min, ...base });
    else if (valor > max) alertas.push({ tipo: tipoAlta, valor, limite: max, ...base });
  };

  verificar(leitura.temperatura, cultura.temperaturaMin, cultura.temperaturaMax, "TEMPERATURA_BAIXA", "TEMPERATURA_ALTA");
  verificar(leitura.umidade, cultura.umidadeMin, cultura.umidadeMax, "UMIDADE_BAIXA", "UMIDADE_ALTA");
  return alertas;
}

// Alertas calculados na hora, a partir da ULTIMA leitura de cada sensor. Nada e gravado.
// So entram sensor ATIVO, de lote ATIVO e de propriedade ATIVA, dentro do escopo do usuario
// (ADMIN ve tudo, PRODUTOR so o que e dele, TECNICO nada). O dono nunca vem da query.
// "filtros" ja vem validado do alertaValidator. propriedadeId ou loteId fora do escopo dao lista vazia.
async function listar(usuario, { propriedadeId, loteId } = {}) {
  const filtros = [
    filtroSensor(usuario),
    { lote: { status: "ATIVO", propriedade: { status: "ATIVO" } } },
  ];
  if (loteId) filtros.push({ loteId });
  if (propriedadeId) filtros.push({ lote: { propriedadeId } });

  const sensores = await prisma.sensor.findMany({
    where: { status: "ATIVO", AND: filtros },
    orderBy: { id: "asc" },
    select: {
      id: true,
      codigo: true,
      lote: {
        select: {
          id: true,
          identificacao: true,
          propriedadeId: true,
          cultura: {
            select: { nome: true, temperaturaMin: true, temperaturaMax: true, umidadeMin: true, umidadeMax: true },
          },
        },
      },
    },
  });

  // A ultima leitura de cada sensor, uma consulta por sensor (findFirst vira LIMIT 1 no SQL e usa o indice
  // sensorId + dataHoraLeitura). Nao usamos "leituras: { take: 1 }" dentro do findMany de sensores porque,
  // nesta versao do Prisma, ele busca TODAS as leituras dos sensores e corta na memoria.
  const ultimas = await Promise.all(
    sensores.map((sensor) =>
      prisma.leitura.findFirst({
        where: { sensorId: sensor.id },
        orderBy: { dataHoraLeitura: "desc" },
        select: { temperatura: true, umidade: true, dataHoraLeitura: true },
      })
    )
  );

  const agora = new Date();
  const alertas = [];
  for (const [indice, sensor] of sensores.entries()) {
    // Sensor sem nenhuma leitura nao gera alerta, e nenhum valor e inventado.
    const ultima = ultimas[indice];
    if (!ultima) continue;

    for (const alerta of avaliarLimites(ultima, sensor.lote.cultura, agora)) {
      alertas.push({
        ...alerta,
        sensorId: sensor.id,
        sensorCodigo: sensor.codigo,
        loteId: sensor.lote.id,
        loteIdentificacao: sensor.lote.identificacao,
        propriedadeId: sensor.lote.propriedadeId,
        culturaNome: sensor.lote.cultura.nome,
      });
    }
  }

  return { total: alertas.length, alertas };
}

module.exports = { avaliarLimites, listar };
