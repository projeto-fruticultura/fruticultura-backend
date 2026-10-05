const { Router } = require('express');
const culturaRoutes = require('./culturaRoutes');
const propriedadeRoutes = require('./propriedadeRoutes');
const sensorRoutes = require('./sensorRoutes');
const loteRoutes = require('./loteRoutes');
const mercadoRoutes = require('./mercadoRoutes.js'); // Importa aqui
const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');

const routes = Router();

routes.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

routes.use('/culturas', culturaRoutes);
routes.use('/propriedades', propriedadeRoutes);
routes.use('/sensores', sensorRoutes);
// Somente leitura; exige login e mostra so os lotes das propriedades do usuario.
routes.use('/lotes', loteRoutes);
routes.use('/precos', mercadoRoutes); // <--- Tem de estar assim: /precos
// Login publico; /me e /logout exigem token.
// /propriedades, /sensores e /lotes tambem exigem token; /culturas e /precos continuam abertas por enquanto.
routes.use('/auth', authRoutes);
// So ADMIN logado cria usuarios (a protecao fica no proprio usuarioRoutes).
routes.use('/usuarios', usuarioRoutes);

module.exports = routes;