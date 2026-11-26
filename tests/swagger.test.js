const fs = require("node:fs");
const path = require("node:path");

const {
  execFileSync,
} = require("node:child_process");

const YAML = require("yaml");
const request = require("supertest");

jest.mock("../src/config/prisma", () => ({
  usuario: {
    findUnique: jest.fn(),
  },
  lote: {
    findFirst: jest.fn(),
  },
  cotacaoMercado: {
    findMany: jest.fn(),
  },
}));

const app = require("../src/app");
const prisma = require("../src/config/prisma");

const spec = YAML.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../docs/openapi.yaml"
    ),
    "utf8"
  )
);

const methods = new Set([
  "get", "post", "put", "patch",
  "delete", "options", "head",
]);

const operations = Object.entries(
  spec.paths
).flatMap(([url, item]) =>
  Object.entries(item)
    .filter(([method]) =>
      methods.has(method)
    )
    .map(([method, operation]) => ({
      url,
      method,
      operation,
    }))
);

function routesInSource() {
  const root = path.join(
    __dirname,
    "../src/routes"
  );

  const index = fs.readFileSync(
    path.join(root, "index.js"),
    "utf8"
  );

  const imports = new Map(
    [
      ...index.matchAll(
        /const\s+(\w+)\s*=\s*require\(["'](\.\/[^"']+)["']\)/g
      ),
    ].map(([, name, file]) => [
      name,
      file.endsWith(".js")
        ? file
        : `${file}.js`,
    ])
  );

  function extract(source, prefix = "") {
    return [
      ...source.matchAll(
        /\b(?:router|routes)\.(get|post|put|patch|delete|options|head)\(\s*["']([^"']+)["']/g
      ),
    ].map(([, method, suffix]) => {
      const url =
        (prefix + suffix)
          .replace(/\/$/, "")
          .replace(/:(\w+)/g, "{$1}") ||
        "/";

      return (
        method.toUpperCase() +
        " " +
        url
      );
    });
  }

  const result = extract(index);

  for (const [
    ,
    prefix,
    name,
  ] of index.matchAll(
    /routes\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g
  )) {
    if (!imports.has(name)) {
      throw new Error(
        `Router não resolvido pelo teste: ${name}`
      );
    }

    const source = fs.readFileSync(
      path.join(root, imports.get(name)),
      "utf8"
    );

    result.push(
      ...extract(source, prefix)
    );
  }

  return result.sort();
}

test(
  "OpenAPI válido e referências resolvidas",
  () => {
    const result = execFileSync(
      process.execPath,
      [
        path.join(
          __dirname,
          "../scripts/validarOpenapi.js"
        ),
      ],
      {
        encoding: "utf8",
        timeout: 10000,
      }
    );

    expect(result).toContain(
      `OpenAPI válido: ${operations.length} operações.`
    );
  }
);

test(
  "todas as operações reais estão documentadas",
  () => {
    const documented = operations
      .map(({ method, url }) =>
        `${method.toUpperCase()} ${url}`
      )
      .sort();

    expect(documented).toEqual(
      routesInSource()
    );

    const ids = operations.map(
      ({ operation }) =>
        operation.operationId
    );

    expect(
      new Set(ids).size
    ).toBe(operations.length);
  }
);

test(
  "acessos públicos, JWT e perfis",
  () => {
    const publicOperations = operations
      .filter(
        ({ operation }) =>
          operation.security.length === 0
      )
      .map(({ method, url }) =>
        `${method} ${url}`
      )
      .sort();

    expect(publicOperations).toEqual(
      [
        "post /auth/login",
        "get /health",
        "get /culturas",
        "get /culturas/{id}",
        "get /culturas/{id}/detalhes",
        "get /precos",
      ].sort()
    );

    for (const {
      operation,
    } of operations.filter(
      ({ operation }) =>
        operation.security.length
    )) {
      expect(
        operation.security
      ).toEqual([
        {
          bearerAuth: [],
        },
      ]);
    }

    expect(
      spec.paths["/sensores/config"]
        .post["x-perfis-autorizados"]
    ).toEqual([
      "ADMIN",
      "TECNICO",
    ]);

    for (const route of [
      "/dashboard/produtor/areas",
      "/dashboard/produtor/alertas-do-dia",
    ]) {
      expect(
        spec.paths[route]
          .get["x-perfis-autorizados"]
      ).toEqual(["PRODUTOR"]);
    }

    expect(
      spec.paths["/usuarios"]
        .post["x-perfis-autorizados"]
    ).toEqual(["ADMIN"]);
  }
);

test(
  "schemas de sucesso e respostas 204",
  () => {
    for (const {
      operation,
    } of operations) {
      for (const [
        status,
        response,
      ] of Object.entries(
        operation.responses
      ).filter(([status]) =>
        status.startsWith("2")
      )) {
        if (status === "204") {
          expect(
            response.content
          ).toBeUndefined();
        } else {
          expect(
            response.content[
              "application/json"
            ].schema
          ).toBeDefined();
        }
      }

      if (operation.requestBody) {
        const name =
          operation.requestBody
            .content["application/json"]
            .schema.$ref
            .split("/")
            .pop();

        expect(
          Object.keys(
            spec.components
              .schemas[name]
              .properties
          ).length
        ).toBeGreaterThan(0);
      }
    }
  }
);

const validatorCases = [
  ["LoginEntrada", "auth", "validarLogin"],
  ["UsuarioCriar", "usuario", "validarUsuario"],
  [
    "UsuarioAtualizar",
    "usuario",
    "validarUsuario",
    "atualizar",
  ],
  [
    "VinculosEntrada",
    "usuario",
    "validarPropriedadeIds",
  ],
  ["CulturaEntrada", "cultura", "validarCultura"],
  [
    "PropriedadeEntrada",
    "propriedade",
    "validarPropriedade",
  ],
  ["LoteCriar", "lote", "validarLote", "criar"],
  [
    "LoteAtualizar",
    "lote",
    "validarLote",
    "atualizar",
  ],
  ["SensorEntrada", "sensor", "validarSensor"],
  [
    "ThingSpeakEntrada",
    "sensor",
    "validarConfigThingSpeak",
  ],
  [
    "LogisticaCriar",
    "logistica",
    "validarLogistica",
    "criar",
  ],
  [
    "LogisticaAtualizar",
    "logistica",
    "validarLogistica",
    "atualizar",
  ],
  [
    "CotacaoEntrada",
    "cotacaoMercado",
    "validarCotacao",
  ],
];

test.each(
  validatorCases.map(
    ([schema, file, fn, mode]) => [
      schema,
      file,
      fn,
      mode,
    ]
  )
)(
  "exemplo %s aceito pelo validator real",
  (schema, file, fn, mode) => {
    const input =
      spec.components.schemas[
        schema
      ].example;

    expect(input).toBeDefined();

    const validator = require(
      `../src/validators/${file}Validator`
    )[fn];

    expect(() =>
      validator(input, mode)
    ).not.toThrow();
  }
);

test.each([
  "colheita",
  "exportacaoManual",
  "exportacaoIds",
])(
  "exemplo de previsão %s válido",
  async name => {
    const {
      resolverCotacoes,
    } = require(
      "../src/services/cotacoesJanelaService"
    );

    const {
      validarJanelas,
    } = require(
      "../src/validators/janelaValidator"
    );

    const input =
      spec.paths[
        "/lotes/{id}/previsao"
      ].post.requestBody
        .content["application/json"]
        .examples[name].value;

    // Relógio fixo para os exemplos não envelhecerem.
    const now = new Date(
      "2026-11-26T12:00:00Z"
    );

    prisma.lote.findFirst
      .mockResolvedValue({
        culturaId: 3,
      });

    prisma.cotacaoMercado.findMany
      .mockResolvedValue([
        {
          id: 1,
          culturaId: 3,
          mercadoDestino: "INTERNO",
          moeda: "BRL",
          unidade: "KG",
          precoMedio: 5,
          dataReferencia: new Date(
            "2026-11-25T00:00:00Z"
          ),
        },
        {
          id: 2,
          culturaId: 3,
          mercadoDestino: "EXPORTACAO",
          moeda: "BRL",
          unidade: "KG",
          precoMedio: 8,
          dataReferencia: new Date(
            "2026-11-25T00:00:00Z"
          ),
        },
      ]);

    const resolved =
      await resolverCotacoes(
        input,
        19,
        {
          id: 22,
          perfil: "PRODUTOR",
        },
        now
      );

    expect(() =>
      validarJanelas(resolved, now)
    ).not.toThrow();
  }
);

test(
  "filtros de sensores e campos protegidos",
  () => {
    const names = url =>
      spec.paths[url].get.parameters
        .filter(p => p.in === "query")
        .map(p => p.name)
        .sort();

    expect(
      names("/sensores/{id}/leituras")
    ).toEqual([
      "limite",
      "pagina",
      "periodo",
    ]);

    expect(
      names("/sensores/{id}/indicadores")
    ).toEqual([
      "ate",
      "de",
      "periodo",
      "temperaturaBase",
    ]);

    const schemas =
      spec.components.schemas;

    expect(
      schemas.UsuarioAtualizar
        .properties.senha
    ).toBeUndefined();

    expect(
      schemas.UsuarioAtualizar
        .properties.status.enum
    ).toEqual(["ATIVO"]);

    expect(
      schemas.Sensor
        .properties.readApiKey
    ).toBeUndefined();
  }
);

test(
  "Swagger UI, JSON e arquivos estáticos",
  async () => {
    const json = await request(app)
      .get("/api-docs/openapi.json")
      .expect(200);

    expect(json.body).toEqual(spec);

    const html = await request(app)
      .get("/api-docs/")
      .expect(200);

    expect(html.text).toContain(
      "swagger-ui-init.js"
    );

    expect(
      html.headers[
        "x-content-type-options"
      ]
    ).toBe("nosniff");

    expect(
      html.headers[
        "content-security-policy"
      ]
    ).toContain("script-src 'self'");

    const init = await request(app)
      .get(
        "/api-docs/swagger-ui-init.js"
      )
      .expect(200);

    expect(init.text).toContain(
      '"persistAuthorization": false'
    );

    expect(init.text).toContain(
      '"validatorUrl": null'
    );

    await request(app)
      .get(
        "/api-docs/swagger-ui-bundle.js"
      )
      .expect(200);
  }
);