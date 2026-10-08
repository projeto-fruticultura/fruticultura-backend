const axios = require('axios');
const prisma = require('../config/prisma');
const { ErroHttp } = require('../middlewares/erros');
const { filtroPropriedade } = require('./escopoDono');

// A NASA usa -999 para "sem dado". Vira null para nao parecer temperatura ou chuva de verdade.
// So o -999 exato; mesmas chaves e datas.
function trocarSemDadoPorNull(parametros) {
  const resultado = {};
  for (const [nome, dias] of Object.entries(parametros)) {
    if (dias === null || typeof dias !== "object") throw new Error("Resposta da NASA fora do formato esperado.");
    resultado[nome] = {};
    for (const [data, valor] of Object.entries(dias)) {
      resultado[nome][data] = valor === -999 ? null : valor;
    }
  }
  return resultado;
}

async function consultarClimaPropriedade(id, usuario) {
  const idNumerico = parseInt(id, 10);
  
  if (isNaN(idNumerico)) {
    throw new ErroHttp(400, "ID de propriedade inválido.");
  }

  // 1. Busca a propriedade diretamente no Prisma
  // Com o filtro de dono: propriedade de outra pessoa da 404 aqui, antes de chamar a NASA.
  const propriedade = await prisma.propriedade.findFirst({
    where: { id: idNumerico, status: "ATIVO", AND: [filtroPropriedade(usuario)] }
  });

  if (!propriedade) {
    throw new ErroHttp(404, "Propriedade não encontrada.");
  }

  // "Faltando" e so null/undefined. Checa antes do Number(), porque Number(null) vira 0,
  // e 0 e uma coordenada valida (Equador e meridiano de Greenwich).
  if (propriedade.latitude == null || propriedade.longitude == null) {
    throw new ErroHttp(400, "A propriedade selecionada não possui latitude e longitude válidas cadastradas.");
  }
  const latitude = Number(propriedade.latitude);
  const longitude = Number(propriedade.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ErroHttp(400, "A propriedade selecionada não possui latitude e longitude válidas cadastradas.");
  }

  // 2. Prepara as datas recentes para a NASA POWER API (últimos 5 dias)
  const hoje = new Date();
  const dataFimObj = new Date(hoje.getTime() - 86400000); // Ontem
  const dataInicioObj = new Date(hoje.getTime() - 5 * 86400000); // Há 5 dias

  const formatarDataNasa = (date) => {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  };

  const urlNasa = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${longitude}&latitude=${latitude}&start=${formatarDataNasa(dataInicioObj)}&end=${formatarDataNasa(dataFimObj)}&format=JSON`;

  try {
    const response = await axios.get(urlNasa, { timeout: 15000 });

    // Resposta sem o bloco esperado e falha da NASA, nao erro nosso.
    const parametros = response.data?.properties?.parameter;
    if (!parametros || typeof parametros !== "object") {
      throw new Error("Resposta da NASA fora do formato esperado.");
    }

    return {
      propriedadeId: propriedade.id,
      nomePropriedade: propriedade.nome,
      coordenadas: { latitude, longitude },
      fonteClima: "NASA POWER API",
      periodo: {
        inicio: formatarDataNasa(dataInicioObj),
        fim: formatarDataNasa(dataFimObj)
      },
      parametrosClimaticos: trocarSemDadoPorNull(parametros)
    };
  } catch (error) {
    // No log vai so a mensagem e o status, nunca o corpo que a NASA devolveu.
    const status = error.response ? ` (status ${error.response.status})` : "";
    console.error(`Falha ao consultar a NASA${status}: ${error.message}`);
    // Falha de servico de fora e 502 (bad gateway), nao 500.
    throw new ErroHttp(502, "Não foi possível obter os dados meteorológicos da NASA no momento.");
  }
}

module.exports = { consultarClimaPropriedade };