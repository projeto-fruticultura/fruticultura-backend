const { ErroHttp } = require("../middlewares/erros");
// Mesma regra de :id de Propriedades; importado para nao manter duas copias.
const { validarId } = require("./propriedadeValidator");

// Limite do Int do Postgres: acima disso o banco recusaria e viraria erro 500.
const MAIOR_ID = 2147483647;
const TEXTO_MAXIMO = 150; // VarChar(150): origem, destino e transportadora
const TEMPO_MAXIMO = 99999.9; // Decimal(6, 1)
const CUSTO_MAXIMO = 9999999999.99; // Decimal(12, 2)
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

// Listas de valores aceitos. modal e situacao sao texto no banco (como Lote.situacao), sem enum:
// quem confere os valores e este validator. Valor fora da lista da 400 listando os aceitos.
const MODAIS = ["RODOVIARIO", "FERROVIARIO", "AEREO", "MARITIMO"];
const SITUACOES = ["PLANEJADA", "EM_TRANSITO", "ENTREGUE", "CANCELADA"];

const mensagemLista = (nome, aceitos) => `${nome} deve ser um destes valores: ${aceitos.join(", ")}.`;

// A query chega sempre como texto, entao conferimos o formato antes de converter
// (Number() aceitaria "0x10" ou "1e2"). Lista repetida (?a=1&a=2) chega como array
// e nao e string, entao tambem cai como invalida.
function lerInteiro(valor, minimo, maximo) {
  if (typeof valor !== "string" || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return numero >= minimo && numero <= maximo ? numero : null;
}

// ---------- GET /logistica ----------

// Valida a query de GET /logistica. Tudo e opcional. Campos de dono (usuarioId, dono...) nao existem
// aqui: o que nao for reconhecido e ignorado, e o dono vem sempre do token.
function validarFiltrosLogistica(query) {
  const q = query || {};
  const campos = {};
  const filtros = {};

  if (q.propriedadeId !== undefined) {
    const numero = lerInteiro(q.propriedadeId, 1, MAIOR_ID);
    if (numero === null) campos.propriedadeId = "propriedadeId deve ser um número inteiro positivo.";
    else filtros.propriedadeId = numero;
  }

  for (const [nome, aceitos] of [["modal", MODAIS], ["situacao", SITUACOES]]) {
    if (q[nome] === undefined) continue;
    if (typeof q[nome] === "string" && aceitos.includes(q[nome])) filtros[nome] = q[nome];
    else campos[nome] = mensagemLista(nome, aceitos);
  }

  filtros.pagina = 1;
  if (q.pagina !== undefined) {
    const numero = lerInteiro(q.pagina, 1, MAIOR_ID);
    if (numero === null) campos.pagina = "pagina deve ser um número inteiro maior ou igual a 1.";
    else filtros.pagina = numero;
  }

  filtros.limite = LIMITE_PADRAO;
  if (q.limite !== undefined) {
    const numero = lerInteiro(q.limite, 1, LIMITE_MAXIMO);
    if (numero === null) campos.limite = `limite deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.`;
    else filtros.limite = numero;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Filtro inválido.", campos);
  }
  return filtros;
}

// ---------- POST e PUT ----------

// Texto: sem espacos sobrando nas pontas, de 1 ate "maximo" caracteres.
function lerTexto(corpo, nome, maximo, campos, obrigatorio) {
  const valor = corpo[nome];
  if (valor === undefined) {
    if (obrigatorio) campos[nome] = `${nome} é obrigatório.`;
    return undefined;
  }
  if (valor === null) {
    campos[nome] = obrigatorio ? `${nome} é obrigatório.` : `${nome} não pode ser nulo.`;
    return undefined;
  }
  if (typeof valor !== "string") {
    campos[nome] = `${nome} deve ser um texto.`;
    return undefined;
  }
  const limpo = valor.trim();
  if (limpo.length < 1 || limpo.length > maximo) {
    campos[nome] = `${nome} deve ter entre 1 e ${maximo} caracteres.`;
    return undefined;
  }
  return limpo;
}

// Valor de uma lista fixa (modal, situacao): exatamente um dos aceitos, em maiusculas.
function lerLista(corpo, nome, aceitos, campos, obrigatorio) {
  const valor = corpo[nome];
  if (valor === undefined) {
    if (obrigatorio) campos[nome] = `${nome} é obrigatório. ${mensagemLista(nome, aceitos)}`;
    return undefined;
  }
  if (valor === null) {
    campos[nome] = obrigatorio ? `${nome} é obrigatório.` : `${nome} não pode ser nulo.`;
    return undefined;
  }
  if (typeof valor !== "string" || !aceitos.includes(valor)) {
    campos[nome] = mensagemLista(nome, aceitos);
    return undefined;
  }
  return valor;
}

// Numero de verdade (nao texto), na faixa e com no maximo "casas" casas decimais.
// "erroFaixa" devolve a mensagem se o valor estiver fora da faixa permitida.
function lerNumero(corpo, nome, { maximo, casas, erroFaixa }, campos, obrigatorio) {
  const valor = corpo[nome];
  if (valor === undefined) {
    if (obrigatorio) campos[nome] = `${nome} é obrigatório.`;
    return undefined;
  }
  if (valor === null) {
    campos[nome] = obrigatorio ? `${nome} é obrigatório.` : `${nome} não pode ser nulo.`;
    return undefined;
  }
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    campos[nome] = `${nome} deve ser um número.`;
    return undefined;
  }
  const faixa = erroFaixa(valor);
  if (faixa) campos[nome] = faixa;
  else if (valor > maximo) campos[nome] = `${nome} deve ser no máximo ${maximo}.`;
  else if (!new RegExp(`^\\d+(\\.\\d{1,${casas}})?$`).test(String(valor))) {
    campos[nome] = `${nome} deve ter no máximo ${casas} ${casas === 1 ? "casa decimal" : "casas decimais"}.`;
  } else return valor;
  return undefined;
}

// Inteiro positivo de verdade (numero, nao texto), como loteId em Sensores.
function lerIdNumerico(corpo, nome, campos) {
  const valor = corpo[nome];
  if (valor === undefined || valor === null) {
    campos[nome] = `${nome} é obrigatório.`;
    return undefined;
  }
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 1 || valor > MAIOR_ID) {
    campos[nome] = `${nome} deve ser um número inteiro positivo.`;
    return undefined;
  }
  return valor;
}

// Valida o corpo do POST (modo "criar") ou do PUT (modo "atualizar") e devolve so os campos permitidos.
// id, status, usuarioId e (no PUT) propriedadeId nunca vem do cliente: sao ignorados, como qualquer campo desconhecido.
// No PUT tudo e opcional: o que for omitido mantem o valor salvo.
function validarLogistica(corpo, modo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados da rota logística em JSON.");
  }
  const criar = modo === "criar";
  const campos = {};

  const dados = {
    origem: lerTexto(corpo, "origem", TEXTO_MAXIMO, campos, criar),
    destino: lerTexto(corpo, "destino", TEXTO_MAXIMO, campos, criar),
    modal: lerLista(corpo, "modal", MODAIS, campos, criar),
    tempoEstimadoHoras: lerNumero(
      corpo,
      "tempoEstimadoHoras",
      { maximo: TEMPO_MAXIMO, casas: 1, erroFaixa: (v) => (v <= 0 ? "tempoEstimadoHoras deve ser maior que zero." : null) },
      campos,
      criar
    ),
    custo: lerNumero(
      corpo,
      "custo",
      { maximo: CUSTO_MAXIMO, casas: 2, erroFaixa: (v) => (v < 0 ? "custo não pode ser negativo." : null) },
      campos,
      criar
    ),
    transportadora: lerTexto(corpo, "transportadora", TEXTO_MAXIMO, campos, criar),
    situacao: lerLista(corpo, "situacao", SITUACOES, campos, criar),
  };
  if (criar) dados.propriedadeId = lerIdNumerico(corpo, "propriedadeId", campos);

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  // No PUT, remove o que nao veio: undefined nao pode virar "limpar o campo".
  return criar ? dados : Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined));
}

module.exports = { validarFiltrosLogistica, validarLogistica, validarId };
