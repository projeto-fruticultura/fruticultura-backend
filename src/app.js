// Carregado aqui (e nao so no server.js) para o app funcionar tambem quando importado por testes.
require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

const app = express();

// Nao anunciar que o servidor usa Express.
app.disable("x-powered-by");

// So o front configurado pode chamar a API pelo navegador.
// Sem CORS_ORIGIN, nenhuma origem externa e liberada (em vez de liberar todas).
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));

// Limite evita que um corpo gigante trave o servidor.
app.use(express.json({ limit: "100kb" }));

app.use("/api", routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
