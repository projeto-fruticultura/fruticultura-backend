const {
  converterFeed,
} = require("../src/services/thingspeakService");

const {
  calcular,
} = require("../src/services/riscoService");

const {
  validarFiltrosLeitura,
} = require("../src/validators/leituraValidator");

const {
  recomendar,
} = require("../src/services/recomendacaoService");

const cultura = {
  temperaturaMin: 15,
  temperaturaMax: 30,
  umidadeMin: 40,
  umidadeMax: 80,
};

function serie(
  quantidade,
  intervalo = 10,
  temperatura = 35
) {
  return Array.from(
    { length: quantidade },
    (_, indice) => ({
      temperatura,
      umidade: 70,

      dataHoraLeitura: new Date(
        Date.UTC(
          2026,
          0,
          1,
          0,
          indice * intervalo
        )
      ),
    })
  );
}

test.each([
  null,
  "",
  "150",
  "NaN",
  "Infinity",
])(
  "descarta temperatura inválida: %p",
  (temperatura) => {
    const leitura = converterFeed({
      created_at: "2026-01-01T00:00:00Z",
      field1: temperatura,
      field2: "70",
    });

    expect(leitura).toBeNull();
  }
);

test("preserva umidade igual a zero", () => {
  const leitura = converterFeed({
    created_at: "2026-01-01T00:00:00Z",
    field1: "25",
    field2: "0",
  });

  expect(leitura.umidade).toBe(0);
});

test("normaliza datas para UTC", () => {
  const leitura = converterFeed({
    created_at:
      "2026-01-01T03:00:00+03:00",
    field1: "25",
    field2: "70",
  });

  expect(
    leitura.dataHoraLeitura.toISOString()
  ).toBe("2026-01-01T00:00:00.000Z");
});

test("rejeita data impossível", () => {
  const leitura = converterFeed({
    created_at: "2026-02-30T00:00:00Z",
    field1: "25",
    field2: "70",
  });

  expect(leitura).toBeNull();
});

test("uma amostra não prova continuidade", () => {
  const resultado = calcular(
    serie(1),
    cultura
  );

  expect(resultado.alertas).toHaveLength(0);
});

test("gera risco moderado após duas horas", () => {
  const resultado = calcular(
    serie(13),
    cultura
  );

  expect(resultado.alertas).toHaveLength(1);

  expect(
    resultado.alertas[0].nivel
  ).toBe("MODERADO");
});

test("gera risco alto após seis horas", () => {
  const resultado = calcular(
    serie(37),
    cultura
  );

  expect(
    resultado.alertas.map(
      (alerta) => alerta.nivel
    )
  ).toEqual(["MODERADO", "ALTO"]);
});

test("lacunas interrompem continuidade", () => {
  const resultado = calcular(
    serie(20, 20),
    cultura
  );

  expect(resultado.alertas).toHaveLength(0);
});

test("retorno à faixa interrompe episódio", () => {
  const leituras = serie(20);

  leituras[10].temperatura = 25;

  const resultado = calcular(
    leituras,
    cultura
  );

  expect(resultado.alertas).toHaveLength(0);
});

test("não duplica duração de amostras repetidas", () => {
  const leituras = serie(37);

  const resultado = calcular(
    [...leituras, ...leituras],
    cultura
  );

  expect(
    resultado.horasForaFaixa
  ).toBe(6);
});

test("sem dados, adequação é desconhecida", () => {
  expect(
    calcular([], cultura).adequacaoPercentual
  ).toBeNull();
});

test.each(["24h", "7d", "30d"])(
  "aceita período %s",
  (periodo) => {
    const filtros =
      validarFiltrosLeitura({ periodo });

    const horas = {
      "24h": 24,
      "7d": 168,
      "30d": 720,
    };

    expect(
      (filtros.ate - filtros.de) / 3_600_000
    ).toBe(horas[periodo]);
  }
);

test("rejeita período desconhecido", () => {
  expect(() => {
    validarFiltrosLeitura({
      periodo: "8d",
    });
  }).toThrow();
});

test("não mistura período com datas", () => {
  expect(() => {
    validarFiltrosLeitura({
      periodo: "7d",
      de: "2026-01-01",
    });
  }).toThrow();
});

test("integra graus-dia observados", () => {
  const resultado = calcular(
    serie(7, 10, 30),
    cultura,
    10
  );

  expect(
    resultado.grausDiaObservados
  ).toBeCloseTo(20 / 24);
});

const simulacao = {
  grausDiaAcumulados: 1000,
  grausDiaAlvo: 900,
  chuvaPrevistaMm: 0,
  chuvaLimiteMm: 5,
  umidadePrevista: 60,
  umidadeLimite: 80,
  horasAteResfriamento: 5,
  tempoTransporteHoras: 24,
  vidaUtilHoras: 72,
  precoInternoKg: 5,
  precoExportacaoKg: 9,
  custoInternoKg: 1,
  custoExportacaoKg: 3,
  cadeiaFrioGarantida: true,
};

test("colheita exige maturação", () => {
  const resultado = recomendar(
    simulacao,
    "VEGETATIVA"
  );

  expect(
    resultado.colheita.favoravel
  ).toBe(false);
});

test("exportação exige resfriamento antes de 6h", () => {
  const resultado = recomendar(
    {
      ...simulacao,
      horasAteResfriamento: 6,
    },
    "MATURACAO"
  );

  expect(
    resultado.exportacao.favoravel
  ).toBe(false);
});

test("recomendação rejeita parâmetros ausentes", () => {
  expect(() => {
    recomendar({}, "MATURACAO");
  }).toThrow();
});