const { ErroHttp } = require("../middlewares/erros");
// Mesmos limites do login, importados para nao manter duas copias.
const { EMAIL_MAXIMO, SENHA_MAXIMO_BYTES } = require("./authValidator");
// Mesma validacao de :id das outras rotas, importada para nao manter duas copias.
const { validarId } = require("./propriedadeValidator");

const NOME_MAXIMO = 150;
const SENHA_MINIMO_BYTES = 8;
const PERFIS = ["PRODUTOR", "TECNICO", "ADMIN"];
// Formato simples (algo@algo.algo): confirma que parece um e-mail, sem tentar cobrir a RFC inteira.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valida o corpo do POST (modo "criar") ou do PUT (modo "atualizar").
// Devolve nome, email, senha e perfil no cadastro; na edicao, so nome, email e perfil.
// status, id e qualquer outro campo sao ignorados: o usuario sempre nasce ATIVO,
// e o cliente nunca escolhe campos de controle. A senha tambem nao muda pelo PUT.
// No PUT tudo e opcional: o que for omitido mantem o valor salvo (null ou "" continuam sendo erro).
function validarUsuario(corpo, modo = "criar") {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados do usuário em JSON.");
  }

  const criar = modo === "criar";
  const campos = {};
  const { nome, email, senha, perfil } = corpo;
  // Campo omitido so e aceito na edicao.
  const pular = (valor) => !criar && valor === undefined;

  if (!pular(nome)) {
    if (nome === undefined || nome === null || nome === "") campos.nome = "nome é obrigatório.";
    else if (typeof nome !== "string") campos.nome = "nome deve ser um texto.";
    else if (!nome.trim()) campos.nome = "nome é obrigatório.";
    else if (nome.trim().length > NOME_MAXIMO) campos.nome = `nome deve ter no máximo ${NOME_MAXIMO} caracteres.`;
  }

  if (!pular(email)) {
    if (email === undefined || email === null || email === "") campos.email = "email é obrigatório.";
    else if (typeof email !== "string") campos.email = "email deve ser um texto.";
    else if (email.trim().length > EMAIL_MAXIMO) campos.email = `email deve ter no máximo ${EMAIL_MAXIMO} caracteres.`;
    else if (!FORMATO_EMAIL.test(email.trim())) campos.email = "email deve ter um formato válido (ex.: nome@dominio.com).";
  }

  // Medida em bytes pelo mesmo motivo do login: o bcrypt ignora o que passa de 72 bytes.
  if (criar) {
    if (senha === undefined || senha === null || senha === "") campos.senha = "senha é obrigatória.";
    else if (typeof senha !== "string") campos.senha = "senha deve ser um texto.";
    else {
      const bytes = Buffer.byteLength(senha, "utf8");
      if (bytes < SENHA_MINIMO_BYTES || bytes > SENHA_MAXIMO_BYTES) {
        campos.senha = `senha deve ter entre ${SENHA_MINIMO_BYTES} e ${SENHA_MAXIMO_BYTES} bytes.`;
      }
    }
  }

  if (!pular(perfil)) {
    if (perfil === undefined || perfil === null || perfil === "") campos.perfil = "perfil é obrigatório.";
    else if (!PERFIS.includes(perfil)) campos.perfil = `perfil deve ser um destes: ${PERFIS.join(", ")}.`;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  const dados = {
    nome: nome === undefined ? undefined : nome.trim(),
    // Minusculas: o login busca o e-mail em minusculas, e o Postgres diferencia maiusculas.
    email: email === undefined ? undefined : email.trim().toLowerCase(),
    perfil,
  };
  if (criar) return { ...dados, senha };

  // Na edicao, remove o que nao veio: undefined nao pode virar "limpar o campo".
  return Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined));
}

module.exports = { validarUsuario, validarId };
