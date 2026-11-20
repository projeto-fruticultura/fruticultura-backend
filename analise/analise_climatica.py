import argparse
import json

from pathlib import Path

import matplotlib

# Permite salvar gráficos sem abrir
# uma janela gráfica no computador.
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd

from pipeline import (
    tratar,
    resumir,
)


def executar(arquivo, saida):
    if not arquivo.exists():
        raise FileNotFoundError(
            "CSV não encontrado. Execute "
            "node scripts/exportarLeituras.js "
            "na raiz do backend."
        )

    bruto = pd.read_csv(
        arquivo
    )

    base, qualidade = tratar(
        bruto
    )

    saida.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Remove resultados anteriores que poderiam
    # confundir a interpretação de uma nova
    # exportação vazia ou diferente.
    arquivos_anteriores = [
        "estatisticas_lotes.csv",
        "estatisticas_propriedades.csv",
        "temperatura_propriedades.png",
        "variacao_umidade_lotes.png",
    ]

    for nome in arquivos_anteriores:
        (saida / nome).unlink(
            missing_ok=True
        )

    arquivo_qualidade = (
        saida / "qualidade.json"
    )

    arquivo_qualidade.write_text(
        json.dumps(
            qualidade,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    base.to_csv(
        saida / "leituras_tratadas.csv",
        index=False,
    )

    print("Qualidade dos dados:")

    print(
        json.dumps(
            qualidade,
            ensure_ascii=False,
            indent=2,
        )
    )

    if base.empty:
        print(
            "Sem medições válidas. "
            "Nenhuma conclusão climática "
            "pode ser produzida."
        )

        return

    por_lote = resumir(
        base,
        [
            "propriedadeId",
            "loteId",
        ],
    )

    por_propriedade = resumir(
        base,
        "propriedadeId",
    )

    por_lote.to_csv(
        saida / "estatisticas_lotes.csv"
    )

    por_propriedade.to_csv(
        saida / "estatisticas_propriedades.csv"
    )

    print("\nEstatísticas por lote:")

    print(
        por_lote.to_string()
    )

    print(
        "\nEstatísticas por propriedade:"
    )

    print(
        por_propriedade.to_string()
    )

    diaria = (
        base
        .set_index(
            "dataHoraLeitura"
        )
        .groupby(
            "propriedadeId"
        )["temperatura"]
        .resample("1D")
        .mean()
        .unstack(0)
    )

    grafico_temperatura = diaria.plot(
        figsize=(10, 4),

        ylabel=(
            "Temperatura média "
            "por amostra (°C)"
        ),

        xlabel="Data UTC",

        title=(
            "Temperatura por propriedade"
        ),
    )

    grafico_temperatura.figure.tight_layout()

    grafico_temperatura.figure.savefig(
        saida / "temperatura_propriedades.png",
        dpi=150,
    )

    plt.close(
        grafico_temperatura.figure
    )

    variacao = (
        por_lote[
            "desvioPadraoUmidadeLegada"
        ]
        .dropna()
    )

    if not variacao.empty:
        grafico_umidade = variacao.plot.bar(
            figsize=(10, 4),

            ylabel=(
                "Desvio padrão "
                "(pontos percentuais)"
            ),

            title=(
                "Variação da umidade "
                "legada por lote"
            ),
        )

        grafico_umidade.figure.tight_layout()

        grafico_umidade.figure.savefig(
            saida / "variacao_umidade_lotes.png",
            dpi=150,
        )

        plt.close(
            grafico_umidade.figure
        )

    else:
        print(
            "Não há duas amostras por grupo "
            "para calcular o desvio padrão "
            "da umidade."
        )

    print(
        "\nResultados salvos em: "
        f"{saida.resolve()}"
    )

    print(
        "Médias por amostra; umidade legada "
        "sem identificação separada de solo/ar."
    )


if __name__ == "__main__":
    pasta = (
        Path(__file__)
        .resolve()
        .parent
    )

    parser = argparse.ArgumentParser(
        description=(
            "Análise climática ValeSafra"
        )
    )

    parser.add_argument(
        "--arquivo",
        type=Path,

        default=(
            pasta / "leituras.csv"
        ),
    )

    parser.add_argument(
        "--saida",
        type=Path,

        default=(
            pasta / "resultados"
        ),
    )

    argumentos = parser.parse_args()

    try:
        executar(
            argumentos.arquivo,
            argumentos.saida,
        )

    except (
        ValueError,
        FileNotFoundError,
        pd.errors.EmptyDataError,
    ) as erro:
        parser.exit(
            1,

            "Análise não executada: "
            f"{erro}\n",
        )