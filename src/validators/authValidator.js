const { ErroHttp } = require("../middlewares/erros");

const EMAIL_MAXIMO = 254;
// O bcrypt so usa os primeiros 72 bytes da senha e ignora o resto em silencio.
// Medimos em bytes (nao em caracteres) porque acentos e emojis ocupam mais de 1 byte.
const SENHA_MAXIMO_BYTES = 72;

// Valida o corpo do login e devolve so email e senha.
function validarLogin(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie e-mail e senha em JSON.");
  }

  const campos = {};
  const { email, senha } = corpo;

  if (email === undefined || email === null || email === "") campos.email = "email é obrigatório.";
  else if (typeof email !== "string") campos.email = "email deve ser um texto.";
  else if (!email.trim()) campos.email = "email é obrigatório.";
  else if (email.trim().length > EMAIL_MAXIMO) campos.email = `email deve ter no máximo ${EMAIL_MAXIMO} caracteres.`;

  // A senha nao passa por trim: espaco pode fazer parte dela.
  if (senha === undefined || senha === null || senha === "") campos.senha = "senha é obrigatória.";
  else if (typeof senha !== "string") campos.senha = "senha deve ser um texto.";
  else if (Buffer.byteLength(senha, "utf8") > SENHA_MAXIMO_BYTES) {
    campos.senha = `senha deve ter no máximo ${SENHA_MAXIMO_BYTES} bytes.`;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErroHttp(400, "Dados inválidos.", campos);
  }

  // Minusculas: o e-mail e gravado em minusculas, e o Postgres compara diferenciando maiusculas.
  return { email: email.trim().toLowerCase(), senha };
}

module.exports = { validarLogin, SENHA_MAXIMO_BYTES, EMAIL_MAXIMO };
