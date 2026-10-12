const { Router } = require("express");
const controller = require("../controllers/usuarioController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Nao ha cadastro publico: so um ADMIN logado lista, cria e inativa usuarios.
// autenticar vem antes porque exigirPerfil usa o req.usuario que ele preenche.
router.get("/", autenticar, exigirPerfil("ADMIN"), controller.listar);
router.post("/", autenticar, exigirPerfil("ADMIN"), controller.criar);
// Exclusao logica: o usuario vira INATIVO e a linha nunca e apagada.
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), controller.remover);

module.exports = router;
