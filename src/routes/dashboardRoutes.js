const { Router } = require("express");
const controller = require("../controllers/dashboardController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// So consulta: resumo e medias sao calculados na hora a partir das leituras, sem gravar nada.
// Exige login; o filtro de dono fica no service (TECNICO e perfil desconhecido recebem resposta vazia).
router.use(autenticar);

// Caminhos sem "/dashboard": o prefixo e definido em routes/index.js.
router.get("/resumo", controller.resumo);
router.get("/medias", controller.medias);

module.exports = router;
