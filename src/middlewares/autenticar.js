const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { JWT_SECRET, JWT_ALGORITMO } = require("../config/auth");
const { ErroHttp } = require("./erros");

const ERRO_NAO_AUTENTICADO = "Não autenticado.";

// Confere o token do header "Authorization: Bearer <token>" e coloca o usuario em req.usuario.
async function autenticar(req, res, next) {
  const [tipo, token, ...sobra] = (req.headers.authorization || "").split(" ");
  if (tipo !== "Bearer" || !token || sobra.length > 0) {
    throw new ErroHttp(401, ERRO_NAO_AUTENTICADO);
  }

  let payload;
  try {
    // Algoritmo fixo: sem isso, um token com "alg: none" (sem assinatura) poderia ser aceito.
    payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITMO] });
  } catch {
    // Assinatura errada, token expirado ou malformado: mesma resposta, sem detalhe interno.
    throw new ErroHttp(401, ERRO_NAO_AUTENTICADO);
  }

  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id < 1) throw new ErroHttp(401, ERRO_NAO_AUTENTICADO);

  // Busca no banco a cada requisicao: usuario desativado perde o acesso na hora,
  // mesmo com o token ainda no prazo. O perfil tambem vem do banco, nao do token.
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nome: true, email: true, perfil: true, status: true },
  });
  if (!usuario || usuario.status !== "ATIVO") throw new ErroHttp(401, ERRO_NAO_AUTENTICADO);

  req.usuario = usuario;
  next();
}

// Uso: router.post("/", autenticar, exigirPerfil("ADMIN"), controller.criar)
// Precisa vir depois do autenticar, que preenche req.usuario.
function exigirPerfil(...perfis) {
  return function verificarPerfil(req, res, next) {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      throw new ErroHttp(403, "Sem permissão para esta ação.");
    }
    next();
  };
}

module.exports = { autenticar, exigirPerfil };
