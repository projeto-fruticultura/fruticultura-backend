const app = require("./app");
const { iniciarAgendador } = require("./services/agendadorLeituras");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);

  // Depois do listen, e aqui (nao no app.js) para importar o app em testes nao iniciar o agendador.
  // Fica desligado a menos que LEITURAS_AGENDADOR_ATIVO seja "true".
  iniciarAgendador();
});
