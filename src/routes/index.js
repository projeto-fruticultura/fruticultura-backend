const { Router } = require('express');
const culturaRoutes = require('./culturaRoutes');
const propriedadeRoutes = require('./propriedadeRoutes');
const sensorRoutes = require('./sensorRoutes');
const mercadoRoutes = require('./mercadoRoutes'); // Importa aqui
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');

const routes = Router();

routes.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

routes.use('/culturas', culturaRoutes);
routes.use('/propriedades', propriedadeRoutes);
routes.use('/sensores', sensorRoutes);
routes.use('/precos', mercadoRoutes); // <--- Tem de estar assim: /precos
// Login publico; /me e /logout exigem token. As rotas acima ainda nao exigem login.
routes.use('/auth', authRoutes);
// So ADMIN logado cria usuarios (a protecao fica no proprio usuarioRoutes).
routes.use('/usuarios', usuarioRoutes);

module.exports = routes;