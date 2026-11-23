const { Router } = require("express");
const controller = require("../controllers/produtividadeController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// Consulta autenticada de previsões municipais de produtividade.
// As estimativas são experimentais e não representam
// previsões individuais de propriedades agrícolas.
router.get("/previsoes", autenticar, controller.consultar);

module.exports = router;