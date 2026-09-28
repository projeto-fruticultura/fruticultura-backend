const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listarSensores = async (req, res, next) => {
  try {
    const sensores = await prisma.sensor.findMany({
      include: {
        lote: {
          include: { cultura: true }
        }
      }
    });
    return res.json(sensores);
  } catch (error) {
    return next(error);
  }
};

const criarSensor = async (req, res, next) => {
  try {
    const { codigo, localizacao, status, dataInstalacao, loteId } = req.body;
    
    const novoSensor = await prisma.sensor.create({
      data: {
        codigo,
        localizacao,
        status: status || 'Ativo',
        dataInstalacao: dataInstalacao ? new Date(dataInstalacao) : null,
        loteId: loteId ? Number(loteId) : null
      }
    });

    return res.status(201).json(novoSensor);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listarSensores,
  criarSensor
};