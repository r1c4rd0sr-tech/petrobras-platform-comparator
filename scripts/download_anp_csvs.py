#!/usr/bin/env python3
"""Baixa os CSVs publicados no Anuário Estatístico 2026 da ANP.

Uso:
    python scripts/download_anp_csvs.py

Os arquivos são salvos em backend/data/anp/.
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ANUARIO_URL = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "anuario/anuario-estatistico-2026-dados-abertos"
)
DESTINO = Path("backend/data/anp")


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    resposta = requests.get(ANUARIO_URL, timeout=60)
    resposta.raise_for_status()
    sopa = BeautifulSoup(resposta.text, "html.parser")

    links = []
    for a in sopa.find_all("a", href=True):
        href = a["href"]
        if re.search(r"\.csv(\?|$)", href, re.IGNORECASE):
            links.append(urljoin(ANUARIO_URL, href))

    links = sorted(set(links))
    if not links:
        raise SystemExit("Nenhum CSV encontrado na página do Anuário 2026.")

    print(f"Encontrados {len(links)} CSVs.")
    for url in links:
        nome = url.split("/")[-1].split("?")[0]
        caminho = DESTINO / nome
        if caminho.exists():
            print(f"Já existe: {nome}")
            continue
        print(f"Baixando: {nome}")
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with caminho.open("wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)


if __name__ == "__main__":
    main()
