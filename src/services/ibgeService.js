const axios = require('axios');

const TIMEOUT_MS = 8000;
const AVISO_SEM_DADO = 'Dado do IBGE indisponível para este período.';

// O IBGE usa "..", "...", "-", "X" etc. quando nao tem dado. So passa o que for numero em texto (ex.: "9876543").
function valorNumerico(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return false;
  const texto = String(valor).trim();
  return texto !== '' && Number.isFinite(Number(texto));
}

class IbgeService {
  async obterEstatisticasNacionais() {
    try {
      // Consulta a área plantada (variável 214) de produtos agrícolas no Brasil todo (N1)
      const response = await axios.get(
        'https://servicodados.ibge.gov.br/api/v3/agregados/1612/periodos/-1/variaveis/214?localidades=N1[all]',
        { timeout: TIMEOUT_MS }
      );

      // Simplifica o retorno gigante do IBGE para mostrar apenas o valor essencial
      const serie = response.data[0]?.resultados[0]?.series[0]?.serie;
      const anoAtual = Object.keys(serie || {})[0];
      const valorHectares = serie ? serie[anoAtual] : undefined;
      const resposta = {
        indicador: 'Área plantada no Brasil (Hectares)',
        anoReferencia: anoAtual,
      };

      // Sem numero valido: valor null com aviso, em vez de repassar ".." como se fosse dado.
      if (!valorNumerico(valorHectares)) {
        return { ...resposta, valor: null, aviso: AVISO_SEM_DADO };
      }
      return { ...resposta, valor: valorHectares };
    } catch (error) {
      return { erro: 'Falha ao obter estatísticas do IBGE.' };
    }
  }
}

module.exports = new IbgeService();
