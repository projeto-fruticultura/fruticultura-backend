// Carregado aqui (e nao so no server.js) para o app funcionar tambem quando importado por testes.
require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const culturaRoutes = require("./routes/culturaRoutes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

const app = express();

app.disable("x-powered-by");

app.use(cors({ origin: process.env.CORS_ORIGIN || false }));

app.use(express.json({ limit: "100kb" }));


app.use("/api", routes);
app.use("/api", culturaRoutes);


app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;