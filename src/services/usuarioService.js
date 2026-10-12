const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
// Mesmo custo do seed e do login, importado para nao manter dois valores.
const { CUSTO_BCRYPT } = require("./authService");

// Campos que podem sair na resposta: a senha (hash) nunca entra aqui.
const SELECAO_PUBLICA = { id: true, nome: true, email: true, perfil: true, status: true };

// "dados" ja vem do validator, so com nome, email, senha e perfil.
async function criar(dados) {
  // Grava so o hash: a senha em texto nunca vai para o banco.
  const senhaHash = await bcrypt.hash(dados.senha, CUSTO_BCRYPT);

  try {
    return await prisma.usuario.create({
      data: { nome: dados.nome, email: dados.email, senha: senhaHash, perfil: dados.perfil },
      select: SELECAO_PUBLICA,
    });
  } catch (erro) {
    // email e @unique: o banco recusa repetido com o erro P2002.
    // Traduzimos para 409 sem repassar a mensagem interna do Prisma.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new ErroHttp(409, "E-mail já cadastrado.", { email: "e-mail já cadastrado." });
    }
    throw erro;
  }
}

// Ativos e inativos juntos (cada um com seu status), sem paginacao.
async function listar() {
  return prisma.usuario.findMany({ select: SELECAO_PUBLICA, orderBy: { nome: "asc" } });
}

async function inativar(id, usuarioLogado) {
  // O ADMIN nao inativa a si mesmo: assim sempre sobra pelo menos um ADMIN ativo.
  if (id === usuarioLogado.id) {
    throw new ErroHttp(409, "Você não pode inativar a sua própria conta.");
  }

  // Exclusao logica: a linha fica no banco. Sem filtro de status, inativar quem ja esta
  // INATIVO tambem da 204 (idempotente); so id inexistente conta 0 linhas.
  const { count } = await prisma.usuario.updateMany({ where: { id }, data: { status: "INATIVO" } });
  if (count === 0) throw new ErroHttp(404, "Usuário não encontrado.");
}

module.exports = { criar, listar, inativar };
