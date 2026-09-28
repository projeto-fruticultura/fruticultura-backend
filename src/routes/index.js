const { Router } = require('express');
const culturaRoutes = require('./culturaRoutes');
const propriedadeRoutes = require('./propriedadeRoutes');
const sensorRoutes = require('./sensorRoutes');

const routes = Router();

routes.use(culturaRoutes);
routes.use(propriedadeRoutes);
routes.use(sensorRoutes); // <-- Usa diretamente, pois o ficheiro já tem '/sensores'

module.exports = routes;