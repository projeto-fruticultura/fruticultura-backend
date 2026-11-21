require("dotenv").config({
  quiet: true,
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("node:fs");
const path = require("node:path");

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

const producao =
  process.env.NODE_ENV === "production";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "upgrade-insecure-requests":
          producao ? [] : null,
      },
    },

    strictTransportSecurity: producao
      ? {
          maxAge: 31536000,
          includeSubDomains: false,
        }
      : false,

    xFrameOptions: {
      action: "deny",
    },
  })
);

app.set(
  "trust proxy",
  Number(
    process.env.TRUST_PROXY_HOPS || 0
  )
);

app.use(monitorar);

app.use((req, res, next) => {
  contexto.run(
    { req },
    next
  );
});

const origensPermitidas = (
  process.env.CORS_ORIGIN || ""
)
  .split(",")
  .map(
    (origem) => origem.trim()
  )
  .filter(Boolean);

app.use(
  cors({
    origin: origensPermitidas,
  })
);

app.use(
  express.json({
    limit: "100kb",
  })
);

app.use("/api", routes);

// Documentação interativa da API (Swagger).
const swaggerDocument = YAML.parse(
  fs.readFileSync(
    path.join(__dirname, "../docs/openapi.yaml"),
    "utf8"
  )
);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;