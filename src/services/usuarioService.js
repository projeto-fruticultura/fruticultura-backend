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

const SELECAO_PROPRIEDADE_VINCULADA = { id: true, nome: true, cidade: true, uf: true, status: true };

// Vinculo so existe para TECNICO; para os outros perfis a mensagem avisa em vez de devolver lista vazia.
// "cliente" e o prisma ou o cliente de uma transacao.
async function buscarTecnico(cliente, id) {
  const usuario = await cliente.usuario.findUnique({ where: { id }, select: { perfil: true } });
  if (!usuario) throw new ErroHttp(404, "Usuário não encontrado.");
  if (usuario.perfil !== "TECNICO") {
    throw new ErroHttp(400, "Só é possível vincular propriedades a um usuário com perfil TECNICO.");
  }
}

// Lista so as propriedades ATIVAS: um vinculo antigo com propriedade INATIVA fica guardado, mas nao aparece.
async function listarPropriedadesVinculadas(cliente, usuarioId) {
  return cliente.propriedade.findMany({
    where: { status: "ATIVO", tecnicos: { some: { usuarioId } } },
    select: SELECAO_PROPRIEDADE_VINCULADA,
    orderBy: { nome: "asc" },
  });
}

async function listarPropriedades(id) {
  await buscarTecnico(prisma, id);
  return listarPropriedadesVinculadas(prisma, id);
}

// Substitui o conjunto de propriedades do tecnico. Tudo ou nada: se um id nao serve, nada muda.
// Apagar a linha de vinculo e a forma de desvincular (a tabela e so de ligacao, nao tem status).
async function vincularPropriedades(id, propriedadeIds) {
  return prisma.$transaction(async (tx) => {
    await buscarTecnico(tx, id);

    const encontradas = await tx.propriedade.findMany({
      where: { id: { in: propriedadeIds } },
      select: { id: true, status: true },
    });
    const erro = { propriedadeIds: "propriedade não encontrada." };
    if (encontradas.length < propriedadeIds.length) throw new ErroHttp(404, "Propriedade não encontrada.", erro);
    if (encontradas.some((p) => p.status !== "ATIVO")) throw new ErroHttp(400, "Propriedade não encontrada.", erro);

    await tx.tecnicoPropriedade.deleteMany({ where: { usuarioId: id, propriedadeId: { notIn: propriedadeIds } } });
    await tx.tecnicoPropriedade.createMany({
      data: propriedadeIds.map((propriedadeId) => ({ usuarioId: id, propriedadeId })),
      skipDuplicates: true,
    });

    return listarPropriedadesVinculadas(tx, id);
  });
}

module.exports = { criar, listar, inativar, atualizar, listarPropriedades, vincularPropriedades };
