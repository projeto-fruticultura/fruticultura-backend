const { Router } = require("express");
const controller = require("../controllers/sensorController");

const router = Router();

// Caminhos sem "/sensores": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);
router.get("/:id", controller.buscarPorId);
router.post("/", controller.criar);
router.put("/:id", controller.atualizar);
router.delete("/:id", controller.remover);

module.exports = router;
