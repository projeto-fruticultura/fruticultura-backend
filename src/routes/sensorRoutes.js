const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const controller = require("../controllers/sensorController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Todas as rotas exigem login: cada usuario so ve os sensores das proprias propriedades.
router.use(autenticar);

// Criar, editar e apagar: so ADMIN e PRODUTOR. TECNICO (e perfil desconhecido) recebe 403.
const podeAlterar = exigirPerfil("ADMIN", "PRODUTOR");

// Configurar o ThingSpeak: so ADMIN e TECNICO. PRODUTOR (e perfil desconhecido) recebe 403.
const podeConfigurar = exigirPerfil("ADMIN", "TECNICO");

// Cada chamada da config dispara uma consulta ao ThingSpeak: 10 por usuario a cada 15 minutos,
// contando todas (as tentativas com chave errada sao justamente as que interessa limitar).
// A chave e o id do usuario, e nao o IP: a rota ja exige login. O contador fica em memoria.
const limitarConfig = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.usuario.id),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: { erro: "Muitas tentativas de configuração. Tente novamente em 15 minutos." },
});

// Caminhos sem "/sensores": o prefixo e definido em routes/index.js.
// /config vem antes das rotas com /:id, para nunca ser lido como um id.
router.post("/config", podeConfigurar, limitarConfig, controller.configurarThingSpeak);
router.get("/", controller.listar);
router.get("/:id", controller.buscarPorId);
router.get("/:id/leituras", controller.listarLeituras);
router.post("/", podeAlterar, controller.criar);
router.put("/:id", podeAlterar, controller.atualizar);
router.delete("/:id", podeAlterar, controller.remover);

module.exports = router;
