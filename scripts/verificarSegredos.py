import argparse
import json
import re
import subprocess

from pathlib import Path


PADROES = {
    "chave_privada": (
        r"-----BEGIN "
        r"(?:RSA |EC |OPENSSH )?"
        r"PRIVATE KEY-----"
    ),

    "token_github": (
        r"\b(?:"
        r"gh[pousr]_[A-Za-z0-9]{20,}"
        r"|github_pat_[A-Za-z0-9_]{30,}"
        r")\b"
    ),

    "chave_aws": (
        r"\b(?:AKIA|ASIA)"
        r"[A-Z0-9]{16}\b"
    ),

    "senha_neon": (
        r"\bnpg_[A-Za-z0-9]{12,}\b"
    ),
}

PADROES = {
    nome: re.compile(padrao)

    for nome, padrao
    in PADROES.items()
}

BANCO = re.compile(
    r"""postgres(?:ql)?://([^:\s"']+):([^@\s"']+)@([^/\s?"']+)"""
)

JWT = re.compile(
    r"""JWT_SECRET\s*[=:]\s*["']([A-Za-z0-9_+/.=-]{32,})["']"""
)


def git(*argumentos, check=True):
    resultado = subprocess.run(
        [
            "git",
            *argumentos,
        ],

        capture_output=True,

        check=check,
    )

    return resultado.stdout


def inspecionar(
    texto,
    arquivo,
    origem,
    achados,
):
    for numero, linha in enumerate(
        texto.splitlines(),
        1,
    ):
        for tipo, padrao in PADROES.items():
            if padrao.search(linha):
                achados.add((
                    origem,
                    arquivo,
                    numero,
                    tipo,
                ))

        for item in BANCO.finditer(linha):
            usuario, senha, host = (
                item.groups()
            )

            host_local = (
                host.split(":")[0]
                in [
                    "localhost",
                    "127.0.0.1",
                    "HOST",
                    "host",
                    "host-do-banco",
                ]
            )

            usuario_exemplo = (
                usuario.upper()
                in [
                    "USUARIO",
                    "USER",
                    "SEU_USUARIO",
                ]
            )

            senha_exemplo = (
                senha.upper()
                in [
                    "SENHA",
                    "PASSWORD",
                    "SUA_SENHA",
                ]
            )

            exemplo = (
                host_local
                or usuario_exemplo
                or senha_exemplo
            )

            if not exemplo:
                achados.add((
                    origem,
                    arquivo,
                    numero,
                    "url_postgres_com_credenciais",
                ))

        for item in JWT.finditer(linha):
            valor = (
                item.group(1)
                .lower()
            )

            exemplo = any(
                marcador in valor

                for marcador in [
                    "teste",
                    "test-",
                    "exemplo",
                    "troque",
                ]
            )

            if not exemplo:
                achados.add((
                    origem,
                    arquivo,
                    numero,
                    "jwt_secret_literal",
                ))


def executar(historico=False):
    raiz = Path(
        git(
            "rev-parse",
            "--show-toplevel",
        )
        .decode()
        .strip()
    )

    achados = set()

    arquivos = (
        git(
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        )
        .decode()
        .split("\0")
    )

    for arquivo in filter(
        None,
        arquivos,
    ):
        caminho = raiz / arquivo

        if caminho.is_file():
            inspecionar(
                caminho.read_text(
                    errors="replace"
                ),

                arquivo,

                "checkout",

                achados,
            )

    commits = (
        git(
            "rev-list",
            "--all",
        )
        .decode()
        .splitlines()

        if historico
        else []
    )

    regex = "|".join([
        r"-----BEGIN .*PRIVATE KEY-----",
        r"gh[pousr]_",
        r"github_pat_",
        r"AKIA[A-Z0-9]{16}",
        r"ASIA[A-Z0-9]{16}",
        r"npg_",
        r"postgres(ql)?://",
        r"JWT_SECRET",
    ])

    for commit in commits:
        resposta = (
            git(
                "grep",
                "-l",
                "-I",
                "-E",
                regex,
                commit,
                "--",

                check=False,
            )
            .decode(
                errors="replace"
            )
        )

        for referencia in resposta.splitlines():
            arquivo = (
                referencia
                .split(":", 1)[1]
            )

            dados = (
                git(
                    "show",
                    referencia,

                    check=False,
                )
                .decode(
                    errors="replace"
                )
            )

            inspecionar(
                dados,
                arquivo,
                commit,
                achados,
            )

    clone_raso = (
        git(
            "rev-parse",
            "--is-shallow-repository",
        )
        .decode()
        .strip()
        == "true"
    )

    return {
        "arquivosCheckoutExaminados": len([
            arquivo

            for arquivo in arquivos

            if arquivo
        ]),

        "commitsExaminados": len(
            commits
        ),

        "cloneRaso": clone_raso,

        "achados": [
            {
                "origem": origem,
                "arquivo": arquivo,
                "linha": linha,
                "tipo": tipo,
            }

            for origem, arquivo, linha, tipo
            in sorted(achados)
        ],

        "limite": (
            "Busca por padrões conhecidos; "
            "não prova ausência de todo tipo "
            "de segredo. Não inspeciona "
            "GitHub Actions Secrets "
            "ou variáveis da AWS."
        ),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--historico",
        action="store_true",
    )

    parser.add_argument(
        "--saida",
        type=Path,
    )

    argumentos = parser.parse_args()

    resultado = executar(
        argumentos.historico
    )

    texto = json.dumps(
        resultado,
        ensure_ascii=False,
        indent=2,
    )

    if argumentos.saida:
        argumentos.saida.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        argumentos.saida.write_text(
            texto + "\n",
            encoding="utf-8",
        )

    resumo = {
        chave: valor

        for chave, valor
        in resultado.items()

        if chave != "achados"
    }

    print(
        json.dumps(
            resumo,
            ensure_ascii=False,
        )
    )

    print(
        "Quantidade de achados:",
        len(
            resultado["achados"]
        ),
    )

    raise SystemExit(
        1
        if resultado["achados"]
        else 0
    )