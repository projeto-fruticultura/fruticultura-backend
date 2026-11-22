const { Router } = require("express");
const controller = require("../controllers/dashboardController");
const { autenticar, exigirPerfil } = require("../middlewares/autenticar");

const router = Router();

// So consulta: resumo e medias sao calculados na hora a partir das leituras, sem gravar nada.
// Exige login; o filtro de dono fica no service (o TECNICO ve so o das propriedades vinculadas a ele; perfil desconhecido recebe resposta vazia).
router.use(autenticar);

// Caminhos sem "/dashboard": o prefixo e definido em routes/index.js.
router.get("/resumo", controller.resumo);
router.get("/medias", controller.medias);

const produtor = exigirPerfil("PRODUTOR");
router.get("/produtor/areas", produtor, controller.areasProdutor);
router.get("/produtor/alertas-do-dia", produtor, controller.alertasProdutor);

module.exports = router;
