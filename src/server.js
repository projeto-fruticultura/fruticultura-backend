const app = require("./app");
const { iniciarAgendador } = require("./services/agendadorLeituras");
const mercadoService = require("./services/mercadoService");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);

  // Depois do listen, e aqui (nao no app.js) para importar o app em testes nao iniciar o agendador.
  // Fica desligado a menos que LEITURAS_AGENDADOR_ATIVO seja "true".
  iniciarAgendador();

  // Fica desligado a menos que CONAB_AQUECER_AO_INICIAR seja "true" (baixa cerca de 180 MB ao subir).
  // Roda em segundo plano, sem await: o servidor ja esta atendendo, e uma falha aqui nunca o derruba.
  if (process.env.CONAB_AQUECER_AO_INICIAR === "true") {
    mercadoService.aquecer().catch((erro) => console.error(`CONAB: o aquecimento falhou (${erro.message}).`));
  }
});
