const axios = require('axios');
const prisma = require('../config/prisma');
const { ErroHttp } = require('../middlewares/erros');

async function consultarClimaPropriedade(id) {
  const idNumerico = parseInt(id, 10);
  
  if (isNaN(idNumerico)) {
    throw new ErroHttp(400, "ID de propriedade inválido.");
  }

  // 1. Busca a propriedade diretamente no Prisma
  const propriedade = await prisma.propriedade.findFirst({
    where: { id: idNumerico, status: "ATIVO" }
  });

  if (!propriedade) {
    throw new ErroHttp(404, "Propriedade não encontrada.");
  }

  const latitude = Number(propriedade.latitude);
  const longitude = Number(propriedade.longitude);

  if (!latitude || !longitude) {
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

    return {
      propriedadeId: propriedade.id,
      nomePropriedade: propriedade.nome,
      coordenadas: { latitude, longitude },
      fonteClima: "NASA POWER API",
      periodo: {
        inicio: formatarDataNasa(dataInicioObj),
        fim: formatarDataNasa(dataFimObj)
      },
      parametrosClimaticos: response.data.properties.parameter
    };
  } catch (error) {
    // Imprime o erro exato no terminal para sabermos se o problema é na NASA ou na base de dados
    console.error("DETALHE DO ERRO NA NASA/PRISMA:", error.message);
    if (error.response) {
      console.error("Dados da resposta da NASA:", error.response.data);
    }
    throw new ErroHttp(500, "Não foi possível obter os dados meteorológicos da NASA no momento.");
  }
}

module.exports = { consultarClimaPropriedade };