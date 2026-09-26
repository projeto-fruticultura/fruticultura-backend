const { Router } = require('express');
const culturaController = require('../controllers/culturaController.js');

const routes = Router();

routes.get('/culturas', culturaController.index);
routes.get('/culturas/:id', culturaController.show);
routes.post('/culturas', culturaController.create);
routes.put('/culturas/:id', culturaController.update);
routes.delete('/culturas/:id', culturaController.delete);

module.exports = routes;