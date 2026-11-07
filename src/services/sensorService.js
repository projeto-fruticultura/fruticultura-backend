const prisma = require("../config/prisma");

const {
  ErroHttp,
} = require("../middlewares/erros");

// A chave de leitura do ThingSpeak e segredo: toda consulta de sensor deste arquivo a omite,
// para ela nunca sair numa resposta. Só a configuração do ThingSpeak a lê, pedindo explicitamente.
const SEM_READ_API_KEY = { readApiKey: true };

async function listar(usuario) {
  if (usuario.perfil === "ADMIN") {
    return await prisma.sensor.findMany({
      omit: SEM_READ_API_KEY,
      include: { lote: { include: { propriedade: true } } }
    });
  }

  if (usuario.perfil === "PRODUTOR") {
    return await prisma.sensor.findMany({
      where: {
        lote: {
          propriedade: {
            usuarioId: usuario.id
          }
        }
      },
      omit: SEM_READ_API_KEY,
      include: { lote: { include: { propriedade: true } } }
    });
  }

  if (usuario.perfil === "TECNICO") {
    const vinculos = await prisma.tecnicoPropriedade.findMany({
      where: { usuarioId: usuario.id },
      select: { propriedadeId: true }
    });
    const propriedadeIds = vinculos.map(v => v.propriedadeId);

    return await prisma.sensor.findMany({
      where: {
        lote: {
          propriedadeId: {
            in: propriedadeIds
          }
        }
      },
      omit: SEM_READ_API_KEY,
      include: { lote: { include: { propriedade: true } } }
    });
  }

  return [];
}

async function buscarPorId(id, usuario) {
  const sensor = await prisma.sensor.findUnique({
    where: { id: Number(id) },
    omit: SEM_READ_API_KEY,
    include: { lote: { include: { propriedade: true } } }
  });

  if (!sensor) {
    throw new Error("Sensor não encontrado.");
  }

  // Validação de permissão por perfil
  if (usuario.perfil === "PRODUTOR" && sensor.lote.propriedade.usuarioId !== usuario.id) {
    throw new Error("Acesso negado a este sensor.");
  }

  if (usuario.perfil === "TECNICO") {
    const vinculo = await prisma.tecnicoPropriedade.findFirst({
      where: {
        tecnicoId: usuario.id,
        propriedadeId: sensor.lote.propriedadeId
      }
    });
    if (!vinculo) {
      throw new Error("Acesso negado a este sensor.");
    }
  }

  return sensor;
}

async function criar(dados, usuario) {
  // Apenas ADMIN e PRODUTOR podem criar
  const lote = await prisma.lote.findUnique({
    where: { id: dados.loteId },
    include: { propriedade: true }
  });

  if (!lote) {
    throw new Error("Lote não encontrado.");
  }

  if (usuario.perfil === "PRODUTOR" && lote.propriedade.usuarioId !== usuario.id) {
    throw new Error("Não pode criar sensores em lotes de outros produtores.");
  }

  return await prisma.sensor.create({
    data: dados,
    omit: SEM_READ_API_KEY
  });
}

async function atualizar(id, dados, usuario) {
  // Valida se o sensor existe e se o usuário tem permissão para aceder
  const sensorAtual = await buscarPorId(id, usuario);

  // Se estiver a alterar o lote do sensor, valida o novo lote de destino
  if (dados.loteId && Number(dados.loteId) !== sensorAtual.loteId) {
    const novoLote = await prisma.lote.findUnique({
      where: { id: Number(dados.loteId) },
      include: { propriedade: true }
    });

    if (!novoLote) {
      throw new Error("O lote de destino informado não existe.");
    }

    if (usuario.perfil === "PRODUTOR" && novoLote.propriedade.usuarioId !== usuario.id) {
      throw new Error("Você não pode mover o sensor para um lote de outra propriedade.");
    }
  }

  return await prisma.sensor.update({
    where: { id: Number(id) },
    data: dados,
    omit: SEM_READ_API_KEY
  });
}

async function remover(id, usuario) {
  await buscarPorId(id, usuario); // Valida se existe e permissões

  // Soft Delete: Inativa o sensor para preservar o histórico de leituras no banco de dados
  return await prisma.sensor.update({
    where: { id: Number(id) },
    data: { status: "INATIVO" },
    omit: SEM_READ_API_KEY
  });
}

async function listarLeiturasComFiltro(
  sensorId,
  periodo = "24h",
  usuario,
  query = {}
) {
  await buscarPorId(sensorId, usuario);

  const {
    validarFiltrosLeitura,
  } = require("../validators/leituraValidator");

  const filtros = validarFiltrosLeitura({
    ...query,
    periodo,
    sensorId: String(sensorId),
  });

  const historico =
    await require("./leituraService").listar(
      usuario,
      filtros
    );

  const agregado =
    await prisma.leitura.aggregate({
      where: {
        sensorId,

        dataHoraLeitura: {
          gte: filtros.de,
          lte: filtros.ate,
        },
      },

      _avg: {
        temperatura: true,
        umidade: true,
      },

      _min: {
        temperatura: true,
        umidade: true,
      },

      _max: {
        temperatura: true,
        umidade: true,
      },

      _count: true,
    });

  const estatisticas = {
    totalLeituras: agregado._count,
  };

  for (const campo of ["temperatura", "umidade"]) {
    estatisticas[`${campo}Media`] =
      agregado._avg[campo];

    estatisticas[`${campo}Min`] =
      agregado._min[campo];

    estatisticas[`${campo}Max`] =
      agregado._max[campo];
  }

  return {
    periodoSelecionado: periodo,
    estatisticas,
    leituras: historico.dados,
    paginacao: historico.paginacao,
  };
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
  listarLeiturasComFiltro
};