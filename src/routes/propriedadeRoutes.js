const { Router } = require("express");
const controller = require("../controllers/propriedadeController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Todas as rotas exigem login: cada usuario so ve as proprias propriedades (inclusive o /clima).
router.use(autenticar);

// Criar, editar e apagar: so ADMIN e PRODUTOR. TECNICO (e perfil desconhecido) recebe 403.
const podeAlterar = exigirPerfil("ADMIN", "PRODUTOR");

router.get("/", controller.listar);
router.get("/:id/clima", controller.buscarClima);
router.get("/:id", controller.buscarPorId);
router.post("/", podeAlterar, controller.criar);
router.put("/:id", podeAlterar, controller.atualizar);
router.delete("/:id", podeAlterar, controller.remover);

module.exports = router;
