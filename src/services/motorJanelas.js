const DIA_MS = 86400000;
const GAP_MAX_MS = 30 * 60000;
const COBERTURA_MINIMA = 0.95;

// Intervalos sem medições não são interpolados acima de 30 minutos.
function acumuladoObservado(leituras, parametros, ate) {
  const inicio = +parametros.dataHoraReferencia;
  const fim = +ate;

  const ordenadas = [
    ...new Map(
      leituras
        .filter((leitura) => {
          const instante = +new Date(leitura.dataHoraLeitura);

          return (
            instante >= inicio &&
            instante <= fim &&
            typeof leitura.temperatura === "number" &&
            Number.isFinite(leitura.temperatura) &&
            leitura.temperatura >= -10 &&
            leitura.temperatura <= 60
          );
        })
        .map((leitura) => [
          +new Date(leitura.dataHoraLeitura),
          leitura,
        ]),
    ).values(),
  ].sort(
    (a, b) =>
      new Date(a.dataHoraLeitura) - new Date(b.dataHoraLeitura),
  );

  let observadasMs = 0;
  let grausDia = 0;

  for (let indice = 1; indice < ordenadas.length; indice++) {
    const anterior = ordenadas[indice - 1];
    const atual = ordenadas[indice];
    const intervaloMs =
      new Date(atual.dataHoraLeitura) -
      new Date(anterior.dataHoraLeitura);

    if (intervaloMs <= 0 || intervaloMs > GAP_MAX_MS) {
      continue;
    }

    observadasMs += intervaloMs;

    const temperaturaMedia =
      (anterior.temperatura + atual.temperatura) / 2;

    grausDia +=
      (Math.max(
        0,
        temperaturaMedia - parametros.temperaturaBase,
      ) *
        intervaloMs) /
      DIA_MS;
  }

  const cobertura =
    fim === inicio ? 1 : observadasMs / (fim - inicio);

  return {
    grausDia,
    horasObservadas: observadasMs / 3600000,
    coberturaPercentual: cobertura * 100,
    suficiente: cobertura >= COBERTURA_MINIMA,
  };
}

function calcularJanelas({
  lote,
  leituras,
  parametros,
  previsao,
  rota,
  agora = new Date(),
}) {
  const hoje = new Date(agora);
  hoje.setUTCHours(0, 0, 0, 0);

  const historico = acumuladoObservado(
    leituras,
    parametros,
    hoje,
  );

  const resultado = {
    natureza: "ESTIMATIVA_PARAMETRIZADA",
    regraVersao: "janelas-v1",
    calculadoEm: agora.toISOString(),

    parametros: {
      fonte: parametros.fonteParametros,
      versao: parametros.versaoParametros,
      temperaturaBase: parametros.temperaturaBase,
      grausDiaAlvo: parametros.grausDiaAlvo,
    },

    historico: {
      ...historico,
      ate: hoje.toISOString(),
      grausDiaReferencia: parametros.grausDiaReferencia,
    },

    previsao: {
      fonte: previsao.fonte,
      consultadaEm: previsao.consultadaEm,
      timezone: "UTC",
    },

    colheita: {
      status: "DADOS_INSUFICIENTES",
      janelas: [],
      motivos: [],
    },

    exportacao: {
      status: "DADOS_INSUFICIENTES",
      janelas: [],
      motivos: [],
    },

    avisos: [
      "Estimativa de apoio à decisão; parâmetros precisam de validação por cultura e variedade.",
      "Fase fenológica atual não é projetada automaticamente para os próximos dias.",
      "Chuva e umidade são médias/agregados diários regionais; confirmar condições locais antes da operação.",
    ],
  };

  if (!historico.suficiente) {
    resultado.colheita.motivos.push(
      "Cobertura térmica inferior a 95% desde a referência. Não foram preenchidas lacunas.",
    );
  } else if (lote.faseFenologica !== "MATURACAO") {
    resultado.colheita.status = "AGUARDAR_MATURACAO";
    resultado.colheita.motivos.push(
      "Lote precisa estar em MATURACAO para recomendar uma janela.",
    );
  } else {
    let acumulado =
      parametros.grausDiaReferencia + historico.grausDia;

    const avaliacaoDiaria = [];

    for (const dia of previsao.dias) {
      // O alvo precisa ter sido atingido no início do dia.
      // Não se usa o calor previsto para antecipar a própria colheita.
      const favoravel =
        acumulado >= parametros.grausDiaAlvo &&
        dia.chuvaMm <= parametros.chuvaMaxMm &&
        dia.umidadeAr <= parametros.umidadeArMaxPercentual;

      avaliacaoDiaria.push({
        data: dia.data,
        grausDiaNoInicio: acumulado,
        chuvaMm: dia.chuvaMm,
        umidadeAr: dia.umidadeAr,
        favoravel,
      });

      if (favoravel) {
        const inicio = Math.max(
          +new Date(`${dia.data}T00:00:00.000Z`),
          +agora,
        );

        resultado.colheita.janelas.push({
          inicio: new Date(inicio).toISOString(),
          fim: `${dia.data}T23:59:59.999Z`,
        });
      }

      acumulado += Math.max(
        0,
        dia.temperaturaMedia - parametros.temperaturaBase,
      );
    }

    resultado.colheita.avaliacaoDiaria = avaliacaoDiaria;
    resultado.colheita.status = resultado.colheita.janelas.length
      ? "FAVORAVEL"
      : "SEM_JANELA_NO_HORIZONTE";

    if (!resultado.colheita.janelas.length) {
      resultado.colheita.motivos.push(
        "Nenhum dia atende ao alvo térmico e aos limites de chuva/umidade nos próximos 7 dias.",
      );
    }
  }

  if (parametros.rotaLogisticaId === undefined) {
    resultado.exportacao.motivos.push(
      "Informe rota, cadeia do frio, vida útil, custos e cotação para comparar exportação.",
    );
    return resultado;
  }

  if (!rota) {
    resultado.exportacao.motivos.push(
      "Rota logística indisponível.",
    );
    return resultado;
  }

  if (!resultado.colheita.janelas.length) {
    resultado.exportacao.status = "SEM_JANELA_COLHEITA";
    resultado.exportacao.motivos.push(
      "Nenhuma janela de colheita disponível para calcular a exportação.",
    );
    return resultado;
  }

  const horasTransporte = Number(rota.tempoEstimadoHoras);

  const margemInterna =
    parametros.precoInternoKg - parametros.custoInternoKg;

  const margemExportacao =
    parametros.precoExportacaoKg - parametros.custoExportacaoKg;

  Object.assign(resultado.exportacao, {
    rotaId: rota.id,
    tempoTransporteHoras: horasTransporte,
    moeda: "BRL",
    unidade: "kg",
    margemInternaKg: margemInterna,
    margemExportacaoKg: margemExportacao,
    fonteCotacao: parametros.fonteCotacao,
    dataHoraCotacao: parametros.dataHoraCotacao.toISOString(),
  });

  const motivos = resultado.exportacao.motivos;

  if (!Number.isFinite(horasTransporte) || horasTransporte < 0) {
    motivos.push("Tempo de transporte inválido na rota.");
  }

  if (!parametros.cadeiaFrioGarantida) {
    motivos.push("Cadeia do frio não garantida.");
  }

  if (parametros.horasAteResfriamento >= 6) {
    motivos.push(
      "Resfriamento precisa ocorrer antes de 6 horas após a colheita.",
    );
  }

  if (
    parametros.horasAteResfriamento + horasTransporte >=
    parametros.vidaUtilHoras
  ) {
    motivos.push(
      "Tempo até a chegada não cabe na vida útil informada.",
    );
  }

  if (
    margemExportacao <= 0 ||
    margemExportacao <= margemInterna
  ) {
    motivos.push(
      "Margem da exportação não é positiva e superior à margem interna.",
    );
  }

  resultado.exportacao.status = motivos.length
    ? "NAO_FAVORAVEL"
    : "FAVORAVEL";

  if (!motivos.length) {
    resultado.exportacao.janelas =
      resultado.colheita.janelas.map((janela) => ({
        colheitaInicio: janela.inicio,
        colheitaFim: janela.fim,

        embarqueInicio: new Date(
          +new Date(janela.inicio) +
            parametros.horasAteResfriamento * 3600000,
        ).toISOString(),

        embarqueFim: new Date(
          +new Date(janela.fim) +
            parametros.horasAteResfriamento * 3600000,
        ).toISOString(),

        chegadaInicio: new Date(
          +new Date(janela.inicio) +
            (parametros.horasAteResfriamento +
              horasTransporte) *
              3600000,
        ).toISOString(),

        chegadaFim: new Date(
          +new Date(janela.fim) +
            (parametros.horasAteResfriamento +
              horasTransporte) *
              3600000,
        ).toISOString(),
      }));

    resultado.avisos.push(
      "Custos exportação/kg devem incluir frete, perdas, taxas e refrigeração; custo total da rota não é dividido sem informar a carga. Revalidar cotações antes do embarque.",
    );
  }

  return resultado;
}

module.exports = {
  acumuladoObservado,
  calcularJanelas,
};