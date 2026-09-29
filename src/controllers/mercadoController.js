const mercadoService = require('../services/mercadoService');
const { validarFiltrosPrecos } = require('../validators/mercadoValidator');

async function listarPrecos(req, res, next) {
  try {
    // Se for GET usa req.query, se for POST usa req.body
    const dadosOrigem = req.method === 'GET' ? req.query : req.body;
    const filtros = validarFiltrosPrecos(dadosOrigem);
    
    const resultado = await mercadoService.consultarPrecos(filtros);
    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listarPrecos };