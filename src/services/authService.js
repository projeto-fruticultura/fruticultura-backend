const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_ALGORITMO } = require("../config/auth");
const { ErroHttp } = require("../middlewares/erros");

// Mesmo custo do seed, para o bcrypt.compare levar o mesmo tempo nos dois casos abaixo.
const CUSTO_BCRYPT = 10;

// Hash de uma senha aleatoria, gerado quando o modulo carrega. Quando o e-mail nao existe,
// comparamos contra ele: assim a resposta demora o mesmo que um e-mail real com senha errada,
// e ninguem descobre pelo tempo quais e-mails estao cadastrados.
const HASH_FALSO = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), CUSTO_BCRYPT);

// Mesma mensagem para e-mail inexistente, senha errada e usuario INATIVO:
// uma mensagem diferente para cada caso revelaria quais e-mails existem.
const ERRO_LOGIN = "E-mail ou senha inválidos.";

async function login(email, senha) {
  // A senha (hash) so e buscada aqui, para a comparacao; ela nunca vai para a resposta.
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, email: true, perfil: true, status: true, senha: true },
  });

  const senhaConfere = await bcrypt.compare(senha, usuario ? usuario.senha : HASH_FALSO);
  if (!usuario || !senhaConfere || usuario.status !== "ATIVO") {
    throw new ErroHttp(401, ERRO_LOGIN);
  }

  // Payload minimo: so o id (sub) e o perfil. O token e so codificado, nao criptografado:
  // qualquer um le o conteudo, entao nada de e-mail ou outro dado pessoal aqui.
  const token = jwt.sign({ perfil: usuario.perfil }, JWT_SECRET, {
    algorithm: JWT_ALGORITMO,
    expiresIn: JWT_EXPIRES_IN,
    subject: String(usuario.id),
  });

  const { senha: _hash, ...dadosPublicos } = usuario;
  return { token, usuario: dadosPublicos };
}

module.exports = { login, CUSTO_BCRYPT };
