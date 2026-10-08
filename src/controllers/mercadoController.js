const mercadoService = require('../services/mercadoService');
const { validarFiltrosPrecos } = require('../validators/mercadoValidator');

async function listarPrecos(req, res, next) {
  try {
    const filtros = validarFiltrosPrecos(req.query);
    
    const resultado = await mercadoService.consultarPrecos(filtros);
    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listarPrecos };