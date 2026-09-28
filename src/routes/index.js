const { Router } = require('express');
const culturaRoutes = require('./culturaRoutes');
const propriedadeRoutes = require('./propriedadeRoutes');
const sensorRoutes = require('./sensorRoutes');

const routes = Router();

// Serve para conferir rapidamente se o servidor esta no ar.
routes.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

routes.use(culturaRoutes);
// Com prefixo: sem ele, o "/:id" de propriedades capturava /sensores, /health etc.
routes.use('/propriedades', propriedadeRoutes);
routes.use(sensorRoutes); // <-- Usa diretamente, pois o ficheiro já tem '/sensores'

module.exports = routes;