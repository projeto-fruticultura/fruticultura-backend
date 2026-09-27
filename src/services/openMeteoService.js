const axios = require('axios');

class OpenMeteoService {
  async obterClimaAtual(latitude, longitude) {
    try {
      const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: latitude,
          longitude: longitude,
          current_weather: true,
          hourly: 'relativehumidity_2m',
        },
      });

      const { temperature, windspeed } = response.data.current_weather;
      const umidade = response.data.hourly.relativehumidity_2m[0];

      return {
        temperaturaAtual: temperature,
        umidadeAtual: umidade,
        velocidadeVento: windspeed,
      };
    } catch (error) {
      throw new Error('Erro ao consultar dados climáticos do Open-Meteo.');
    }
  }
}

module.exports = new OpenMeteoService();