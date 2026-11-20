// Regressao: margens iguais nao podem virar "exportacao maior" por residuo de ponto flutuante
// (8.40 - 2.30 = 6.1000000000000005), e leitura impossivel de sensor nao pode gerar alerta.
// Funcoes puras: nenhum teste aqui toca banco.

const { recomendar } = require("../src/services/recomendacaoService");
const { calcularJanelas } = require("../src/services/motorJanelas");
const { calcular } = require("../src/services/riscoService");
const { arredondarMargem } = require("../src/services/regrasNumericas");

const MOTIVO_MARGEM =
  "Margem da exportação não é positiva e superior à margem interna.";

// ---------- Problema 1: margem ----------

const EMPATE = {
  precoExportacaoKg: 8.4,
  custoExportacaoKg: 2.3,
  precoInternoKg: 6.1,
  custoInternoKg: 0,
};

const EXPORTACAO_MAIOR = {
  precoExportacaoKg: 12,
  custoExportacaoKg: 2.3,
  precoInternoKg: 6.1,
  custoInternoKg: 0,
};

test("arredondarMargem remove o resíduo de 8.40 - 2.30", () => {
  expect(8.4 - 2.3).not.toBe(6.1);
  expect(arredondarMargem(8.4 - 2.3)).toBe(6.1);
});

describe("recomendacaoService", () => {
  // Todas as outras condições favorecem exportar: só a margem decide.
  const base = {
    grausDiaAcumulados: 1200,
    grausDiaAlvo: 1000,
    chuvaPrevistaMm: 0,
    chuvaLimiteMm: 5,
    umidadePrevista: 50,
    umidadeLimite: 80,
    horasAteResfriamento: 2,
    tempoTransporteHoras: 24,
    vidaUtilHoras: 72,
    cadeiaFrioGarantida: true,
  };

  test("margens iguais (8.40 - 2.30 vs 6.10): exportação NÃO favorável", () => {
    const resultado = recomendar({ ...base, ...EMPATE }, "MATURACAO");

    expect(resultado.colheita.favoravel).toBe(true);
    expect(resultado.exportacao).toEqual({
      favoravel: false,
      margemInternaKg: 6.1,
      margemExportacaoKg: 6.1,
    });
  });

  test("controle: margem de exportação claramente maior é favorável", () => {
    const resultado = recomendar({ ...base, ...EXPORTACAO_MAIOR }, "MATURACAO");

    expect(resultado.exportacao).toEqual({
      favoravel: true,
      margemInternaKg: 6.1,
      margemExportacaoKg: 9.7,
    });
  });
});

describe("motorJanelas", () => {
  const agora = new Date("2026-11-20T12:00:00.000Z");

  // Referência às 00:00 UTC de hoje: cobertura 100% sem leituras,
  // e o acumulado de referência já passa do alvo (colheita favorável hoje).
  function calcularCom(precos) {
    return calcularJanelas({
      lote: { faseFenologica: "MATURACAO" },
      leituras: [],
      agora,
      rota: { id: 1, tempoEstimadoHoras: "24" },

      previsao: {
        fonte: "teste",
        consultadaEm: agora.toISOString(),
        dias: [
          {
            data: "2026-11-20",
            temperaturaMedia: 25,
            chuvaMm: 0,
            umidadeAr: 50,
          },
        ],
      },

      parametros: {
        dataHoraReferencia: new Date("2026-11-20T00:00:00.000Z"),
        grausDiaReferencia: 2000,
        temperaturaBase: 10,
        grausDiaAlvo: 1000,
        chuvaMaxMm: 10,
        umidadeArMaxPercentual: 80,
        fonteParametros: "teste",
        versaoParametros: "1",
        rotaLogisticaId: 1,
        horasAteResfriamento: 2,
        vidaUtilHoras: 100,
        cadeiaFrioGarantida: true,
        moeda: "BRL",
        dataHoraCotacao: new Date("2026-11-19T00:00:00.000Z"),
        fonteCotacao: "teste",
        ...precos,
      },
    });
  }

  test("margens iguais (8.40 - 2.30 vs 6.10): exportação NÃO favorável", () => {
    const resultado = calcularCom(EMPATE);

    expect(resultado.colheita.status).toBe("FAVORAVEL");
    expect(resultado.exportacao.status).toBe("NAO_FAVORAVEL");
    expect(resultado.exportacao.motivos).toEqual([MOTIVO_MARGEM]);
    expect(resultado.exportacao.margemInternaKg).toBe(6.1);
    expect(resultado.exportacao.margemExportacaoKg).toBe(6.1);
    expect(resultado.exportacao.janelas).toEqual([]);
  });

  test("controle: margem de exportação claramente maior é favorável", () => {
    const resultado = calcularCom(EXPORTACAO_MAIOR);

    expect(resultado.exportacao.status).toBe("FAVORAVEL");
    expect(resultado.exportacao.motivos).toEqual([]);
    expect(resultado.exportacao.margemExportacaoKg).toBe(9.7);
    expect(resultado.exportacao.janelas).toHaveLength(1);
  });
});

// ---------- Problema 2: faixa válida do sensor ----------

describe("riscoService.calcular", () => {
  const cultura = {
    temperaturaMin: "10",
    temperaturaMax: "35",
    umidadeMin: "30",
    umidadeMax: "90",
  };

  // 6 horas de leituras a cada 5 minutos (73 amostras), umidade normal.
  function seisHoras(temperatura) {
    const inicio = +new Date("2026-11-19T00:00:00.000Z");

    return Array.from({ length: 73 }, (_, indice) => ({
      dataHoraLeitura: new Date(inicio + indice * 5 * 60000),
      temperatura,
      umidade: 50,
    }));
  }

  test("6 horas a 85 °C (sensor com defeito) não geram alerta de temperatura", () => {
    const resultado = calcular(seisHoras(85), cultura);

    expect(
      resultado.alertas.filter((alerta) => alerta.tipo.startsWith("TEMPERATURA"))
    ).toEqual([]);
    expect(resultado.horasObservadas).toBe(0);
  });

  test("controle: 6 horas a 40 °C (alta, mas válida) geram alerta MODERADO e ALTO", () => {
    const resultado = calcular(seisHoras(40), cultura);

    expect(
      resultado.alertas.map((alerta) => [alerta.tipo, alerta.nivel, alerta.duracaoMinutos])
    ).toEqual([
      ["TEMPERATURA_ALTA", "MODERADO", 360],
      ["TEMPERATURA_ALTA", "ALTO", 360],
    ]);
  });

  test("umidade fora de 0..100 também é descartada", () => {
    const leituras = seisHoras(25).map((leitura) => ({ ...leitura, umidade: 150 }));

    expect(calcular(leituras, cultura).alertas).toEqual([]);
  });
});
