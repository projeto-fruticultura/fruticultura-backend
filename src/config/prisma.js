const { PrismaClient } = require("@prisma/client");
const contexto = require("./contexto");

const base = new PrismaClient();

const operacoes = {
  create: "CREATE",
  createMany: "CREATE",
  update: "UPDATE",
  updateMany: "UPDATE",
  upsert: "UPDATE",
  delete: "DELETE",
  deleteMany: "DELETE",
};

function envolver(cliente, transacional = false) {
  return new Proxy(cliente, {
    get(alvo, nome) {
      if (nome === "$transaction") {
        return (argumento, opcoes) => {
          if (typeof argumento === "function") {
            return alvo.$transaction(
              (tx) => argumento(envolver(tx, true)),
              opcoes
            );
          }

          return alvo.$transaction(argumento, opcoes);
        };
      }

      const valor = alvo[nome];

      if (
        !valor ||
        typeof valor !== "object" ||
        !valor.findMany ||
        nome === "auditoria"
      ) {
        return typeof valor === "function"
          ? valor.bind(alvo)
          : valor;
      }

      return new Proxy(valor, {
        get(delegate, operacao) {
          const funcao = delegate[operacao];

          if (typeof funcao !== "function") {
            return funcao;
          }

          return (argumentos) => {
            const req = contexto.getStore()?.req;

            if (!operacoes[operacao] || !req?.usuario) {
              return funcao.call(delegate, argumentos);
            }

            async function executar(tx) {
              const resultado =
                await tx[nome][operacao](argumentos);

              const recursoId =
                resultado?.id ?? argumentos?.where?.id;

              await tx.auditoria.create({
                data: {
                  usuarioId: req.usuario.id,

                  operacao:
                    req.method === "DELETE"
                      ? "DELETE"
                      : operacoes[operacao],

                  recurso: String(nome),

                  recursoId:
                    recursoId === undefined
                      ? null
                      : String(recursoId),

                  ip: req.ip || "desconhecido",
                },
              });

              return resultado;
            }

            if (transacional) {
              return executar(alvo);
            }

            return base.$transaction(executar);
          };
        },
      });
    },
  });
}

module.exports = envolver(base);