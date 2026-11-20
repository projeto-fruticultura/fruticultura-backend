const fs = require("node:fs");
const path = require("node:path");

async function executar() {
  const token =
    process.env.VALESAFRA_TOKEN;

  if (!token) {
    throw new Error(
      "Defina VALESAFRA_TOKEN no ambiente."
    );
  }

  const base = new URL(
    process.env.VALESAFRA_API_URL ||
    "http://localhost:3000/api/"
  );

  if (!base.pathname.endsWith("/")) {
    base.pathname += "/";
  }

  const protocoloPermitido = [
    "http:",
    "https:",
  ].includes(base.protocol);

  const enderecoLocal = [
    "localhost",
    "127.0.0.1",
    "[::1]",
  ].includes(base.hostname);

  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !protocoloPermitido ||
    (
      base.protocol !== "https:" &&
      !enderecoLocal
    )
  ) {
    throw new Error(
      "Use HTTPS ou HTTP local, sem credenciais na URL."
    );
  }

  async function obter(caminho) {
    const resposta = await fetch(
      new URL(caminho, base),
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        redirect: "error",

        signal: AbortSignal.timeout(
          15000
        ),
      }
    );

    if (!resposta.ok) {
      throw new Error(
        `Consulta recusada: HTTP ${resposta.status}.`
      );
    }

    return resposta.json();
  }

  const sensores = await obter(
    "sensores"
  );

  if (!Array.isArray(sensores)) {
    throw new Error(
      "Formato inesperado dos sensores."
    );
  }

  const mapaSensores = new Map(
    sensores.map((sensor) => [
      sensor.id,
      sensor,
    ])
  );

  const registros = [];

  for (
    let pagina = 1;
    pagina <= 1000;
    pagina++
  ) {
    const resposta = await obter(
      "leituras" +
      "?periodo=30d" +
      "&limite=100" +
      `&pagina=${pagina}`
    );

    if (
      !Array.isArray(resposta.dados) ||
      !resposta.paginacao ||
      !Number.isInteger(
        resposta.paginacao.totalPaginas
      )
    ) {
      throw new Error(
        "Formato inesperado da paginação."
      );
    }

    for (const leitura of resposta.dados) {
      const sensor = mapaSensores.get(
        leitura.sensorId
      );

      if (!sensor) {
        throw new Error(
          "Leitura sem sensor visível para enriquecimento."
        );
      }

      registros.push([
        leitura.sensorId,
        sensor.loteId,
        sensor.lote.propriedadeId,
        leitura.dataHoraLeitura,
        leitura.temperatura,
        leitura.umidade,
      ]);
    }

    if (
      pagina >=
      resposta.paginacao.totalPaginas
    ) {
      break;
    }

    if (pagina === 1000) {
      throw new Error(
        "Limite de páginas excedido. Exportação incompleta recusada."
      );
    }
  }

  function escaparCSV(valor) {
    const texto = String(
      valor ?? ""
    ).replaceAll(
      '"',
      '""'
    );

    return `"${texto}"`;
  }

  const cabecalho = [
    "sensorId",
    "loteId",
    "propriedadeId",
    "dataHoraLeitura",
    "temperatura",
    "umidadeLegada",
  ];

  const texto = [
    cabecalho,
    ...registros,
  ]
    .map(
      (linha) =>
        linha
          .map(escaparCSV)
          .join(",")
    )
    .join("\n") + "\n";

  const destino = path.resolve(
    "analise/leituras.csv"
  );

  fs.mkdirSync(
    path.dirname(destino),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    destino,
    texto
  );

  console.log(
    `Exportação concluída: ${registros.length} medições.`
  );

  console.log(
    `Arquivo: ${destino}`
  );

  console.log(
    "Umidade legada: sem identificação separada de solo/ar."
  );
}

executar().catch(() => {
  console.error(
    "Exportação falhou. Confira URL, token, disponibilidade e formato da API."
  );

  process.exitCode = 1;
});