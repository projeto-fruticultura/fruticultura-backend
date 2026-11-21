import os
import math
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app, arredondar_margem
from test_main import FixtureServico


class TesteMargens(FixtureServico):
    def test_empate_decimal_nao_favorece_exportacao(self):
        self.payload["parametrosExportacao"].update({
            "precoInternoKg": 6.1,
            "custoInternoKg": 0.0,
            "precoExportacaoKg": 8.4,
            "custoExportacaoKg": 2.3,
        })
        resposta = self.consultar()
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()
        memoria = resultado["memoriaCalculo"]["exportacao"]
        self.assertEqual(memoria["margemInternaKg"], 6.1)
        self.assertEqual(memoria["margemExportacaoKg"], 6.1)
        self.assertFalse(memoria["margemExportacaoVantajosa"])
        self.assertEqual(resultado["export"]["status"], "NAO_FAVORAVEL")
        self.assertEqual(resultado["export"]["windows"], [])

    def test_margem_maior_continua_favoravel(self):
        self.payload["parametrosExportacao"].update({
            "precoInternoKg": 6.1,
            "custoInternoKg": 0.0,
            "precoExportacaoKg": 12.0,
            "custoExportacaoKg": 2.3,
        })
        resultado = self.consultar().json()
        self.assertEqual(
            resultado["memoriaCalculo"]["exportacao"]["margemExportacaoKg"],
            9.7,
        )
        self.assertEqual(resultado["export"]["status"], "FAVORAVEL")

    def test_margem_que_arredonda_para_zero_nao_e_lucro(self):
        self.payload["parametrosExportacao"].update({
            "precoInternoKg": 1.0,
            "custoInternoKg": 2.0,
            "precoExportacaoKg": 2.30004,
            "custoExportacaoKg": 2.3,
        })
        resultado = self.consultar().json()
        self.assertEqual(
            resultado["memoriaCalculo"]["exportacao"]["margemExportacaoKg"],
            0.0,
        )
        self.assertEqual(resultado["export"]["status"], "NAO_FAVORAVEL")

    def test_arredondamento_quatro_casas(self):
        for valor, esperado in [
            (8.4 - 2.3, 6.1),
            (0.00005, 0.0001),
            (-0.00005, 0.0),
            (1.23456, 1.2346),
            (-1.23456, -1.2346),
            (math.nextafter(0.00005, 0.0), 0.0),
        ]:
            with self.subTest(valor=valor):
                self.assertEqual(arredondar_margem(valor), esperado)


class TesteAutenticacaoObrigatoria(FixtureServico):
    def test_sem_header_retorna_401(self):
        self.client.headers.pop("Authorization", None)
        self.assertEqual(self.consultar().status_code, 401)

    def test_token_incorreto_retorna_401(self):
        for valor in ["Bearer errado", "Basic errado", ""]:
            with self.subTest(header=valor):
                self.client.headers["Authorization"] = valor
                self.assertEqual(self.consultar().status_code, 401)

    def test_token_removido_em_execucao_retorna_503(self):
        with patch.dict(os.environ, {"PYTHON_RECOMMENDATION_TOKEN": ""}):
            resposta = self.consultar()
        self.assertEqual(resposta.status_code, 503)
        self.assertNotIn("token-exclusivo-dos-testes-python", resposta.text)

    def test_inicio_recusado_sem_token_valido(self):
        for valor in [None, "", " \t\n"]:
            with self.subTest(configuracao=repr(valor)):
                with patch.dict(os.environ):
                    if valor is None:
                        os.environ.pop("PYTHON_RECOMMENDATION_TOKEN", None)
                    else:
                        os.environ["PYTHON_RECOMMENDATION_TOKEN"] = valor
                    with self.assertRaisesRegex(
                        RuntimeError,
                        "PYTHON_RECOMMENDATION_TOKEN é obrigatório",
                    ):
                        with TestClient(app):
                            self.fail("Não deveria iniciar sem token.")

    def test_inicio_e_health_com_token_configurado(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/health").status_code, 200)


if __name__ == "__main__":
    unittest.main()
