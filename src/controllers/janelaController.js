const { validarId } = require("../validators/propriedadeValidator");
const { validarJanelas } = require("../validators/janelaValidator");
const service = require("../services/janelaService");

async function consultar(req, res) {
  const agora = new Date();
  const id = validarId(req.params.id);
  const parametros = validarJanelas(req.body, agora);

  res.json(
    await service.consultar(
      id,
      parametros,
      req.usuario,
      { agora },
    ),
  );
}

module.exports = { consultar };