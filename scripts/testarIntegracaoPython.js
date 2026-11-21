// Integração HTTP local real com dados SIMULADOS.
// Não utiliza banco ou serviço de produção.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");

const {
  consultar,
} = require("../src/services/modeloPythonService");

const fixture = require(
  "../tests/fixtures/recomendacaoPython.json"
);

const raiz = path.resolve(__dirname, "..");

const pausa = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function escolherPython() {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }

  const local = path.join(
    raiz,
    "python-service",
    ".venv",
    process.platform === "win32"
      ? "Scripts/python.exe"
      : "bin/python"
  );

  if (fs.existsSync(local)) {
    return local;
  }

  return process.platform === "win32"
    ? "python"
    : "python3";
}

async function portaLivre() {
  const server = net.createServer();

  const aberto = once(server, "listening");

  server.listen(0, "127.0.0.1");

  await aberto;

  const porta = server.address().port;

  await new Promise((resolve, reject) => {
    server.close((erro) => {
      if (erro) {
        reject(erro);
      } else {
        resolve();
      }
    });
  });

  return porta;
}

function iniciar(python, porta, token) {
  const child = spawn(
    python,
    [
      "-m",
      "uvicorn",
      "main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(porta),
      "--log-level",
      "warning",
    ],
    {
      cwd: path.join(raiz, "python-service"),

      env: {
        ...process.env,
        PYTHON_RECOMMENDATION_TOKEN: token,
      },

      stdio: ["ignore", "ignore", "pipe"],
    }
  );

  const estado = {
    child,
    erro: null,
    stderr: "",
  };

  child.on("error", (erro) => {
    estado.erro = erro;
  });

  child.stderr.on("data", (chunk) => {
    estado.stderr = (
      estado.stderr + String(chunk)
    ).slice(-8000);
  });

  return estado;
}

async function parar(estado) {
  const child = estado?.child;

  if (
    !child ||
    child.exitCode !== null ||
    child.signalCode !== null ||
    estado.erro
  ) {
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill();
  });
}

async function esperarHealth(estado, url) {
  const fim = Date.now() + 15000;

  while (Date.now() < fim) {
    if (estado.erro) {
      throw new Error(
        "Não foi possível executar Python. " +
        "Configure PYTHON_EXECUTABLE."
      );
    }

    if (estado.child.exitCode !== null) {
      throw new Error(
        "O Python não iniciou. Confira as dependências " +
        "de python-service/requirements-test.txt."
      );
    }

    try {
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(1000),
      });

      if (resposta.status === 200) {
        return;
      }
    } catch {
      // O processo ainda pode estar iniciando.
    }

    await pausa(150);
  }

  throw new Error(
    "Python não ficou disponível dentro de 15 segundos."
  );
}

async function executar() {
  const python = escolherPython();
  const resultados = [];

  let ativo;
  let semToken;

  async function caso(nome, funcao) {
    await funcao();

    resultados.push({
      cenario: nome,
      status: "APROVADO",
    });

    console.log(`PASS ${nome}`);
  }

  try {
    const porta = await portaLivre();

    // Exclusivo desta execução. Não é salvo nem exibido.
    const token = randomBytes(32).toString("hex");

    const base = `http://127.0.0.1:${porta}`;

    const url =
      `${base}/v1/recommendations/harvest-export`;

    ativo = iniciar(python, porta, token);

    const env = {
      PYTHON_RECOMMENDATION_URL: url,
      PYTHON_RECOMMENDATION_TOKEN: token,
    };

    const pedido = () => structuredClone(fixture);

    const enviar = (body, authorization) =>
      fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          ...(authorization
            ? { Authorization: authorization }
            : {}),
        },

        body: JSON.stringify(body),

        signal: AbortSignal.timeout(5000),
      });

    await caso(
      "Uvicorn inicia com token e health responde 200",
      async () => {
        await esperarHealth(
          ativo,
          `${base}/health`
        );
      }
    );

    await caso(
      "Requisição sem token ou com token incorreto recebe 401",
      async () => {
        for (const authorization of [
          undefined,
          "Bearer incorreto",
        ]) {
          const resposta = await enviar(
            pedido(),
            authorization
          );

          assert.equal(resposta.status, 401);

          await resposta.text();
        }
      }
    );

    await caso(
      "Cliente Node chama Python por HTTP e valida o contrato",
      async () => {
        const resposta = await consultar(
          pedido(),
          { env }
        );

        assert.equal(
          resposta.harvest.status,
          "FAVORAVEL"
        );

        assert.equal(
          resposta.export.status,
          "FAVORAVEL"
        );

        assert.equal(
          resposta.memoriaCalculo.exportacao
            .margemInternaKg,
          4
        );

        assert.equal(
          resposta.memoriaCalculo.exportacao
            .margemExportacaoKg,
          6
        );
      }
    );

    await caso(
      "Empate decimal não recomenda exportação",
      async () => {
        const body = pedido();

        Object.assign(
          body.parametrosExportacao,
          {
            precoInternoKg: 6.1,
            custoInternoKg: 0,
            precoExportacaoKg: 8.4,
            custoExportacaoKg: 2.3,
          }
        );

        const resposta = await consultar(
          body,
          { env }
        );

        assert.equal(
          resposta.export.status,
          "NAO_FAVORAVEL"
        );

        assert.equal(
          resposta.memoriaCalculo.exportacao
            .margemExportacaoKg,
          6.1
        );

        assert.equal(
          resposta.memoriaCalculo.exportacao
            .margemInternaKg,
          6.1
        );
      }
    );

    await caso(
      "Pydantic recusa umidade impossível com 422",
      async () => {
        const body = pedido();

        body.previsaoDiaria.dias[0]
          .umidadeRelativaMediaPercentual = 150;

        const resposta = await enviar(
          body,
          `Bearer ${token}`
        );

        assert.equal(resposta.status, 422);

        await resposta.text();
      }
    );

    await caso(
      "Cliente Node trata recusa de autenticação do Python",
      async () => {
        await assert.rejects(
          consultar(pedido(), {
            env: {
              ...env,
              PYTHON_RECOMMENDATION_TOKEN:
                "incorreto",
            },
          }),
          {
            status: 502,
          }
        );
      }
    );

    await caso(
      "Uvicorn recusa inicialização sem token",
      async () => {
        semToken = iniciar(
          python,
          await portaLivre(),
          ""
        );

        const fim = Date.now() + 10000;

        while (
          !semToken.erro &&
          semToken.child.exitCode === null &&
          Date.now() < fim
        ) {
          await pausa(100);
        }

        assert.equal(
          semToken.erro,
          null,
          "Python não foi localizado."
        );

        assert.notEqual(
          semToken.child.exitCode,
          null,
          "O processo não encerrou sem token."
        );

        assert.notEqual(
          semToken.child.exitCode,
          0
        );

        assert.match(
          semToken.stderr,
          /PYTHON_RECOMMENDATION_TOKEN.*obrigatório/
        );
      }
    );

    const relatorio = {
      executadoEmUTC: new Date().toISOString(),

      ambiente: {
        node: process.version,
        plataforma: process.platform,
      },

      escopo:
        "HTTP local real Node-Python; " +
        "dados simulados; sem banco, firmware ou produção",

      total: resultados.length,
      aprovados: resultados.length,
      resultados,
    };

    const indice =
      process.argv.indexOf("--saida");

    if (indice !== -1) {
      if (!process.argv[indice + 1]) {
        throw new Error(
          "Informe o caminho após --saida."
        );
      }

      const destino = path.resolve(
        process.argv[indice + 1]
      );

      fs.mkdirSync(
        path.dirname(destino),
        { recursive: true }
      );

      fs.writeFileSync(
        destino,
        JSON.stringify(relatorio, null, 2) + "\n"
      );
    }

    console.log(
      `\n${resultados.length} cenários de integração aprovados. ` +
      "Nenhum dado foi gravado em banco."
    );
  } finally {
    await parar(semToken);
    await parar(ativo);
  }
}

executar().catch((erro) => {
  console.error(`FALHA: ${erro.message}`);
  process.exitCode = 1;
});