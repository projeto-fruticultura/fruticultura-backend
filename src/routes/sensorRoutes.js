const { Router } = require('express');
const sensorController = require('../controllers/sensorController');

const router = Router();


router.get('/sensores', sensorController.listarSensores);
router.post('/sensores', sensorController.criarSensor);

module.exports = router;