const culturaService = require('../services/culturaService.js');
const { culturaSchema } = require('../validators/culturaValidator.js');

class CulturaController {
  async index(req, res) {
    try {
      const culturas = await culturaService.listarTodas();
      return res.json(culturas);
    } catch (error) {
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
      return res.status(500).json({ erro: 'Erro ao buscar a cultura.' });
    }
  }

  async create(req, res) {
    try {
      await culturaSchema.validate(req.body);
      const novaCultura = await culturaService.criar(req.body);
      return res.status(201).json(novaCultura);
    } catch (error) {
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
      return res.status(400).json({ erro: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await culturaService.deletar(id);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ erro: 'Erro ao excluir cultura.' });
    }
  }
}

module.exports = new CulturaController();