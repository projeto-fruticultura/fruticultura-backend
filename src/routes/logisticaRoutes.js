const { Router } = require("express");

const controller =
  require("../controllers/logisticaController");

const {
  autenticar,
  exigirPerfil,
} = require("../middlewares/autenticar");

const router = Router();

router.use(autenticar);

const podeAlterar = exigirPerfil(
  "ADMIN",
  "PRODUTOR"
);

router.get("/", controller.listar);

// Deve aparecer antes de /:id.
router.get("/comparar", controller.comparar);

router.get("/:id", controller.buscarPorId);

router.post(
  "/",
  podeAlterar,
  controller.criar
);

router.put(
  "/:id",
  podeAlterar,
  controller.atualizar
);

router.delete(
  "/:id",
  podeAlterar,
  controller.remover
);

module.exports = router;