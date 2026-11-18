import os
import secrets

from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
)

from typing import Annotated, Literal

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
)

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


Numero = Annotated[
    float,
    Field(
        allow_inf_nan=False,
        strict=True,
    ),
]

NaoNegativo = Annotated[
    Numero,
    Field(ge=0),
]

Percentual = Annotated[
    Numero,
    Field(ge=0, le=100),
]


class Modelo(BaseModel):
    model_config = ConfigDict(
        extra="ignore"
    )


class Lote(Modelo):
    id: int = Field(gt=0)
    faseFenologica: str | None


class Parametros(Modelo):
    dataHoraReferencia: AwareDatetime

    grausDiaReferencia: NaoNegativo

    temperaturaBaseC: Annotated[
        Numero,
        Field(ge=-10, le=60),
    ]

    grausDiaAlvo: Annotated[
        Numero,
        Field(gt=0),
    ]

    chuvaMaximaMmDia: NaoNegativo
    umidadeArMaximaPercentual: Percentual

    fonte: str = Field(min_length=1)
    versao: str = Field(min_length=1)


class Leitura(Modelo):
    instante: AwareDatetime

    temperaturaC: Annotated[
        Numero,
        Field(ge=-10, le=60),
    ]


class Dia(Modelo):
    data: date

    temperaturaMediaC: Annotated[
        Numero,
        Field(ge=-90, le=70),
    ]

    precipitacaoMm: NaoNegativo
    umidadeRelativaMediaPercentual: Percentual


class Previsao(Modelo):
    fonte: str = Field(min_length=1)

    timezone: Literal["UTC"]

    dias: list[Dia] = Field(
        min_length=1,
        max_length=7,
    )


class Logistica(Modelo):
    rotaId: int = Field(gt=0)

    tempoEstimadoHoras: Annotated[
        Numero,
        Field(gt=0),
    ]


class Exportacao(Modelo):
    horasAteResfriamento: NaoNegativo

    vidaUtilHoras: Annotated[
        Numero,
        Field(gt=0),
    ]

    precoInternoKg: NaoNegativo
    precoExportacaoKg: NaoNegativo

    custoInternoKg: NaoNegativo
    custoExportacaoKg: NaoNegativo

    cadeiaFrioGarantida: bool = Field(
        strict=True
    )

    moeda: Literal["BRL"]

    dataHoraCotacao: AwareDatetime

    fonteCotacao: str = Field(
        min_length=1
    )


class Pedido(Modelo):
    contractVersion: Literal["1.0"]

    requestedAt: AwareDatetime

    lote: Lote

    parametrosAgronomicos: Parametros

    historico: list[Leitura] = Field(
        max_length=50000
    )

    previsaoDiaria: Previsao

    logistica: Logistica | None = None

    parametrosExportacao: Exportacao | None = None

    @model_validator(mode="after")
    def validar_consistencia(self):
        hoje = (
            self.requestedAt
            .astimezone(timezone.utc)
            .replace(
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )
        )

        referencia = (
            self.parametrosAgronomicos
            .dataHoraReferencia
        )

        if referencia > hoje:
            raise ValueError(
                "Referência térmica posterior "
                "ao início do dia UTC."
            )

        datas = [
            dia.data
            for dia in self.previsaoDiaria.dias
        ]

        esperadas = [
            (hoje + timedelta(days=i)).date()
            for i in range(len(datas))
        ]

        if datas != esperadas:
            raise ValueError(
                "A previsão deve começar hoje e "
                "conter dias consecutivos em UTC."
            )

        tem_logistica = (
            self.logistica is not None
        )

        tem_exportacao = (
            self.parametrosExportacao is not None
        )

        if tem_logistica != tem_exportacao:
            raise ValueError(
                "Logística e parâmetros de "
                "exportação devem vir juntos."
            )

        if self.parametrosExportacao:
            cotacao = (
                self.parametrosExportacao
                .dataHoraCotacao
            )

            if cotacao > self.requestedAt:
                raise ValueError(
                    "Cotação não pode estar no futuro."
                )

        return self


def iso(instante):
    return (
        instante
        .astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def calcular(pedido):
    parametros = pedido.parametrosAgronomicos

    agora = pedido.requestedAt.astimezone(
        timezone.utc
    )

    hoje = agora.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    referencia = parametros.dataHoraReferencia

    # Descarta duplicatas iguais e recusa
    # valores conflitantes no mesmo instante.
    amostras = {}

    for leitura in pedido.historico:
        if referencia <= leitura.instante <= hoje:
            instante = leitura.instante
            temperatura = leitura.temperaturaC

            if (
                instante in amostras
                and amostras[instante] != temperatura
            ):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Temperaturas conflitantes "
                        "no mesmo instante."
                    ),
                )

            amostras[instante] = temperatura

    ordenadas = sorted(amostras.items())

    segundos_observados = 0.0
    graus_dia = 0.0

    for anterior, atual in zip(
        ordenadas,
        ordenadas[1:],
    ):
        instante_anterior, temperatura_anterior = anterior
        instante_atual, temperatura_atual = atual

        intervalo = (
            instante_atual - instante_anterior
        ).total_seconds()

        # Não preenche lacunas superiores
        # a trinta minutos.
        if 0 < intervalo <= 1800:
            segundos_observados += intervalo

            temperatura_media = (
                temperatura_anterior
                + temperatura_atual
            ) / 2

            incremento = max(
                0,
                temperatura_media
                - parametros.temperaturaBaseC,
            )

            graus_dia += (
                incremento
                * intervalo
                / 86400
            )

    segundos_esperados = (
        hoje - referencia
    ).total_seconds()

    cobertura = (
        segundos_observados / segundos_esperados
        if segundos_esperados
        else 1.0
    )

    colheita = {
        "status": "DADOS_INSUFICIENTES",
        "windows": [],
        "reasons": [],
    }

    exportacao = {
        "status": "DADOS_INSUFICIENTES",
        "windows": [],
        "reasons": [],
    }

    if cobertura < 0.95:
        colheita["reasons"].append(
            "Cobertura térmica inferior a 95%; "
            "lacunas não foram preenchidas."
        )

    elif pedido.lote.faseFenologica != "MATURACAO":
        colheita["status"] = "AGUARDAR_MATURACAO"

        colheita["reasons"].append(
            "Lote precisa estar em MATURACAO."
        )

    else:
        acumulado = (
            parametros.grausDiaReferencia
            + graus_dia
        )

        for dia in pedido.previsaoDiaria.dias:
            inicio_dia = datetime.combine(
                dia.data,
                datetime.min.time(),
                timezone.utc,
            )

            fim_dia = (
                inicio_dia
                + timedelta(days=1)
                - timedelta(milliseconds=1)
            )

            inicio = max(
                inicio_dia,
                agora,
            )

            atingiu_alvo = (
                acumulado
                >= parametros.grausDiaAlvo
            )

            chuva_adequada = (
                dia.precipitacaoMm
                <= parametros.chuvaMaximaMmDia
            )

            umidade_adequada = (
                dia.umidadeRelativaMediaPercentual
                <= parametros.umidadeArMaximaPercentual
            )

            if (
                atingiu_alvo
                and chuva_adequada
                and umidade_adequada
            ):
                colheita["windows"].append({
                    "inicio": iso(inicio),
                    "fim": iso(fim_dia),
                })

            # O calor previsto entra no acumulado
            # somente depois de avaliar o dia.
            acumulado += max(
                0,
                dia.temperaturaMediaC
                - parametros.temperaturaBaseC,
            )

        if colheita["windows"]:
            colheita["status"] = "FAVORAVEL"

        else:
            colheita["status"] = (
                "SEM_JANELA_NO_HORIZONTE"
            )

            colheita["reasons"].append(
                "Nenhum dia atende aos limites "
                "térmicos e meteorológicos."
            )

    dados_exportacao = pedido.parametrosExportacao

    if dados_exportacao is None:
        exportacao["reasons"].append(
            "Informe logística, custos, "
            "cotação e cadeia do frio."
        )

    elif not colheita["windows"]:
        exportacao["status"] = (
            "SEM_JANELA_COLHEITA"
        )

        exportacao["reasons"].append(
            "Não existe janela de colheita disponível."
        )

    else:
        transporte = (
            pedido.logistica.tempoEstimadoHoras
        )

        motivos = exportacao["reasons"]

        if not dados_exportacao.cadeiaFrioGarantida:
            motivos.append(
                "Cadeia do frio não garantida."
            )

        horas_frio = (
            dados_exportacao.horasAteResfriamento
        )

        if horas_frio >= 6:
            motivos.append(
                "Resfriamento deve ocorrer "
                "antes de seis horas."
            )

        if (
            horas_frio + transporte
            >= dados_exportacao.vidaUtilHoras
        ):
            motivos.append(
                "Tempo até a chegada excede "
                "ou iguala a vida útil."
            )

        margem_interna = (
            dados_exportacao.precoInternoKg
            - dados_exportacao.custoInternoKg
        )

        margem_exportacao = (
            dados_exportacao.precoExportacaoKg
            - dados_exportacao.custoExportacaoKg
        )

        if (
            margem_exportacao <= 0
            or margem_exportacao <= margem_interna
        ):
            motivos.append(
                "Margem de exportação deve ser "
                "positiva e superior à interna."
            )

        exportacao["status"] = (
            "NAO_FAVORAVEL"
            if motivos
            else "FAVORAVEL"
        )

        if not motivos:
            intervalo_frio = timedelta(
                hours=horas_frio
            )

            intervalo_transporte = timedelta(
                hours=transporte
            )

            for janela in colheita["windows"]:
                inicio = datetime.fromisoformat(
                    janela["inicio"].replace(
                        "Z",
                        "+00:00",
                    )
                )

                fim = datetime.fromisoformat(
                    janela["fim"].replace(
                        "Z",
                        "+00:00",
                    )
                )

                exportacao["windows"].append({
                    "colheitaInicio": iso(inicio),

                    "colheitaFim": iso(fim),

                    "embarqueInicio": iso(
                        inicio + intervalo_frio
                    ),

                    "embarqueFim": iso(
                        fim + intervalo_frio
                    ),

                    "chegadaInicio": iso(
                        inicio
                        + intervalo_frio
                        + intervalo_transporte
                    ),

                    "chegadaFim": iso(
                        fim
                        + intervalo_frio
                        + intervalo_transporte
                    ),
                })

    return {
        "contractVersion": "1.0",

        "modelVersion": (
            "regras-parametrizadas-python-v1"
        ),

        "generatedAt": iso(
            datetime.now(timezone.utc)
        ),

        "harvest": colheita,

        "export": exportacao,

        "natureza": (
            "ESTIMATIVA_PARAMETRIZADA"
        ),

        "coberturaHistoricaPercentual": round(
            cobertura * 100,
            2,
        ),

        "avisos": [
            (
                "Parâmetros exigem validação por "
                "cultura e variedade; não é "
                "modelo treinado."
            ),
            (
                "A fase fenológica não é projetada. "
                "Umidade legada não é usada "
                "como umidade do ar."
            ),
            (
                "Confirmar condições locais, "
                "cotações e custos completos "
                "antes da operação."
            ),
        ],
    }


def autenticar(
    authorization: str | None = Header(
        default=None
    ),
):
    token = os.getenv(
        "PYTHON_RECOMMENDATION_TOKEN",
        "",
    )

    if token:
        esperado = f"Bearer {token}"

        recebido = authorization or ""

        if not secrets.compare_digest(
            recebido.encode("utf-8"),
            esperado.encode("utf-8"),
        ):
            raise HTTPException(
                status_code=401,
                detail="Token de serviço inválido.",
            )


app = FastAPI(
    title="ValeSafra — Recomendações",
    version="1.0",
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "valesafra-python",
    }


@app.post(
    "/v1/recommendations/harvest-export",
    dependencies=[
        Depends(autenticar),
    ],
)
def recomendar(pedido: Pedido):
    return calcular(pedido)