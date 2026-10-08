const axios = require('axios');

// Sem timeout a chamada podia ficar pendurada; 8 s e o limite combinado para servicos externos.
const TIMEOUT_MS = 8000;

class OpenMeteoService {
  async obterClimaAtual(latitude, longitude) {
    // Pedimos o bloco "current": ele traz o valor de agora. O hourly[0] era a meia-noite (00:00 GMT) de hoje.
    // Unidades padrao da doc: temperatura em Celsius e vento em km/h, as mesmas do current_weather antigo.
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: latitude,
        longitude: longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
      },
      timeout: TIMEOUT_MS,
    });

    const atual = response.data?.current;
    const temperatura = atual?.temperature_2m;
    const umidade = atual?.relative_humidity_2m;
    const vento = atual?.wind_speed_10m;

    // Campo faltando ou nao numerico = resposta fora do formato. Nunca se inventa valor.
    if (![temperatura, umidade, vento].every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('Resposta do Open-Meteo fora do formato esperado.');
    }

    return {
      temperaturaAtual: temperatura,
      umidadeAtual: umidade,
      velocidadeVento: vento,
    };
  }
}

module.exports = new OpenMeteoService();
