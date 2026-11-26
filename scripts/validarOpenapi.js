const path = require("node:path");

const SwaggerParser = require(
  "@apidevtools/swagger-parser"
);

const caminho = path.join(
  __dirname,
  "../docs/openapi.yaml"
);

SwaggerParser.validate(
  caminho,
  {
    resolve: {
      external: false,
    },
  }
)
  .then((spec) => {
    const metodos = new Set([
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ]);

    const total = Object.values(
      spec.paths
    ).reduce(
      (quantidade, item) =>
        quantidade +
        Object.keys(item).filter(
          (metodo) =>
            metodos.has(metodo)
        ).length,
      0
    );

    console.log(
      `OpenAPI válido: ${total} operações.`
    );
  })
  .catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });