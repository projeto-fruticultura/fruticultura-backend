const axios = require("axios");
const { ErroHttp } = require("../middlewares/erros");
const { PRODUTOS_ACEITOS } = require("../validators/mercadoValidator");

const URL_CONAB = "https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiario.txt";

// O arquivo tem mais de 170 MB e cresce uns 45 MB por ano, por isso e lido em fluxo (sem carregar tudo)
// e so o que interessa fica em memoria.
const TEMPO_MAXIMO_MS = 120 * 1000;
const TAMANHO_MAXIMO_BYTES = 400 * 1024 * 1024;
const VALIDADE_CACHE_MS = 24 * 60 * 60 * 1000;
// Depois de uma falha, nao tenta de novo por um tempo: sem isso, cada pedido esperaria ate 120 s.
const ESPERA_APOS_FALHA_MS = 5 * 60 * 1000;
// Ate 3 tentativas no total, com pausa curta entre elas (2 s e depois 5 s).
const PAUSAS_ENTRE_TENTATIVAS_MS = [2000, 5000];
// Nao comeca uma nova tentativa se o download ja gastou mais que isto desde o inicio.
const ORCAMENTO_TENTATIVAS_MS = 90 * 1000;
// Erros de rede sem resposta, que costumam passar sozinhos. Qualquer outro erro sem resposta HTTP
// (cabecalho mudado, nenhum registro valido, passou do tamanho maximo) se repetiria igual e nao e repetido.
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
const JANELA_DIAS = 365;

// Layout real do arquivo (conferido em 08/10/2026): separador ";", texto em latin1 (apesar do
// cabecalho HTTP dizer utf-8), preco com ponto decimal e data "AAAA/MM/DD hh:mm:ss.mmm".
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

let cache = null; // { registros, baixadoEm } do ultimo download bem-sucedido
let downloadEmAndamento = null; // pedidos simultaneos esperam este mesmo download
let ultimaFalhaEm = 0;

function semAcento(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

// Menor data (AAAA-MM-DD) que ainda entra no cache: hoje menos JANELA_DIAS.
function dataDeCorte(agora = new Date()) {
  const corte = new Date(agora.getTime() - JANELA_DIAS * 24 * 60 * 60 * 1000);
  return corte.toISOString().slice(0, 10);
}

// Transforma uma linha do arquivo em registro, ou devolve null se nao interessa ou esta quebrada:
// produto fora dos aceitos, data fora da janela, data ou preco invalidos.
function interpretarLinha(linha, dataCorte) {
  const colunas = linha.split(";");
  if (colunas.length < CABECALHO_ESPERADO.length) return null;

  // O produto traz a variedade junto: "UVA ITALIA", "BANANA PRATA", "MANGA".
  const produtoCompleto = semAcento(colunas[4]);
  const produto = PRODUTOS_ACEITOS.find((p) => produtoCompleto === p || produtoCompleto.startsWith(`${p} `));
  if (!produto) return null;

  const dataTexto = colunas[6].trim().slice(0, 10);
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dataTexto)) return null;
  const data = dataTexto.replace(/\//g, "-");
  if (data < dataCorte) return null;

  const preco = Number(colunas[7].trim().replace(",", "."));
  if (!Number.isFinite(preco) || preco <= 0) return null;

  return {
    municipio: colunas[0].trim(),
    uf: colunas[2].trim().toUpperCase(),
    ceasa: colunas[3].trim(),
    produto,
    variedade: produtoCompleto.slice(produto.length).trim() || null,
    unidade: colunas[5].trim(),
    data,
    preco,
  };
}

// Le o arquivo aos pedacos, linha a linha, e guarda so os registros que interessam.
// Falha (e nao devolve nada) se passar do tamanho maximo, se o cabecalho nao for o esperado
// ou se nenhum registro valido for encontrado: assim um arquivo mudado nunca vira dado errado.
async function lerEmFluxo(fluxo, { dataCorte, limiteBytes = TAMANHO_MAXIMO_BYTES }) {
  const decodificador = new TextDecoder("latin1");
  const registros = [];
  let bytes = 0;
  let resto = "";
  let cabecalhoLido = false;

  function tratarLinha(linhaBruta) {
    const linha = linhaBruta.replace(/\r$/, "");
    if (!cabecalhoLido) {
      const nomes = linha.replace(/^(\u00EF\u00BB\u00BF|\uFEFF)/, "").split(";").map((n) => n.trim().toLowerCase());
      if (nomes.join(";") !== CABECALHO_ESPERADO.join(";")) {
        throw new Error("O cabeçalho do arquivo da CONAB mudou; o layout das colunas precisa ser conferido.");
      }
      cabecalhoLido = true;
      return;
    }
    if (!linha.trim()) return;
    const registro = interpretarLinha(linha, dataCorte);
    if (registro) registros.push(registro);
  }

  for await (const pedaco of fluxo) {
    bytes += pedaco.length;
    if (bytes > limiteBytes) {
      fluxo.destroy();
      throw new Error(`O arquivo da CONAB passou do limite de ${Math.round(limiteBytes / 1024 / 1024)} MB.`);
    }
    const partes = (resto + decodificador.decode(pedaco, { stream: true })).split("\n");
    resto = partes.pop();
    for (const parte of partes) tratarLinha(parte);
  }
  resto += decodificador.decode();
  if (resto) tratarLinha(resto);

  if (!cabecalhoLido || registros.length === 0) {
    throw new Error("O arquivo da CONAB não trouxe nenhum registro válido.");
  }
  // Mais recentes primeiro: assim o filtro ja devolve o preco atual no inicio da lista.
  registros.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return registros;
}

// Diz se vale tentar de novo: resposta HTTP 429 ou 5xx, ou erro de rede sem resposta (lista acima).
// HTTP 4xx (fora o 429) e o estouro do tempo total nao se repetem: dariam o mesmo resultado, e repetir levaria minutos.
function ehFalhaPassageira(erro) {
  if (!erro || erro.naoRepetir) return false;
  if (erro.response) return erro.response.status === 429 || erro.response.status >= 500;
  return CODIGOS_FALHA_PASSAGEIRA.has(erro.code);
}

// Baixa o arquivo da CONAB em fluxo, com limite de tempo para o download inteiro.
// So o alarme controla o tempo (sem o "timeout" do axios, que usa o mesmo codigo ECONNABORTED de uma conexao cortada).
async function baixarDaConab() {
  const controle = new AbortController();
  let fluxo = null;
  let estourouTempo = false;
  const alarme = setTimeout(() => {
    estourouTempo = true;
    controle.abort();
    if (fluxo) fluxo.destroy();
  }, TEMPO_MAXIMO_MS);

  try {
    const resposta = await axios.get(URL_CONAB, {
      responseType: "stream",
      signal: controle.signal,
    });
    fluxo = resposta.data;
    return await lerEmFluxo(fluxo, { dataCorte: dataDeCorte() });
  } catch (erro) {
    if (estourouTempo) {
      const estouro = new Error(`O download da CONAB passou de ${TEMPO_MAXIMO_MS / 1000} s.`);
      estouro.naoRepetir = true;
      throw estouro;
    }
    throw erro;
  } finally {
    clearTimeout(alarme);
  }
}

class MercadoService {
  // Devolve os registros do cache; baixa de novo se o cache venceu (ou nao existe).
  // Falha com cache antigo: devolve o cache marcado como desatualizado.
  // Falha sem cache: 503. Nunca existe preco inventado.
  // Falha de um pedido real ativa a espera de 5 minutos antes de um novo ciclo. "contarFalha: false" e so do
  // aquecimento: a falha dele nao ativa a espera, para o primeiro pedido real tentar de novo (com as 3 tentativas).
  async obterRegistros({ contarFalha = true } = {}) {
    const agora = Date.now();
    if (cache && agora - cache.baixadoEm < VALIDADE_CACHE_MS) {
      return { registros: cache.registros, baixadoEm: cache.baixadoEm, desatualizado: false };
    }

    if (!downloadEmAndamento && agora - ultimaFalhaEm >= ESPERA_APOS_FALHA_MS) {
      downloadEmAndamento = this.baixarComTentativas()
        .then((registros) => {
          cache = { registros, baixadoEm: Date.now() };
        })
        .catch((erro) => {
          if (contarFalha) ultimaFalhaEm = Date.now();
          // Aqui so a mensagem: o objeto de erro do axios traz a URL e os cabecalhos.
          console.error("Erro ao ler a CONAB:", erro.message);
          throw erro;
        })
        .finally(() => {
          downloadEmAndamento = null;
        });
    }

    if (downloadEmAndamento) {
      try {
        await downloadEmAndamento;
        return { registros: cache.registros, baixadoEm: cache.baixadoEm, desatualizado: false };
      } catch {
        // Cai no tratamento da falha, logo abaixo.
      }
    }

    // Falha agora (ou falha recente, sem nova tentativa): cache antigo, se houver; senao 503.
    if (cache) return { registros: cache.registros, baixadoEm: cache.baixadoEm, desatualizado: true };
    throw new ErroHttp(503, "Dados de mercado indisponíveis no momento. Tente novamente mais tarde.");
  }

  // Ate 3 tentativas no total (pausa de 2 s e depois de 5 s), dentro do mesmo download compartilhado:
  // quem espera continua esperando este mesmo resultado, e nunca ha dois downloads ao mesmo tempo.
  // So repete falha passageira (ver ehFalhaPassageira) e nao comeca nova tentativa depois de 90 s de download.
  async baixarComTentativas() {
    const inicio = Date.now();
    const total = PAUSAS_ENTRE_TENTATIVAS_MS.length + 1;
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.baixar();
      } catch (erro) {
        const pausa = PAUSAS_ENTRE_TENTATIVAS_MS[tentativa - 1];
        if (pausa === undefined || !ehFalhaPassageira(erro) || Date.now() - inicio > ORCAMENTO_TENTATIVAS_MS) throw erro;
        console.error(`CONAB: tentativa ${tentativa} de ${total} falhou (${erro.message}); nova tentativa em ${pausa / 1000} s.`);
        await new Promise((resolver) => setTimeout(resolver, pausa));
        if (Date.now() - inicio > ORCAMENTO_TENTATIVAS_MS) throw erro;
      }
    }
  }

  // Separado para os testes poderem trocar o download por um falso.
  baixar() {
    return baixarDaConab();
  }

  // Carrega o cache em segundo plano, pelo mesmo caminho dos pedidos (pedidos que chegarem durante o
  // aquecimento esperam o mesmo download). Nunca rejeita: falha so registra uma linha curta com a mensagem,
  // e o servidor segue de pe. Quem chama nao precisa esperar.
  async aquecer() {
    console.log("CONAB: carregando o cache de preços em segundo plano.");
    const inicio = Date.now();
    try {
      const { registros, desatualizado } = await this.obterRegistros({ contarFalha: false });
      if (desatualizado) console.error("CONAB: o aquecimento falhou; seguindo com o cache antigo.");
      else console.log(`CONAB: cache pronto (${registros.length} registros, ${((Date.now() - inicio) / 1000).toFixed(1)} s).`);
    } catch (erro) {
      console.error(`CONAB: o aquecimento falhou (${erro.message}); o primeiro pedido tentará de novo.`);
    }
  }

  async consultarPrecos({ produto, uf, ceasa, limite }) {
    const { registros, baixadoEm, desatualizado } = await this.obterRegistros();

    const trechoCeasa = ceasa ? semAcento(ceasa) : null;
    const filtrados = registros.filter(
      (r) => r.produto === produto && r.uf === uf && (!trechoCeasa || semAcento(r.ceasa).includes(trechoCeasa))
    );
    const historico = filtrados.slice(0, limite);

    const resposta = {
      fonte: "CONAB/PROHORT",
      origem: URL_CONAB,
      // Hora do download feito na CONAB (nao a do pedido): com o cache de 24 h, mostra a idade do dado.
      consultadoEn: new Date(baixadoEm).toISOString(),
      filtros: {
        produto,
        uf,
        ceasa: ceasa || null,
      },
      precoAtual: historico[0] || null,
      historico,
    };
    if (desatualizado) resposta.desatualizado = true;
    return resposta;
  }
}

module.exports = new MercadoService();
// Reaproveitada fora daqui (ex.: culturaService transforma o nome da cultura em produto); nao muda nada neste servico.
module.exports.semAcento = semAcento;
