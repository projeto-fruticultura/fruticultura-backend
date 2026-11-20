import unittest

import pandas as pd

from pipeline import (
    tratar,
    resumir,
)


class TesteTratamento(unittest.TestCase):
    def test_descartes_e_estatisticas(self):
        item = {
            "sensorId": 40,
            "loteId": 19,
            "propriedadeId": 19,

            "dataHoraLeitura": (
                "2026-11-18T00:00:00Z"
            ),

            "temperatura": 20,

            "umidadeLegada": 60,
        }

        outro = {
            **item,

            "dataHoraLeitura": (
                "2026-11-18T00:10:00Z"
            ),

            "temperatura": 30,
        }

        invalido = {
            **item,
            "temperatura": 150,
        }

        nulo = {
            **item,
            "umidadeLegada": None,
        }

        dados = pd.DataFrame([
            item,
            item,
            outro,
            invalido,
            nulo,
        ])

        base, resumo = tratar(
            dados
        )

        self.assertEqual(
            resumo,
            {
                "recebidos": 5,
                "invalidos": 2,
                "registrosEmConflito": 0,
                "duplicadosIguais": 1,
                "validos": 2,
            },
        )

        estatisticas = resumir(
            base,
            "loteId",
        )

        self.assertEqual(
            estatisticas.iloc[0][
                "temperaturaMedia"
            ],
            25,
        )

        self.assertEqual(
            str(
                base.dataHoraLeitura.dt.tz
            ),
            "UTC",
        )

    def test_conflito_descarta_as_duas(self):
        item = {
            "sensorId": 40,
            "loteId": 19,
            "propriedadeId": 19,

            "dataHoraLeitura": (
                "2026-11-18T00:00:00Z"
            ),

            "temperatura": 20,

            "umidadeLegada": 60,
        }

        dados = pd.DataFrame([
            item,

            {
                **item,
                "temperatura": 21,
            },
        ])

        base, resumo = tratar(
            dados
        )

        self.assertEqual(
            len(base),
            0,
        )

        self.assertEqual(
            resumo[
                "registrosEmConflito"
            ],
            2,
        )

    def test_sem_historico(self):
        dados = pd.DataFrame(
            columns=[
                "sensorId",
                "loteId",
                "propriedadeId",
                "dataHoraLeitura",
                "temperatura",
                "umidadeLegada",
            ]
        )

        base, resumo = tratar(
            dados
        )

        self.assertEqual(
            resumo["validos"],
            0,
        )

        self.assertTrue(
            resumir(
                base,
                "loteId",
            ).empty
        )


if __name__ == "__main__":
    unittest.main()