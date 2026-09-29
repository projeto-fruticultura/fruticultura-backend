const { Router } = require('express');
const culturaRoutes = require('./culturaRoutes');
const propriedadeRoutes = require('./propriedadeRoutes');
const sensorRoutes = require('./sensorRoutes');
const mercadoRoutes = require('./mercadoRoutes'); // Importa aqui

const routes = Router();

routes.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

routes.use('/culturas', culturaRoutes);
routes.use('/propriedades', propriedadeRoutes);
routes.use('/sensores', sensorRoutes);
routes.use('/precos', mercadoRoutes); // <--- Tem de estar assim: /precos

module.exports = routes;