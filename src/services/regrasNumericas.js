// Regras numericas compartilhadas entre os servicos de recomendacao, janelas e risco.
// Mudar uma faixa ou a precisao e mexer so aqui.

// Faixa fisicamente plausivel de uma leitura de sensor. Fora dela, a leitura
// e tratada como defeito do sensor (ex.: 85 °C ou -127 °C) e descartada.
const TEMPERATURA_MINIMA_VALIDA = -10;
const TEMPERATURA_MAXIMA_VALIDA = 60;
const UMIDADE_MINIMA_VALIDA = 0;
const UMIDADE_MAXIMA_VALIDA = 100;

// Precisao maxima de preco aceita pelo sistema (CotacaoMercado.precoMedio e Decimal(14, 4)).
const CASAS_MARGEM = 4;

// Subtracao de decimais em JS gera residuos (8.40 - 2.30 = 6.1000000000000005).
// Arredondar a margem antes de comparar evita que margens iguais pareçam diferentes.
function arredondarMargem(valor) {
  const fator = 10 ** CASAS_MARGEM;
  return Math.round(valor * fator) / fator;
}

function temperaturaValida(valor) {
  return (
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor >= TEMPERATURA_MINIMA_VALIDA &&
    valor <= TEMPERATURA_MAXIMA_VALIDA
  );
}

function umidadeValida(valor) {
  return (
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor >= UMIDADE_MINIMA_VALIDA &&
    valor <= UMIDADE_MAXIMA_VALIDA
  );
}

module.exports = {
  TEMPERATURA_MINIMA_VALIDA,
  TEMPERATURA_MAXIMA_VALIDA,
  UMIDADE_MINIMA_VALIDA,
  UMIDADE_MAXIMA_VALIDA,
  CASAS_MARGEM,
  arredondarMargem,
  temperaturaValida,
  umidadeValida,
};
