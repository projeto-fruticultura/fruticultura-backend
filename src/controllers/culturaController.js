const culturaService = require('../services/culturaService.js');
const { culturaSchema } = require('../validators/culturaValidator.js');

class CulturaController {
  async index(req, res) {
    try {
      const culturas = await culturaService.listarTodas();
      return res.json(culturas);
    } catch (error) {
      console.error('[Erro em listarTodas]:', error);
      return res.status(500).json({ erro: 'Erro interno ao buscar culturas.' });
    }
  }

  async show(req, res) {
    try {
      const { id } = req.params;
      const cultura = await culturaService.buscarPorId(id);

      if (!cultura) {
        return res.status(404).json({ erro: 'Cultura não encontrada.' });
      }

      return res.json(cultura);
    } catch (error) {
      console.error('[Erro em buscarPorId]:', error);
      return res.status(500).json({ erro: 'Erro ao buscar a cultura.' });
    }
  }

  async create(req, res) {
    try {
      await culturaSchema.validate(req.body);
      const novaCultura = await culturaService.criar(req.body);
      return res.status(201).json(novaCultura);
    } catch (error) {
      console.error('[Erro em criar]:', error);
      return res.status(400).json({ erro: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      await culturaSchema.validate(req.body);
      const culturaAtualizada = await culturaService.atualizar(id, req.body);
      return res.json(culturaAtualizada);
    } catch (error) {
      console.error('[Erro em atualizar]:', error);
      return res.status(400).json({ erro: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await culturaService.deletar(id);
      return res.status(204).send();
    } catch (error) {
      console.error('[Erro em deletar]:', error);
      return res.status(500).json({ erro: 'Erro ao excluir cultura.' });
    }
  }

  async detalhesCompletos(req, res) {
    try {
      const { id } = req.params;
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({ erro: 'Latitude e longitude são obrigatórias.' });
      }

      const detalhes = await culturaService.obterDetalhesCompletos(id, lat, lon);
      return res.json(detalhes);
    } catch (error) {
      console.error('[Erro em detalhesCompletos]:', error);
      return res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = new CulturaController();