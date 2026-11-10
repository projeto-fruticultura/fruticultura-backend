require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const contexto = require("./config/contexto");

const {
  monitorar,
} = require("./middlewares/monitoramento");

const {
  rotaNaoEncontrada,
  tratarErros,
} = require("./middlewares/erros");

const app = express();

app.disable("x-powered-by");

app.set(
  "trust proxy",
  Number(process.env.TRUST_PROXY_HOPS || 0)
);

app.use(monitorar);

app.use((req, res, next) => {
  contexto.run({ req }, next);
});

const origensPermitidas = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origensPermitidas,
  })
);

app.use(express.json({ limit: "100kb" }));

app.use("/api", routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;