const { ErroHttp } = require("../middlewares/erros");

const {
  EMAIL_MAXIMO,
  SENHA_MAXIMO_BYTES,
} = require("./authValidator");

const {
  validarId,
} = require("./propriedadeValidator");

const NOME_MAXIMO = 150;
const SENHA_MINIMO_BYTES = 8;
const PROPRIEDADE_IDS_MAXIMO = 100;
const MAIOR_ID = 2147483647;

const PERFIS = ["PRODUTOR", "TECNICO", "ADMIN"];
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarUsuario(corpo, modo = "criar") {
  if (
    !corpo ||
    typeof corpo !== "object" ||
    Array.isArray(corpo)
  ) {
    throw new ErroHttp(
      400,
      "Envie os dados do usuário em JSON."
    );
  }

  const criar = modo === "criar";
  const campos = {};

  const {
    nome,
    email,
    senha,
    perfil,
    status,
  } = corpo;

  const pular = (valor) =>
    !criar && valor === undefined;

  if (!pular(nome)) {
    if (
      nome === undefined ||
      nome === null ||
      nome === ""
    ) {
      campos.nome = "nome é obrigatório.";
    } else if (typeof nome !== "string") {
      campos.nome = "nome deve ser um texto.";
    } else if (!nome.trim()) {
      campos.nome = "nome é obrigatório.";
    } else if (nome.trim().length > NOME_MAXIMO) {
      campos.nome =
        `nome deve ter no máximo ${NOME_MAXIMO} caracteres.`;
    }
  }

  if (!pular(email)) {
    if (
      email === undefined ||
      email === null ||
      email === ""
    ) {
      campos.email = "email é obrigatório.";
    } else if (typeof email !== "string") {
      campos.email = "email deve ser um texto.";
    } else if (email.trim().length > EMAIL_MAXIMO) {
      campos.email =
        `email deve ter no máximo ${EMAIL_MAXIMO} caracteres.`;
    } else if (!FORMATO_EMAIL.test(email.trim())) {
      campos.email = "email deve ter um formato válido.";
    }
  }

  if (criar) {
    if (
      senha === undefined ||
      senha === null ||
      senha === ""
    ) {
      campos.senha = "senha é obrigatória.";
    } else if (typeof senha !== "string") {
      campos.senha = "senha deve ser um texto.";
    } else {
      const bytes = Buffer.byteLength(senha, "utf8");

      if (
        bytes < SENHA_MINIMO_BYTES ||
        bytes > SENHA_MAXIMO_BYTES
      ) {
        campos.senha =
          `senha deve ter entre ${SENHA_MINIMO_BYTES} e ` +
          `${SENHA_MAXIMO_BYTES} bytes.`;
      }
    }
  }

  if (!pular(perfil)) {
    if (
      perfil === undefined ||
      perfil === null ||
      perfil === ""
    ) {
      campos.perfil = "perfil é obrigatório.";
    } else if (!PERFIS.includes(perfil)) {
      campos.perfil =
        `perfil deve ser um destes: ${PERFIS.join(", ")}.`;
    }
  }

  // A inativação continua sendo feita pelo DELETE.
  // O PUT permite somente a reativação.
  if (
    !criar &&
    status !== undefined &&
    status !== "ATIVO"
  ) {
    campos.status =
      'Use status "ATIVO" para reativar. ' +
      "Para inativar, use DELETE.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(
      400,
      "Dados inválidos.",
      campos
    );
  }

  const dados = {
    nome:
      nome === undefined
        ? undefined
        : nome.trim(),

    email:
      email === undefined
        ? undefined
        : email.trim().toLowerCase(),

    perfil,
  };

  // O cadastro utiliza o status padrão do banco.
  if (criar) {
    return {
      ...dados,
      senha,
    };
  }

  if (status !== undefined) {
    dados.status = status;
  }

  return Object.fromEntries(
    Object.entries(dados).filter(
      ([, valor]) => valor !== undefined
    )
  );
}

function validarPropriedadeIds(corpo) {
  if (
    !corpo ||
    typeof corpo !== "object" ||
    Array.isArray(corpo)
  ) {
    throw new ErroHttp(
      400,
      "Envie os dados em JSON."
    );
  }

  const { propriedadeIds } = corpo;
  let erro = null;

  if (
    propriedadeIds === undefined ||
    propriedadeIds === null
  ) {
    erro = "propriedadeIds é obrigatório.";
  } else if (!Array.isArray(propriedadeIds)) {
    erro = "propriedadeIds deve ser uma lista de ids.";
  } else if (
    !propriedadeIds.every(
      (id) =>
        Number.isInteger(id) &&
        id >= 1 &&
        id <= MAIOR_ID
    )
  ) {
    erro =
      "propriedadeIds deve conter só números inteiros positivos.";
  } else if (
    new Set(propriedadeIds).size >
    PROPRIEDADE_IDS_MAXIMO
  ) {
    erro =
      `propriedadeIds deve ter no máximo ` +
      `${PROPRIEDADE_IDS_MAXIMO} ids.`;
  }

  if (erro) {
    throw new ErroHttp(
      400,
      "Dados inválidos.",
      { propriedadeIds: erro }
    );
  }

  return [...new Set(propriedadeIds)];
}

module.exports = {
  validarUsuario,
  validarId,
  validarPropriedadeIds,
};