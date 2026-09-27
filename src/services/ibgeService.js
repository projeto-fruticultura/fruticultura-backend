const axios = require('axios');

class IbgeService {
  async obterEstatisticasNacionais() {
    try {
      // Consulta a área plantada (variável 214) de produtos agrícolas no Brasil todo (N1)
      const response = await axios.get(
        'https://servicodados.ibge.gov.br/api/v3/agregados/1612/periodos/-1/variaveis/214?localidades=N1[all]'
      );

      // Simplifica o retorno gigante do IBGE para mostrar apenas o valor essencial
      const serie = response.data[0]?.resultados[0]?.series[0]?.serie;
      const anoAtual = Object.keys(serie || {})[0];
      const valorHectares = serie ? serie[anoAtual] : 'N/A';

      return {
        indicador: 'Área plantada no Brasil (Hectares)',
        anoReferencia: anoAtual,
        valor: valorHectares
      };
    } catch (error) {
      return { erro: 'Falha ao obter estatísticas do IBGE.' };
    }
  }
}

module.exports = new IbgeService();