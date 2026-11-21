import copy
import os
import unittest

from datetime import (
    datetime,
    timedelta,
    timezone,
)

from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


def exemplo():
    return {
        "contractVersion": "1.0",

        "requestedAt": (
            "2026-11-18T12:00:00Z"
        ),

        "lote": {
            "id": 19,
            "faseFenologica": "MATURACAO",
        },

        "parametrosAgronomicos": {
            "dataHoraReferencia": (
                "2026-11-18T00:00:00Z"
            ),

            "grausDiaReferencia": 120.0,
            "temperaturaBaseC": 10.0,
            "grausDiaAlvo": 120.0,
            "chuvaMaximaMmDia": 5.0,
            "umidadeArMaximaPercentual": 80.0,
            "fonte": "EXEMPLO DE TESTE",
            "versao": "teste-v1",
        },

        "historico": [],

        "previsaoDiaria": {
            "fonte": "SIMULADA",
            "timezone": "UTC",

            "dias": [
                {
                    "data": "2026-11-18",

                    "temperaturaMediaC": 28.0,

                    "precipitacaoMm": 0.0,

                    "umidadeRelativaMediaPercentual": 65.0,
                }
            ],
        },

        "logistica": {
            "rotaId": 1,
            "tempoEstimadoHoras": 4.0,
        },

        "parametrosExportacao": {
            "horasAteResfriamento": 2.0,
            "vidaUtilHoras": 48.0,
            "precoInternoKg": 5.0,
            "precoExportacaoKg": 9.0,
            "custoInternoKg": 1.0,
            "custoExportacaoKg": 3.0,
            "cadeiaFrioGarantida": True,
            "moeda": "BRL",

            "dataHoraCotacao": (
                "2026-11-18T10:00:00Z"
            ),

            "fonteCotacao": "SIMULADA",
        },
    }


class FixtureServico(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "PYTHON_RECOMMENDATION_TOKEN": "token-exclusivo-dos-testes-python",
            },
        )

        self.env.start()
        self.addCleanup(self.env.stop)

        self.client = self.enterContext(TestClient(
            app,
            headers={
                "Authorization": "Bearer token-exclusivo-dos-testes-python",
            },
        ))

        self.payload = copy.deepcopy(
            exemplo()
        )

    def consultar(self):
        return self.client.post(
            "/v1/recommendations/harvest-export",
            json=self.payload,
        )


class TesteServico(FixtureServico):
    def test_colheita_e_exportacao(self):
        resposta = self.consultar()

        self.assertEqual(
            resposta.status_code,
            200,
        )

        resultado = resposta.json()

        self.assertEqual(
            resultado["harvest"]["status"],
            "FAVORAVEL",
        )

        self.assertEqual(
            resultado["export"]["status"],
            "FAVORAVEL",
        )

        self.assertEqual(
            resultado["export"]["windows"][0]
            ["chegadaInicio"],

            "2026-11-18T18:00:00.000Z",
        )

    def test_fase(self):
        self.payload["lote"][
            "faseFenologica"
        ] = None

        self.assertEqual(
            self.consultar().json()
            ["harvest"]["status"],

            "AGUARDAR_MATURACAO",
        )

    def test_chuva(self):
        self.payload["previsaoDiaria"][
            "dias"
        ][0]["precipitacaoMm"] = 20.0

        self.assertEqual(
            self.consultar().json()
            ["harvest"]["status"],

            "SEM_JANELA_NO_HORIZONTE",
        )

    def test_lacunas(self):
        self.payload["parametrosAgronomicos"][
            "dataHoraReferencia"
        ] = "2026-11-17T00:00:00Z"

        self.assertEqual(
            self.consultar().json()
            ["harvest"]["status"],

            "DADOS_INSUFICIENTES",
        )

    def test_frio(self):
        self.payload["parametrosExportacao"][
            "horasAteResfriamento"
        ] = 6.0

        self.assertEqual(
            self.consultar().json()
            ["export"]["status"],

            "NAO_FAVORAVEL",
        )

    def test_margem(self):
        self.payload["parametrosExportacao"][
            "precoExportacaoKg"
        ] = 5.0

        self.assertEqual(
            self.consultar().json()
            ["export"]["status"],

            "NAO_FAVORAVEL",
        )

    def test_invalido(self):
        self.payload["previsaoDiaria"][
            "dias"
        ][0][
            "umidadeRelativaMediaPercentual"
        ] = 150.0

        self.assertEqual(
            self.consultar().status_code,
            422,
        )

    def test_datas(self):
        self.payload["previsaoDiaria"][
            "dias"
        ][0]["data"] = "2026-11-20"

        self.assertEqual(
            self.consultar().status_code,
            422,
        )

    def test_sem_exportacao(self):
        self.payload["logistica"] = None

        self.payload[
            "parametrosExportacao"
        ] = None

        self.assertEqual(
            self.consultar().json()
            ["export"]["status"],

            "DADOS_INSUFICIENTES",
        )

    def test_token(self):
        with patch.dict(
            os.environ,
            {
                "PYTHON_RECOMMENDATION_TOKEN": (
                    "teste-interno"
                ),
            },
        ):
            self.assertEqual(
                self.consultar().status_code,
                401,
            )

            resposta = self.client.post(
                "/v1/recommendations/harvest-export",

                json=self.payload,

                headers={
                    "Authorization": (
                        "Bearer teste-interno"
                    ),
                },
            )

            self.assertEqual(
                resposta.status_code,
                200,
            )


class TesteMemoriaCalculo(FixtureServico):
    def test_gdd_integracao_intervalos(self):
        referencia = datetime(
            2026,
            11,
            17,
            tzinfo=timezone.utc,
        )

        parametros = self.payload[
            "parametrosAgronomicos"
        ]

        parametros["dataHoraReferencia"] = (
            "2026-11-17T00:00:00Z"
        )

        parametros[
            "grausDiaReferencia"
        ] = 100.0

        # 49 medições separadas por 30 minutos:
        # cobrem exatamente 24 horas.
        self.payload["historico"] = [
            {
                "instante": (
                    referencia
                    + timedelta(minutes=30 * indice)
                ).isoformat(),

                "temperaturaC": 20.0,
            }

            for indice in range(49)
        ]

        resposta = self.consultar()

        self.assertEqual(
            resposta.status_code,
            200,
        )

        resultado = resposta.json()

        gdd = resultado[
            "memoriaCalculo"
        ]["gdd"]

        # (20 °C - 10 °C) × 1 dia = 10 °C.dia
        self.assertAlmostEqual(
            gdd["gddObservado"],
            10.0,
        )

        self.assertAlmostEqual(
            gdd["gddAcumulado"],
            110.0,
        )

        self.assertAlmostEqual(
            gdd["gddFaltante"],
            10.0,
        )

        self.assertEqual(
            gdd["coberturaPercentual"],
            100.0,
        )

        # O calor previsto para hoje não pode
        # antecipar a colheita no início do dia.
        self.assertEqual(
            resultado["harvest"]["status"],
            "SEM_JANELA_NO_HORIZONTE",
        )

    def test_gdd_nao_negativo(self):
        self.payload["parametrosAgronomicos"][
            "dataHoraReferencia"
        ] = "2026-11-17T23:30:00Z"

        self.payload["historico"] = [
            {
                "instante": (
                    "2026-11-17T23:30:00Z"
                ),
                "temperaturaC": 5.0,
            },
            {
                "instante": (
                    "2026-11-18T00:00:00Z"
                ),
                "temperaturaC": 5.0,
            },
        ]

        self.assertEqual(
            self.consultar().json()
            ["memoriaCalculo"]["gdd"]
            ["gddObservado"],

            0.0,
        )

    def test_lacuna_nao_acumula(self):
        self.payload["parametrosAgronomicos"][
            "dataHoraReferencia"
        ] = "2026-11-17T23:00:00Z"

        self.payload["historico"] = [
            {
                "instante": (
                    "2026-11-17T23:00:00Z"
                ),
                "temperaturaC": 20.0,
            },
            {
                "instante": (
                    "2026-11-18T00:00:00Z"
                ),
                "temperaturaC": 20.0,
            },
        ]

        resultado = self.consultar().json()

        memoria = resultado[
            "memoriaCalculo"
        ]["gdd"]

        self.assertEqual(
            memoria["gddObservado"],
            0.0,
        )

        self.assertFalse(
            memoria["historicoSuficiente"]
        )

    def test_memoria_frio_e_margens(self):
        memoria = (
            self.consultar().json()
            ["memoriaCalculo"]["exportacao"]
        )

        self.assertEqual(
            memoria["tempoTotalAteChegadaHoras"],
            6.0,
        )

        self.assertEqual(
            memoria["margemInternaKg"],
            4.0,
        )

        self.assertEqual(
            memoria["margemExportacaoKg"],
            6.0,
        )

        self.assertTrue(
            memoria["criteriosAtendidos"]
        )

        self.assertFalse(
            memoria[
                "temperaturaRefrigeracaoVerificada"
            ]
        )

    def test_fim_vida_util_exato_bloqueia(self):
        self.payload["parametrosExportacao"][
            "vidaUtilHoras"
        ] = 6.0

        resultado = self.consultar().json()

        self.assertEqual(
            resultado["export"]["status"],
            "NAO_FAVORAVEL",
        )

        self.assertFalse(
            resultado["memoriaCalculo"]
            ["exportacao"]
            ["chegadaDentroVidaUtil"]
        )

    def test_fase_invalida_422(self):
        self.payload["lote"][
            "faseFenologica"
        ] = "QUALQUER_VALOR"

        self.assertEqual(
            self.consultar().status_code,
            422,
        )

    def test_numero_texto_422(self):
        self.payload["parametrosAgronomicos"][
            "temperaturaBaseC"
        ] = "10"

        self.assertEqual(
            self.consultar().status_code,
            422,
        )


if __name__ == "__main__":
    unittest.main()
