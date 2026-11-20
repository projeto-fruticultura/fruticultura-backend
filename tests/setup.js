process.env.JWT_SECRET =
  "segredo-exclusivo-de-testes-com-mais-de-32-caracteres";

process.env.LEITURAS_AGENDADOR_ATIVO =
  "false";

// Impede acesso acidental ao banco compartilhado.
// Os testes utilizam Prisma simulado.
process.env.DATABASE_URL =
  "postgresql://teste:teste@127.0.0.1:1/nao_existe?connect_timeout=1";