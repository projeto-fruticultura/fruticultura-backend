const { Router } = require("express");
const controller = require("../controllers/sensorController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Todas as rotas exigem login: cada usuario so ve os sensores das proprias propriedades.
router.use(autenticar);

// Criar, editar e apagar: so ADMIN e PRODUTOR. TECNICO (e perfil desconhecido) recebe 403.
const podeAlterar = exigirPerfil("ADMIN", "PRODUTOR");

// Caminhos sem "/sensores": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);
router.get("/:id", controller.buscarPorId);
router.post("/", podeAlterar, controller.criar);
router.put("/:id", podeAlterar, controller.atualizar);
router.delete("/:id", podeAlterar, controller.remover);

module.exports = router;
