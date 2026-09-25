const { PrismaClient } = require("@prisma/client");

// Instancia unica: cada PrismaClient abre seu proprio pool de conexoes,
// e criar varios esgota o limite do banco no Render.
const prisma = new PrismaClient();

module.exports = prisma;
