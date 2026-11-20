const axios = require("axios");

const {
  ErroHttp,
} = require("../middlewares/erros");

const {
  PRODUTOS_ACEITOS,
} = require("../validators/mercadoValidator");

const {
  resumirMercado,
} = require("./resumoMercadoService");

const URL_CONAB =
  "https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiario.txt";

const TEMPO_MAXIMO_MS =
  120 * 1000;

const TAMANHO_MAXIMO_BYTES =
  400 * 1024 * 1024;

const VALIDADE_CACHE_MS =
  24 * 60 * 60 * 1000;

const ESPERA_APOS_FALHA_MS =
  5 * 60 * 1000;

const PAUSAS_ENTRE_TENTATIVAS_MS = [
  2000,
  5000,
];

const ORCAMENTO_TENTATIVAS_MS =
  90 * 1000;

const JANELA_DIAS = 365;

const CODIGOS_FALHA_PASSAGEIRA = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNABORTED",
  "EAI_AGAIN",
  "EPIPE",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ERR_STREAM_PREMATURE_CLOSE",
]);

const CABECALHO_ESPERADO = [
  "municipio_ceasa",
  "cod_ibge_municipio",
  "uf_ceasa",
  "dsc_ceasa",
  "dsc_produto",
  "sig_unidade_medida",
  "data_preco",
  "preco_diario",
];

// Cache compartilhado entre as consultas.
let cache = null;
let downloadEmAndamento = null;
let ultimaFalhaEm = 0;

function semAcento(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase()
    .trim();
}

function dataDeCorte(
  agora = new Date()
) {
  const corte = new Date(
    agora.getTime() -
    JANELA_DIAS * 24 * 60 * 60 * 1000
  );

  return corte
    .toISOString()
    .slice(0, 10);
}

function interpretarLinha(
  linha,
  dataCorte
) {
  const colunas = linha.split(";");

  if (
    colunas.length <
    CABECALHO_ESPERADO.length
  ) {
    return null;
  }

  const produtoCompleto = semAcento(
    colunas[4]
  );

  const produto = PRODUTOS_ACEITOS.find(
    (nome) =>
      produtoCompleto === nome ||
      produtoCompleto.startsWith(
        `${nome} `
      )
  );

  if (!produto) {
    return null;
  }

  const dataTexto = colunas[6]
    .trim()
    .slice(0, 10);

  if (
    !/^\d{4}\/\d{2}\/\d{2}$/.test(
      dataTexto
    )
  ) {
    return null;
  }

  const data = dataTexto.replace(
    /\//g,
    "-"
  );

  if (data < dataCorte) {
    return null;
  }

  const preco = Number(
    colunas[7]
      .trim()
      .replace(",", ".")
  );

  if (
    !Number.isFinite(preco) ||
    preco <= 0
  ) {
    return null;
  }

  return {
    municipio: colunas[0].trim(),

    uf: colunas[2]
      .trim()
      .toUpperCase(),

    ceasa: colunas[3].trim(),

    produto,

    variedade:
      produtoCompleto
        .slice(produto.length)
        .trim() || null,

    unidade: colunas[5].trim(),

    data,

    preco,
  };
}

// Processa o arquivo em fluxo.
async function lerEmFluxo(
  fluxo,
  {
    dataCorte,
    limiteBytes = TAMANHO_MAXIMO_BYTES,
  }
) {
  const decodificador =
    new TextDecoder("latin1");

  const registros = [];

  let bytes = 0;
  let resto = "";
  let cabecalhoLido = false;

  function tratarLinha(linhaBruta) {
    const linha = linhaBruta.replace(
      /\r$/,
      ""
    );

    if (!cabecalhoLido) {
      const nomes = linha
        .replace(
          /^(\u00EF\u00BB\u00BF|\uFEFF)/,
          ""
        )
        .split(";")
        .map(
          (nome) =>
            nome.trim().toLowerCase()
        );

      if (
        nomes.join(";") !==
        CABECALHO_ESPERADO.join(";")
      ) {
        throw new Error(
          "O cabeçalho do arquivo da CONAB mudou; " +
          "o layout das colunas precisa ser conferido."
        );
      }

      cabecalhoLido = true;
      return;
    }

    if (!linha.trim()) {
      return;
    }

    const registro = interpretarLinha(
      linha,
      dataCorte
    );

    if (registro) {
      registros.push(registro);
    }
  }

  for await (const pedaco of fluxo) {
    bytes += pedaco.length;

    if (bytes > limiteBytes) {
      fluxo.destroy();

      throw new Error(
        "O arquivo da CONAB passou do limite de " +
        `${Math.round(limiteBytes / 1024 / 1024)} MB.`
      );
    }

    const partes = (
      resto +
      decodificador.decode(
        pedaco,
        {
          stream: true,
        }
      )
    ).split("\n");

    resto = partes.pop();

    for (const parte of partes) {
      tratarLinha(parte);
    }
  }

  resto += decodificador.decode();

  if (resto) {
    tratarLinha(resto);
  }

  if (
    !cabecalhoLido ||
    registros.length === 0
  ) {
    throw new Error(
      "O arquivo da CONAB não trouxe nenhum registro válido."
    );
  }

  registros.sort(
    (a, b) =>
      a.data < b.data
        ? 1
        : a.data > b.data
          ? -1
          : 0
  );

  return registros;
}

function ehFalhaPassageira(erro) {
  if (
    !erro ||
    erro.naoRepetir
  ) {
    return false;
  }

  if (erro.response) {
    return (
      erro.response.status === 429 ||
      erro.response.status >= 500
    );
  }

  return CODIGOS_FALHA_PASSAGEIRA.has(
    erro.code
  );
}

async function baixarDaConab() {
  const controle =
    new AbortController();

  let fluxo = null;
  let estourouTempo = false;

  const alarme = setTimeout(() => {
    estourouTempo = true;

    controle.abort();

    if (fluxo) {
      fluxo.destroy();
    }
  }, TEMPO_MAXIMO_MS);

  try {
    const resposta = await axios.get(
      URL_CONAB,
      {
        responseType: "stream",
        signal: controle.signal,
      }
    );

    fluxo = resposta.data;

    return await lerEmFluxo(
      fluxo,
      {
        dataCorte: dataDeCorte(),
      }
    );
  } catch (erro) {
    if (estourouTempo) {
      const estouro = new Error(
        "O download da CONAB passou de " +
        `${TEMPO_MAXIMO_MS / 1000} s.`
      );

      estouro.naoRepetir = true;

      throw estouro;
    }

    throw erro;
  } finally {
    clearTimeout(alarme);
  }
}

class MercadoService {
  async obterRegistros(
    {
      contarFalha = true,
    } = {}
  ) {
    const agora = Date.now();

    if (
      cache &&
      agora - cache.baixadoEm <
      VALIDADE_CACHE_MS
    ) {
      return {
        registros: cache.registros,
        baixadoEm: cache.baixadoEm,
        desatualizado: false,
      };
    }

    if (
      !downloadEmAndamento &&
      agora - ultimaFalhaEm >=
      ESPERA_APOS_FALHA_MS
    ) {
      downloadEmAndamento =
        this.baixarComTentativas()
          .then((registros) => {
            cache = {
              registros,
              baixadoEm: Date.now(),
            };
          })
          .catch((erro) => {
            if (contarFalha) {
              ultimaFalhaEm =
                Date.now();
            }

            console.error(
              "Erro ao ler a CONAB:",
              erro.message
            );

            throw erro;
          })
          .finally(() => {
            downloadEmAndamento =
              null;
          });
    }

    if (downloadEmAndamento) {
      try {
        await downloadEmAndamento;

        return {
          registros: cache.registros,
          baixadoEm: cache.baixadoEm,
          desatualizado: false,
        };
      } catch {
        // Usa o cache antigo abaixo,
        // quando houver.
      }
    }

    if (cache) {
      return {
        registros: cache.registros,
        baixadoEm: cache.baixadoEm,
        desatualizado: true,
      };
    }

    throw new ErroHttp(
      503,
      "Dados de mercado indisponíveis no momento. " +
      "Tente novamente mais tarde."
    );
  }

  async baixarComTentativas() {
    const inicio = Date.now();

    const total =
      PAUSAS_ENTRE_TENTATIVAS_MS.length + 1;

    for (
      let tentativa = 1;
      ;
      tentativa++
    ) {
      try {
        return await this.baixar();
      } catch (erro) {
        const pausa =
          PAUSAS_ENTRE_TENTATIVAS_MS[
            tentativa - 1
          ];

        const excedeuOrcamento =
          Date.now() - inicio >
          ORCAMENTO_TENTATIVAS_MS;

        if (
          pausa === undefined ||
          !ehFalhaPassageira(erro) ||
          excedeuOrcamento
        ) {
          throw erro;
        }

        console.error(
          `CONAB: tentativa ${tentativa} de ${total} ` +
          `falhou (${erro.message}); ` +
          `nova tentativa em ${pausa / 1000} s.`
        );

        await new Promise(
          (resolver) =>
            setTimeout(
              resolver,
              pausa
            )
        );

        if (
          Date.now() - inicio >
          ORCAMENTO_TENTATIVAS_MS
        ) {
          throw erro;
        }
      }
    }
  }

  // Mantido separado para os testes.
  baixar() {
    return baixarDaConab();
  }

  async aquecer() {
    console.log(
      "CONAB: carregando o cache de preços em segundo plano."
    );

    const inicio = Date.now();

    try {
      const {
        registros,
        desatualizado,
      } = await this.obterRegistros({
        contarFalha: false,
      });

      if (desatualizado) {
        console.error(
          "CONAB: o aquecimento falhou; " +
          "seguindo com o cache antigo."
        );
      } else {
        console.log(
          "CONAB: cache pronto " +
          `(${registros.length} registros, ` +
          `${((Date.now() - inicio) / 1000).toFixed(1)} s).`
        );
      }
    } catch (erro) {
      console.error(
        "CONAB: o aquecimento falhou " +
        `(${erro.message}); ` +
        "o primeiro pedido tentará de novo."
      );
    }
  }

  async consultarPrecos({
    produto,
    uf,
    ceasa,
    limite,
  }) {
    const {
      registros,
      baixadoEm,
      desatualizado,
    } = await this.obterRegistros();

    const trechoCeasa = ceasa
      ? semAcento(ceasa)
      : null;

    const filtrados = registros.filter(
      (registro) =>
        registro.produto === produto &&
        registro.uf === uf &&
        (
          !trechoCeasa ||
          semAcento(
            registro.ceasa
          ).includes(
            trechoCeasa
          )
        )
    );

    const historico = filtrados.slice(
      0,
      limite
    );

    const resposta = {
      fonte: "CONAB/PROHORT",

      origem: URL_CONAB,

      // Horário do download da fonte,
      // não o horário desta requisição.
      consultadoEn: new Date(
        baixadoEm
      ).toISOString(),

      filtros: {
        produto,
        uf,
        ceasa: ceasa || null,
      },

      // Considera todos os registros filtrados,
      // independentemente do limite do histórico.
      resumoMercado: resumirMercado(
        filtrados,
        {
          produto,
          uf,
          ceasa,
        }
      ),

      precoAtual:
        historico[0] || null,

      historico,
    };

    if (desatualizado) {
      resposta.desatualizado = true;
    }

    return resposta;
  }
}

module.exports = new MercadoService();

// Utilizada por outros serviços do projeto.
module.exports.semAcento = semAcento;