const prisma = require('../config/prisma');
const openMeteoService = require('./openMeteoService');
const mercadoService = require('./mercadoService');
const ibgeService = require('./ibgeService');

class CulturaService {
  async listarTodas() {
    return await prisma.cultura.findMany();
  }

  async buscarPorId(id) {
    return await prisma.cultura.findUnique({
      where: { id: Number(id) },
    });
  }

  async criar(dados) {
    return await prisma.cultura.create({
      data: dados,
    });
  }

  async atualizar(id, dados) {
    return await prisma.cultura.update({
      where: { id: Number(id) },
      data: dados,
    });
  }

  async deletar(id) {
    return await prisma.cultura.delete({
      where: { id: Number(id) },
    });
  }

  async obterDetalhesCompletos(culturaId, latitude, longitude) {
    const cultura = await prisma.cultura.findUnique({
      where: { id: Number(culturaId) },
    });
    
    if (!cultura) throw new Error('Cultura não encontrada.');

    // 1. Clima (Open-Meteo)
    const clima = await openMeteoService.obterClimaAtual(latitude, longitude);

    const alertaTemperatura =
      clima.temperaturaAtual < Number(cultura.temperaturaMin) ||
      clima.temperaturaAtual > Number(cultura.temperaturaMax);

    const alertaUmidade =
      clima.umidadeAtual < Number(cultura.umidadeMin) ||
      clima.umidadeAtual > Number(cultura.umidadeMax);

    // 2. Preços Reais (Mercado Livre API)
    const mercado = await mercadoService.obterPrecosReais(cultura.nome);

    // 3. Estatísticas (IBGE Nacional)
    const estatisticas = await ibgeService.obterEstatisticasNacionais();

    return {
      cultura,
      condicoesAtuais: clima,
      alertas: {
        temperaturaForaDoRango: alertaTemperatura,
        umidadeForaDoRango: alertaUmidade,
      },
      cotacaoMercado: mercado,
      estatisticasAgricolas: estatisticas
    };
  }
}

module.exports = new CulturaService();