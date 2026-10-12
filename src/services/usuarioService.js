const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ErroHttp } = require("../middlewares/erros");
// Mesmo custo do seed e do login, importado para nao manter dois valores.
const { CUSTO_BCRYPT } = require("./authService");

// Campos que podem sair na resposta: a senha (hash) nunca entra aqui.
const SELECAO_PUBLICA = { id: true, nome: true, email: true, perfil: true, status: true };

// email e @unique: o banco recusa repetido com o erro P2002.
// Traduzimos para 409 sem repassar a mensagem interna do Prisma.
function traduzirEmailRepetido(erro) {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    return new ErroHttp(409, "E-mail já cadastrado.", { email: "e-mail já cadastrado." });
  }
  return erro;
}

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
    throw traduzirEmailRepetido(erro);
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

// PUT parcial: "dados" so tem o que o cliente enviou (nome, email e perfil); o resto mantem o valor salvo.
async function atualizar(id, dados, usuarioLogado) {
  const atual = await prisma.usuario.findUnique({ where: { id }, select: { perfil: true } });
  if (!atual) throw new ErroHttp(404, "Usuário não encontrado.");

  // O ADMIN nao muda o proprio perfil: assim sempre sobra pelo menos um ADMIN ativo.
  // Mandar o perfil que ja tem nao muda nada e passa.
  if (id === usuarioLogado.id && dados.perfil !== undefined && dados.perfil !== atual.perfil) {
    throw new ErroHttp(409, "Você não pode alterar o seu próprio perfil.");
  }

  try {
    return await prisma.usuario.update({ where: { id }, data: dados, select: SELECAO_PUBLICA });
  } catch (erro) {
    // P2025: o usuario sumiu entre a leitura e a gravacao.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      throw new ErroHttp(404, "Usuário não encontrado.");
    }
    throw traduzirEmailRepetido(erro);
  }
}

module.exports = { criar, listar, inativar, atualizar };
