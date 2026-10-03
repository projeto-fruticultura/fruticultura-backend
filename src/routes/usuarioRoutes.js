const { Router } = require("express");
const controller = require("../controllers/usuarioController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Nao ha cadastro publico: so um ADMIN logado cria usuarios.
// autenticar vem antes porque exigirPerfil usa o req.usuario que ele preenche.
router.post("/", autenticar, exigirPerfil("ADMIN"), controller.criar);

module.exports = router;
