const {
  Router,
} = require("express");

const {
  autenticar,
  exigirPerfil,
} = require("../middlewares/autenticar");

const controller =
  require("../controllers/cotacaoMercadoController");

const router = Router();

router.use(
  autenticar,

  exigirPerfil(
    "ADMIN",
    "TECNICO",
    "PRODUTOR"
  )
);

router.get(
  "/",
  controller.listar
);

router.get(
  "/:id",
  controller.buscarPorId
);

router.post(
  "/",
  exigirPerfil("ADMIN"),
  controller.criar
);

router.put(
  "/:id",
  exigirPerfil("ADMIN"),
  controller.atualizar
);

router.delete(
  "/:id",
  exigirPerfil("ADMIN"),
  controller.remover
);

module.exports = router;