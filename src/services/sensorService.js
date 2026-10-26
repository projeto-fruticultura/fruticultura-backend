const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
      where: { tecnicoId: usuario.id },
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

async function listarLeiturasComFiltro(sensorId, periodo, usuario) {
  const sensor = await buscarPorId(sensorId, usuario);
  if (!sensor) {
    throw new Error("Sensor não encontrado ou sem permissão.");
  }

  const agora = new Date();
  let dataInicial = new Date();

  // Tratamento dos períodos solicitados
  if (periodo === "7d") {
    dataInicial.setDate(agora.getDate() - 7);
  } else if (periodo === "30d") {
    dataInicial.setDate(agora.getDate() - 30);
  } else {
    // Padrão: 24h
    dataInicial.setHours(agora.getHours() - 24);
  }

  const leituras = await prisma.leitura.findMany({
    where: {
      sensorId: Number(sensorId),
      criadoEm: {
        gte: dataInicial,
        lte: agora
      }
    },
    orderBy: {
      criadoEm: "asc"
    }
  });

  // Cálculo real das agregações estatísticas com base nos dados reais recolhidos
  let estatisticas = {
    temperaturaMedia: 0,
    temperaturaMin: 0,
    temperaturaMax: 0,
    umidadeMedia: 0,
    umidadeMin: 0,
    umidadeMax: 0,
    totalLeituras: leituras.length
  };

  if (leituras.length > 0) {
    const somaTemp = leituras.reduce((acc, l) => acc + Number(l.temperatura || 0), 0);
    const somaUmi = leituras.reduce((acc, l) => acc + Number(l.umidade || 0), 0);
    const temps = leituras.map(l => Number(l.temperatura || 0));
    const umidades = leituras.map(l => Number(l.umidade || 0));

    estatisticas.temperaturaMedia = Number((somaTemp / leituras.length).toFixed(2));
    estatisticas.temperaturaMin = Math.min(...temps);
    estatisticas.temperaturaMax = Math.max(...temps);
    estatisticas.umidadeMedia = Number((somaUmi / leituras.length).toFixed(2));
    estatisticas.umidadeMin = Math.min(...umidades);
    estatisticas.umidadeMax = Math.max(...umidades);
  }

  return {
    periodoSelecionado: periodo || "24h",
    estatisticas,
    leituras
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