const { Router } = require("express");
const controller = require("../controllers/culturaController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// Leitura aberta (a tela de Culturas le sem token). Escrita so ADMIN: a cultura e um
// catalogo compartilhado e mudar as faixas de temperatura e umidade muda os alertas de todos os produtores.
// autenticar vem antes de exigirPerfil (que usa o req.usuario) e antes do controller, que valida o corpo e o id:
// sem token e sempre 401, nunca 400.
const soAdmin = [autenticar, exigirPerfil("ADMIN")];

// Caminhos sem "/culturas": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);
// Antes de "/:id" para deixar claro que "detalhes" e uma rota propria.
router.get("/:id/detalhes", controller.detalhes);
router.get("/:id", controller.buscarPorId);
router.post("/", ...soAdmin, controller.criar);
router.put("/:id", ...soAdmin, controller.atualizar);
router.delete("/:id", ...soAdmin, controller.remover);

module.exports = router;
