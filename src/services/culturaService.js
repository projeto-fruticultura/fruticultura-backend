const prisma = require('../config/prisma');

class CulturaService {
  // Busca todas as culturas cadastradas (Para renderizar os cards na tela)
  async listarTodas() {
    return await prisma.cultura.findMany({
      orderBy: { id: 'desc' },
    });
  }

  // Busca uma cultura pelo ID
  async buscarPorId(id) {
    return await prisma.cultura.findUnique({
      where: { id: Number(id) },
    });
  }

  // Cria uma nova cultura (Formulário da tela "Adicionar cultura")
  async criar(dados) {
    return await prisma.cultura.create({
      data: {
        nome: dados.nome,
        variedade: dados.variedade || null,
        descricao: dados.descricao || null,
        temperaturaMin: dados.temperaturaMin,
        temperaturaMax: dados.temperaturaMax,
        umidadeMin: dados.umidadeMin,
        umidadeMax: dados.umidadeMax,
      },
    });
  }

  // Edita uma cultura existente
  async atualizar(id, dados) {
    return await prisma.cultura.update({
      where: { id: Number(id) },
      data: {
        nome: dados.nome,
        variedade: dados.variedade || null,
        descricao: dados.descricao || null,
        temperaturaMin: dados.temperaturaMin,
        temperaturaMax: dados.temperaturaMax,
        umidadeMin: dados.umidadeMin,
        umidadeMax: dados.umidadeMax,
      },
    });
  }

  // Remove uma cultura
  async deletar(id) {
    return await prisma.cultura.delete({
      where: { id: Number(id) },
    });
  }
}

module.exports = new CulturaService();