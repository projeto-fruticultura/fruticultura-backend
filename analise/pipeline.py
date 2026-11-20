import pandas as pd


COLUNAS = [
    "sensorId",
    "loteId",
    "propriedadeId",
    "dataHoraLeitura",
    "temperatura",
    "umidadeLegada",
]


def tratar(dados):
    """
    Valida as leituras, padroniza datas em UTC
    e remove duplicatas e registros conflitantes.

    Dados ausentes não são preenchidos com zero.
    """
    faltantes = (
        set(COLUNAS)
        - set(dados.columns)
    )

    if faltantes:
        raise ValueError(
            "CSV sem colunas obrigatórias: "
            + ", ".join(
                sorted(faltantes)
            )
        )

    base = dados[COLUNAS].copy()

    total = len(base)

    base["dataHoraLeitura"] = (
        pd.to_datetime(
            base["dataHoraLeitura"],
            utc=True,
            errors="coerce",
        )
    )

    colunas_numericas = [
        "temperatura",
        "umidadeLegada",
        "sensorId",
        "loteId",
        "propriedadeId",
    ]

    for coluna in colunas_numericas:
        base[coluna] = pd.to_numeric(
            base[coluna],
            errors="coerce",
        )

    ids_validos = pd.Series(
        True,
        index=base.index,
    )

    for coluna in [
        "sensorId",
        "loteId",
        "propriedadeId",
    ]:
        dentro_da_faixa = (
            base[coluna].between(
                1,
                2147483647,
            )
        )

        inteiro = (
            base[coluna]
            .mod(1)
            .eq(0)
        )

        ids_validos &= (
            dentro_da_faixa
            & inteiro
        )

    valido = (
        ids_validos

        & base[
            "dataHoraLeitura"
        ].notna()

        & base[
            "temperatura"
        ].between(
            -10,
            60,
        )

        & base[
            "umidadeLegada"
        ].between(
            0,
            100,
        )
    )

    invalidos = int(
        (~valido).sum()
    )

    base = base.loc[
        valido
    ].copy()

    chaves = [
        "sensorId",
        "dataHoraLeitura",
    ]

    grupos = base.groupby(
        chaves,
        dropna=False,
    )

    colunas_conferidas = [
        "temperatura",
        "umidadeLegada",
        "loteId",
        "propriedadeId",
    ]

    conflitos = (
        grupos[
            colunas_conferidas
        ]
        .transform("nunique")
        .gt(1)
        .any(axis=1)
    )

    quantidade_conflitos = int(
        conflitos.sum()
    )

    # Havendo valores diferentes para o mesmo
    # sensor e instante, descarta todas as
    # linhas conflitantes.
    base = base.loc[
        ~conflitos
    ].copy()

    duplicados = int(
        base.duplicated(
            chaves
        ).sum()
    )

    base = (
        base
        .drop_duplicates(chaves)
        .sort_values(chaves)
    )

    resumo = {
        "recebidos": total,

        "invalidos": invalidos,

        "registrosEmConflito": (
            quantidade_conflitos
        ),

        "duplicadosIguais": duplicados,

        "validos": len(base),
    }

    return base, resumo


def resumir(base, por):
    """
    Calcula estatísticas por amostra.

    As médias não são ponderadas pelo tempo.
    """
    return base.groupby(por).agg(
        totalLeituras=(
            "temperatura",
            "size",
        ),

        temperaturaMedia=(
            "temperatura",
            "mean",
        ),

        temperaturaMinima=(
            "temperatura",
            "min",
        ),

        temperaturaMaxima=(
            "temperatura",
            "max",
        ),

        umidadeLegadaMedia=(
            "umidadeLegada",
            "mean",
        ),

        umidadeLegadaMinima=(
            "umidadeLegada",
            "min",
        ),

        umidadeLegadaMaxima=(
            "umidadeLegada",
            "max",
        ),

        desvioPadraoUmidadeLegada=(
            "umidadeLegada",
            "std",
        ),
    )