const { Router } = require('express');
const mercadoController = require('../controllers/mercadoController');

const router = Router();

router.get('/', mercadoController.listarPrecos);

module.exports = router;