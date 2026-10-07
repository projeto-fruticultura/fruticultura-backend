// Regra unica de "quem ve o que": propriedades, lotes e sensores usam estes filtros
// no where do Prisma. Mudar a regra (ex.: ligar tecnico a propriedades) e mexer so aqui.
// Uso: where: { id, status: "ATIVO", AND: [filtroPropriedade(usuario)] }
// Sempre dentro de AND (e nao com ...): assim o filtro nunca sobrescreve outra chave, como o id.

// Filtro que nunca casa com nenhuma linha: lista vazia e 404 por id.
const NUNCA_CASA = { id: { in: [] } };

// ADMIN ve tudo; PRODUTOR ve so as proprias propriedades.
// Negar por padrao: TECNICO (ainda sem vinculo com propriedades no banco) e qualquer
// perfil desconhecido nao veem nada. Um perfil novo comeca sem acesso, nunca com acesso por engano.
function filtroPropriedade(usuario) {
  if (!usuario) return NUNCA_CASA;
  if (usuario.perfil === "ADMIN") return {};
  if (usuario.perfil === "PRODUTOR") return { usuarioId: usuario.id };
  return NUNCA_CASA;
}

// Lote e sensor herdam o dono da propriedade. Para o ADMIN devolvemos {} para nao
// criar junções sem necessidade na consulta.
function filtroLote(usuario) {
  const filtro = filtroPropriedade(usuario);
  return Object.keys(filtro).length === 0 ? {} : { propriedade: filtro };
}

function filtroSensor(usuario) {
  const filtro = filtroLote(usuario);
  return Object.keys(filtro).length === 0 ? {} : { lote: filtro };
}

// Filtro de lote SO para as rotas de Lotes: alem do dono, exige o lote ATIVO.
// Fica separado de filtroLote de proposito: filtroSensor e filtroLeitura usam filtroLote e NAO devem
// herdar o status, para o historico de sensores e leituras continuar visivel mesmo com o lote inativo.
function filtroLoteAtivo(usuario) {
  return { status: "ATIVO", ...filtroLote(usuario) };
}

// Leitura herda o dono do sensor (leitura -> sensor -> lote -> propriedade).
function filtroLeitura(usuario) {
  const filtro = filtroSensor(usuario);
  return Object.keys(filtro).length === 0 ? {} : { sensor: filtro };
}

module.exports = { filtroPropriedade, filtroLote, filtroLoteAtivo, filtroSensor, filtroLeitura };
