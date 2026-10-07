const { Router } = require("express");
const controller = require("../controllers/loteController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// Somente leitura por enquanto: nao ha POST, PUT nem DELETE de lote.
// Exige login; o filtro de dono fica no service (TECNICO e perfil desconhecido veem lista vazia).
router.use(autenticar);

// Caminhos sem "/lotes": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);
router.get("/:id", controller.buscarPorId);

module.exports = router;
