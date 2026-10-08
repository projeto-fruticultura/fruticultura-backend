const { Router } = require("express");
const controller = require("../controllers/alertaController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// So consulta: os alertas sao calculados na hora a partir da ultima leitura de cada sensor, sem gravar nada.
// Exige login; o filtro de dono fica no service (TECNICO e perfil desconhecido veem lista vazia).
router.use(autenticar);

// Caminho sem "/alertas": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);

module.exports = router;
