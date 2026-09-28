const { Router } = require("express");
const propriedadeRoutes = require("./propriedadeRoutes");

const router = Router();

// Serve para conferir rapidamente se o servidor esta no ar.
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/propriedades", propriedadeRoutes);

module.exports = router;
