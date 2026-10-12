const { Router } = require("express");
const controller = require("../controllers/leituraController");
const { autenticar } = require("../middlewares/autenticar");

const router = Router();

// So consulta: as leituras entram unicamente pelo agendador (ThingSpeak), entao nao ha POST, PUT nem DELETE.
// Exige login; o filtro de dono fica no service (o TECNICO ve so o das propriedades vinculadas a ele; perfil desconhecido ve lista vazia).
router.use(autenticar);

// Caminho sem "/leituras": o prefixo e definido em routes/index.js.
router.get("/", controller.listar);

module.exports = router;
