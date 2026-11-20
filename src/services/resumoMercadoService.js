function resumirMercado(
  registros,
  {
    produto,
    uf,
    ceasa,
  }
) {
  const validos = registros.filter(
    (registro) =>
      typeof registro.data === "string" &&
      Number.isFinite(registro.preco) &&
      registro.preco > 0 &&
      typeof registro.unidade === "string" &&
      registro.unidade.trim()
  );

  const dataReferencia = validos.reduce(
    (maior, registro) =>
      !maior || registro.data > maior
        ? registro.data
        : maior,
    null
  );

  const unidades = new Map();

  for (
    const registro
    of validos.filter(
      (item) =>
        item.data === dataReferencia
    )
  ) {
    const unidade =
      registro.unidade
        .trim()
        .toUpperCase();

    if (!unidades.has(unidade)) {
      unidades.set(
        unidade,
        []
      );
    }

    unidades.get(
      unidade
    ).push(
      registro.preco
    );
  }

  const precosMediosPorUnidade = [
    ...unidades,
  ]
    .map(([unidade, precos]) => {
      const soma = precos.reduce(
        (total, preco) =>
          total + preco,
        0
      );

      return {
        unidade,

        precoMedio: Number(
          (
            soma / precos.length
          ).toFixed(2)
        ),

        quantidadeObservacoes:
          precos.length,
      };
    })
    .sort(
      (a, b) =>
        a.unidade.localeCompare(
          b.unidade
        )
    );

  const unidadeUnica =
    precosMediosPorUnidade.length === 1
      ? precosMediosPorUnidade[0]
      : null;

  return {
    cultura: produto,

    mercadoDestino: {
      tipo: "INTERNO",
      pais: "BR",
      uf,
      ceasa: ceasa || null,

      escopo: ceasa
        ? "FILTRO_CEASA"
        : "CEASAS_DA_UF",
    },

    moeda: "BRL",

    dataReferencia,

    precoMedio:
      unidadeUnica?.precoMedio ?? null,

    unidade:
      unidadeUnica?.unidade ?? null,

    precosMediosPorUnidade,

    metodo:
      "MEDIA_SIMPLES_OBSERVACOES_NA_DATA_MAIS_RECENTE_POR_UNIDADE",

    demandaEstimada: null,

    precoExportacao: null,

    disponibilidade: {
      demandaEstimada:
        "NAO_FORNECIDA_PELA_FONTE_INTEGRADA",

      precoExportacao:
        "FONTE_NAO_INTEGRADA",
    },

    limitacoes: [
      "Preços atacadistas internos; a consulta atual não fornece cotação de exportação ou demanda estimada.",

      "A média inclui as variedades e Ceasas que atendem ao filtro, sem ponderação por volume.",

      "Unidades diferentes não são somadas nem convertidas; use precosMediosPorUnidade.",
    ],
  };
}

module.exports = {
  resumirMercado,
};