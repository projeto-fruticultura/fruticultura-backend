require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: "100kb" }));

// Todas as rotas entram aqui via /api
app.use("/api", routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;