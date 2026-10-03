const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const controller = require("../controllers/authController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// Limita tentativas de login por IP para dificultar adivinhar senhas por forca bruta.
// So as falhas contam (respostas 400 e 401): quem acerta a senha nao deve ser bloqueado
// por entrar varias vezes, e a forca bruta e feita de tentativas erradas.
// O contador fica em memoria: zera quando o servidor reinicia.
// Atencao: atras de um proxy (Render) sem "trust proxy" configurado, todos os usuarios
// aparecem com o IP do proxy e dividem o mesmo limite. Configuracao pendente de decisao.
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." },
});

router.post("/login", limitarLogin, controller.login);
router.get("/me", autenticar, controller.me);
router.post("/logout", autenticar, controller.logout);

module.exports = router;
