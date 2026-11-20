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
    field_serializer,
    model_validator,
)


# Números devem chegar como números JSON.
# Valores infinitos e NaN não são permitidos.
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


def iso(instante):
    """Padroniza datas em UTC com milissegundos."""
    return (
        instante.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class Modelo(BaseModel):
    # Aceita os metadados adicionais enviados pelo Node,
    # utilizando somente os campos declarados.
    model_config = ConfigDict(
        extra="ignore"
    )

    @field_serializer("*", when_used="json")
    def serializar_datas(self, valor):
        if isinstance(valor, datetime):
            return iso(valor)

        return valor


# ==================================================
# Modelos de entrada
# ==================================================

class Lote(Modelo):
    id: int = Field(gt=0)

    faseFenologica: Literal[
        "VEGETATIVA",
        "FLORACAO_PANICULA",
        "FRUTIFICACAO",
        "MATURACAO",
    ] | None


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
    def consistencia(self):
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
                "Previsão deve começar hoje e conter "
                "dias consecutivos em UTC."
            )

        tem_logistica = (
            self.logistica is not None
        )

        tem_exportacao = (
            self.parametrosExportacao is not None
        )

        if tem_logistica != tem_exportacao:
            raise ValueError(
                "Logística e parâmetros de exportação "
                "devem vir juntos."
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


# ==================================================
# Modelos de saída e memória de cálculo
# ==================================================

class MemoriaGDD(Modelo):
    unidade: Literal["°C.dia"] = "°C.dia"

    metodo: str = (
        "max(0, temperaturaMediaIntervalo "
        "- temperaturaBaseC) * horas / 24"
    )

    fonteParametros: str

    versaoParametros: str

    referencia: str

    ate: str

    temperaturaBaseC: Numero

    gddReferencia: NaoNegativo

    gddObservado: NaoNegativo

    gddAcumulado: NaoNegativo

    gddAlvo: NaoNegativo

    gddFaltante: NaoNegativo

    horasObservadas: NaoNegativo

    horasEsperadas: NaoNegativo

    coberturaPercentual: Percentual

    coberturaMinimaPercentual: float = 95.0

    lacunaMaximaMinutos: int = 30

    historicoSuficiente: bool


class CriteriosExportacao(Modelo):
    cadeiaFrioDeclarada: bool

    # O contrato atual recebe uma declaração,
    # sem medições de temperatura da carga.
    temperaturaRefrigeracaoVerificada: Literal[
        False
    ] = False

    limiteResfriamentoHoras: float = 6.0

    horasAteResfriamento: NaoNegativo

    tempoTransporteHoras: NaoNegativo

    tempoTotalAteChegadaHoras: NaoNegativo

    vidaUtilHoras: NaoNegativo

    margemInternaKg: Numero

    margemExportacaoKg: Numero

    moeda: Literal["BRL"] = "BRL"

    unidadeFinanceira: Literal[
        "por kg"
    ] = "por kg"

    resfriamentoNoPrazo: bool

    chegadaDentroVidaUtil: bool

    margemExportacaoVantajosa: bool

    criteriosAtendidos: bool

    motivos: list[str]


class JanelaColheita(Modelo):
    inicio: AwareDatetime

    fim: AwareDatetime


class JanelaExportacao(Modelo):
    colheitaInicio: AwareDatetime

    colheitaFim: AwareDatetime

    embarqueInicio: AwareDatetime

    embarqueFim: AwareDatetime

    chegadaInicio: AwareDatetime

    chegadaFim: AwareDatetime


class ResultadoColheita(Modelo):
    status: Literal[
        "DADOS_INSUFICIENTES",
        "AGUARDAR_MATURACAO",
        "FAVORAVEL",
        "SEM_JANELA_NO_HORIZONTE",
    ]

    windows: list[JanelaColheita]

    reasons: list[str]


class ResultadoExportacao(Modelo):
    status: Literal[
        "DADOS_INSUFICIENTES",
        "SEM_JANELA_COLHEITA",
        "NAO_FAVORAVEL",
        "FAVORAVEL",
    ]

    windows: list[JanelaExportacao]

    reasons: list[str]


class MemoriaCalculo(Modelo):
    gdd: MemoriaGDD

    exportacao: CriteriosExportacao | None


class Resposta(Modelo):
    contractVersion: Literal["1.0"]

    modelVersion: str

    generatedAt: AwareDatetime

    harvest: ResultadoColheita

    export: ResultadoExportacao

    natureza: Literal[
        "ESTIMATIVA_PARAMETRIZADA"
    ]

    coberturaHistoricaPercentual: Percentual

    memoriaCalculo: MemoriaCalculo

    avisos: list[str]


# ==================================================
# Cálculo de Graus-Dia
# ==================================================

def calcular_gdd(leituras, parametros, ate):
    """
    Para cada intervalo válido:

    temperatura média = (T anterior + T atual) / 2

    GDD do intervalo =
        max(0, temperatura média - temperatura base)
        × duração em dias

    Intervalos superiores a 30 minutos não são
    utilizados para preencher lacunas.

    A referência térmica é um acumulado informado;
    ela não é inferida da data de plantação.
    """
    inicio = parametros.dataHoraReferencia

    amostras = {}

    for leitura in leituras:
        if inicio <= leitura.instante <= ate:
            anterior = amostras.get(
                leitura.instante
            )

            if (
                anterior is not None
                and anterior != leitura.temperaturaC
            ):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Temperaturas conflitantes "
                        "no mesmo instante."
                    ),
                )

            amostras[leitura.instante] = (
                leitura.temperaturaC
            )

    ordenadas = sorted(
        amostras.items()
    )

    segundos = 0.0
    gdd = 0.0

    for anterior, atual in zip(
        ordenadas,
        ordenadas[1:],
    ):
        t0, temp0 = anterior
        t1, temp1 = atual

        intervalo = (
            t1 - t0
        ).total_seconds()

        if 0 < intervalo <= 30 * 60:
            temperatura_media = (
                temp0 + temp1
            ) / 2

            excesso_termico = max(
                0,
                temperatura_media
                - parametros.temperaturaBaseC,
            )

            gdd += (
                excesso_termico
                * intervalo
                / 86400
            )

            segundos += intervalo

    esperado = (
        ate - inicio
    ).total_seconds()

    # Se a referência já corresponde ao início
    # do dia atual, não há intervalo anterior
    # a integrar; utiliza-se o GDD de referência.
    cobertura = (
        segundos / esperado
        if esperado
        else 1.0
    )

    acumulado = (
        parametros.grausDiaReferencia
        + gdd
    )

    return MemoriaGDD(
        fonteParametros=parametros.fonte,

        versaoParametros=parametros.versao,

        referencia=iso(inicio),

        ate=iso(ate),

        temperaturaBaseC=(
            parametros.temperaturaBaseC
        ),

        gddReferencia=(
            parametros.grausDiaReferencia
        ),

        gddObservado=gdd,

        gddAcumulado=acumulado,

        gddAlvo=parametros.grausDiaAlvo,

        gddFaltante=max(
            0,
            parametros.grausDiaAlvo
            - acumulado,
        ),

        horasObservadas=segundos / 3600,

        horasEsperadas=esperado / 3600,

        coberturaPercentual=cobertura * 100,

        historicoSuficiente=(
            cobertura >= 0.95
        ),
    )


# ==================================================
# Cadeia do frio e viabilidade da exportação
# ==================================================

def avaliar_exportacao(dados, rota):
    """
    Critérios:

    - Cadeia do frio declarada como garantida.
    - Resfriamento antes de seis horas.
    - Chegada antes do fim da vida útil.
    - Margem de exportação positiva.
    - Margem de exportação superior à interna.

    Os custos por kg precisam incluir frete,
    refrigeração, taxas e demais custos aplicáveis.
    """
    total_horas = (
        dados.horasAteResfriamento
        + rota.tempoEstimadoHoras
    )

    margem_interna = (
        dados.precoInternoKg
        - dados.custoInternoKg
    )

    margem_exportacao = (
        dados.precoExportacaoKg
        - dados.custoExportacaoKg
    )

    frio_no_prazo = (
        dados.horasAteResfriamento < 6
    )

    vida_util_ok = (
        total_horas < dados.vidaUtilHoras
    )

    margem_ok = (
        margem_exportacao > 0
        and margem_exportacao > margem_interna
    )

    motivos = []

    if not dados.cadeiaFrioGarantida:
        motivos.append(
            "Cadeia do frio não garantida."
        )

    if not frio_no_prazo:
        motivos.append(
            "Resfriamento deve ocorrer "
            "antes de seis horas."
        )

    if not vida_util_ok:
        motivos.append(
            "Tempo até a chegada excede "
            "ou iguala a vida útil."
        )

    if not margem_ok:
        motivos.append(
            "Margem de exportação deve ser "
            "positiva e superior à interna."
        )

    return CriteriosExportacao(
        cadeiaFrioDeclarada=(
            dados.cadeiaFrioGarantida
        ),

        horasAteResfriamento=(
            dados.horasAteResfriamento
        ),

        tempoTransporteHoras=(
            rota.tempoEstimadoHoras
        ),

        tempoTotalAteChegadaHoras=total_horas,

        vidaUtilHoras=dados.vidaUtilHoras,

        margemInternaKg=margem_interna,

        margemExportacaoKg=margem_exportacao,

        resfriamentoNoPrazo=frio_no_prazo,

        chegadaDentroVidaUtil=vida_util_ok,

        margemExportacaoVantajosa=margem_ok,

        criteriosAtendidos=not motivos,

        motivos=motivos,
    )


# ==================================================
# Recomendação integrada
# ==================================================

def calcular(pedido):
    parametros = pedido.parametrosAgronomicos

    agora = (
        pedido.requestedAt
        .astimezone(timezone.utc)
    )

    hoje = agora.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    gdd = calcular_gdd(
        pedido.historico,
        parametros,
        hoje,
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

    if not gdd.historicoSuficiente:
        colheita["reasons"].append(
            "Cobertura térmica inferior a 95%; "
            "lacunas não foram preenchidas."
        )

    elif pedido.lote.faseFenologica != "MATURACAO":
        colheita["status"] = (
            "AGUARDAR_MATURACAO"
        )

        colheita["reasons"].append(
            "Lote precisa estar em MATURACAO."
        )

    else:
        acumulado = gdd.gddAcumulado

        for dia in pedido.previsaoDiaria.dias:
            inicio_dia = datetime.combine(
                dia.data,
                datetime.min.time(),
                timezone.utc,
            )

            inicio = max(
                inicio_dia,
                agora,
            )

            fim = (
                inicio_dia
                + timedelta(days=1)
                - timedelta(milliseconds=1)
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
                    "fim": iso(fim),
                })

            # O calor previsto do dia só é somado
            # depois da avaliação da janela.
            # Assim, ele não antecipa a colheita
            # no próprio dia em que será acumulado.
            acumulado += max(
                0,
                dia.temperaturaMediaC
                - parametros.temperaturaBaseC,
            )

        colheita["status"] = (
            "FAVORAVEL"
            if colheita["windows"]
            else "SEM_JANELA_NO_HORIZONTE"
        )

        if not colheita["windows"]:
            colheita["reasons"].append(
                "Nenhum dia atende aos limites "
                "térmicos e meteorológicos."
            )

    dados_exportacao = (
        pedido.parametrosExportacao
    )

    criterios = (
        avaliar_exportacao(
            dados_exportacao,
            pedido.logistica,
        )
        if dados_exportacao
        else None
    )

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
        exportacao["reasons"].extend(
            criterios.motivos
        )

        exportacao["status"] = (
            "FAVORAVEL"
            if criterios.criteriosAtendidos
            else "NAO_FAVORAVEL"
        )

        if criterios.criteriosAtendidos:
            frio = timedelta(
                hours=(
                    dados_exportacao
                    .horasAteResfriamento
                )
            )

            trajeto = timedelta(
                hours=(
                    pedido.logistica
                    .tempoEstimadoHoras
                )
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
                        inicio + frio
                    ),

                    "embarqueFim": iso(
                        fim + frio
                    ),

                    "chegadaInicio": iso(
                        inicio + frio + trajeto
                    ),

                    "chegadaFim": iso(
                        fim + frio + trajeto
                    ),
                })

    return {
        "contractVersion": "1.0",

        "modelVersion": (
            "regras-parametrizadas-python-v1.1"
        ),

        "generatedAt": iso(
            datetime.now(timezone.utc)
        ),

        "harvest": colheita,

        "export": exportacao,

        "natureza": (
            "ESTIMATIVA_PARAMETRIZADA"
        ),

        "memoriaCalculo": {
            "gdd": gdd.model_dump(),

            "exportacao": (
                criterios.model_dump()
                if criterios
                else None
            ),
        },

        "coberturaHistoricaPercentual": round(
            gdd.coberturaPercentual,
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
            (
                "Cadeia do frio declarada; não há "
                "medição da temperatura de "
                "refrigeração neste contrato."
            ),
        ],
    }


# ==================================================
# Autenticação entre serviços
# ==================================================

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
        recebido = (
            authorization or ""
        ).encode("utf-8")

        esperado = (
            f"Bearer {token}"
        ).encode("utf-8")

        if not secrets.compare_digest(
            recebido,
            esperado,
        ):
            raise HTTPException(
                status_code=401,
                detail="Token de serviço inválido.",
            )


# ==================================================
# API
# ==================================================

app = FastAPI(
    title="ValeSafra — Recomendações",
    version="1.1",
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "valesafra-python",
    }


@app.post(
    "/v1/recommendations/harvest-export",
    response_model=Resposta,
    dependencies=[
        Depends(autenticar),
    ],
)
def recomendar(pedido: Pedido):
    return Resposta.model_validate(
        calcular(pedido)
    )