const {
  spawnSync,
} = require("node:child_process");

const {
  deepmerge,
} = require("deepmerge-ts");

const {
  ipKeyGenerator,
} = require("express-rate-limit");

test(
  "deepmerge corrigido lida com objetos cíclicos",
  () => {
    const a = {};
    a.self = a;

    const b = {};
    b.self = b;

    const resultado =
      deepmerge(a, b);

    expect(
      resultado.self
    ).toBe(resultado);
  }
);

test(
  "Effect corrigido rejeita entrada patológica dentro do limite",
  () => {
    const codigo = `
      const { Schema } = require("effect");

      const schema = Schema.TemplateLiteral(
        Schema.String,
        ":",
        Schema.String,
        ":",
        Schema.String,
        "X"
      );

      if (
        Schema.is(schema)(
          ":".repeat(5000)
        )
      ) {
        process.exit(1);
      }
    `;

    const resultado = spawnSync(
      process.execPath,
      [
        "-e",
        codigo,
      ],
      {
        cwd: process.cwd(),
        timeout: 3000,
        encoding: "utf8",
      }
    );

    expect(
      resultado.error
    ).toBeUndefined();

    expect(
      resultado.status
    ).toBe(0);
  }
);

test(
  "agrupamento IPv6 permanece compatível",
  () => {
    expect(
      ipKeyGenerator(
        "192.0.2.1"
      )
    ).toBe(
      "192.0.2.1"
    );

    expect(
      ipKeyGenerator(
        "2001:db8::1"
      )
    ).toBe(
      "2001:db8::/56"
    );
  }
);