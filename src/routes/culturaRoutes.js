const { Router } = require("express");
const controller = require("../controllers/culturaController");

const router = Router();

// Caminhos sem "/culturas": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);
// Antes de "/:id" para deixar claro que "detalhes" e uma rota propria.
router.get("/:id/detalhes", controller.detalhes);
router.get("/:id", controller.buscarPorId);
router.post("/", controller.criar);
router.put("/:id", controller.atualizar);
router.delete("/:id", controller.remover);

module.exports = router;
