// Configuracao do JWT. Lida uma vez, quando o app carrega: se estiver errada,
// o servidor nem sobe, em vez de funcionar com um segredo fraco.

// Segredo curto pode ser descoberto por forca bruta, e quem o descobre forja tokens.
// 32 caracteres e o minimo combinado pelo grupo.
const TAMANHO_MINIMO_SEGREDO = 32;
const COMO_GERAR = "Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"";

const JWT_SECRET = process.env.JWT_SECRET;

// A mensagem diz so o que falta, nunca o valor: ela pode aparecer em logs.
if (!JWT_SECRET) {
  throw new Error(`A variável de ambiente JWT_SECRET não foi definida no .env. ${COMO_GERAR}`);
}
if (JWT_SECRET.length < TAMANHO_MINIMO_SEGREDO) {
  throw new Error(
    `A variável de ambiente JWT_SECRET precisa ter pelo menos ${TAMANHO_MINIMO_SEGREDO} caracteres. ${COMO_GERAR}`
  );
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

// Exige numero + unidade (ex.: 2h, 30m). Sem unidade, o jsonwebtoken le "7200" como
// milissegundos, e o token expiraria em 7 segundos sem ninguem perceber o porque.
if (!/^\d+[smhd]$/.test(JWT_EXPIRES_IN)) {
  throw new Error("A variável de ambiente JWT_EXPIRES_IN deve ser um número com unidade, por exemplo 2h ou 30m.");
}

// Algoritmo fixo: o mesmo no sign e no verify, para bloquear token com "alg: none".
const JWT_ALGORITMO = "HS256";

module.exports = { JWT_SECRET, JWT_EXPIRES_IN, JWT_ALGORITMO };
