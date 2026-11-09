const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const {
  autenticar,
  exigirPerfil,
} = require("../middlewares/autenticar");
const controller = require("../controllers/janelaController");

const router = Router();

router.use(
  autenticar,
  exigirPerfil("ADMIN", "TECNICO", "PRODUTOR"),
);

router.post(
  "/:id/janelas",
  rateLimit({
    windowMs: 60000,
    limit: 20,
    keyGenerator: (req) => String(req.usuario.id),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      erro: "Muitas consultas de previsão. Aguarde um minuto.",
    },
  }),
  controller.consultar,
);

module.exports = router;