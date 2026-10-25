"""
Script de ingestão: baixa todos os ZIPs da ANP (2021-01 a 2023-10),
agrega produção por campo/mês e gera backend/app/data/producao_mensal.json.

Uso:
    python scripts/gerar_base_producao.py

O JSON gerado deve ser commitado no repositório para que o backend
leia dele instantaneamente (sem baixar ZIPs em runtime).
"""
import csv
import io
import json
import os
import unicodedata
import zipfile
from pathlib import Path

import httpx

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas-natural-por-poco"
)

JANELA = [(ano, mes) for ano in (2021, 2022, 2023) for mes in range(1, 13)
          if not (ano == 2023 and mes > 10)]

SAIDA = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "producao_mensal.json"


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


def parse_float(value: str) -> float:
    if not value:
        return 0.0
    return float(str(value).replace(".", "").replace(",", "."))


def decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def dict_reader(texto: str):
    cabecalho = texto.splitlines()[0] if texto else ""
    delim = ";" if cabecalho.count(";") > cabecalho.count(",") else ","
    return csv.DictReader(io.StringIO(texto), delimiter=delim)


def main():
    base: dict[str, dict[str, dict[str, float]]] = {}
    avisos = []
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for ano, mes in JANELA:
            url = f"{BASE}/{ano}/producao-{ano}-{mes:02d}.zip"
            periodo = f"{ano}-{mes:02d}"
            try:
                resp = client.get(url)
                resp.raise_for_status()
            except Exception as e:
                avisos.append(f"{periodo}: {e}")
                continue
            with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
                for nome in z.namelist():
                    if not nome.lower().endswith(".csv"):
                        continue
                    texto = decode(z.read(nome))
                    for linha in dict_reader(texto):
                        campo = (linha.get("Campo") or "").strip()
                        if not campo:
                            continue
                        chave = normalizar(campo)
                        entry = base.setdefault(chave, {}).setdefault(periodo, {"campo": campo, "oleo_bpd": 0.0, "gas_mmd": 0.0})
                        entry["oleo_bpd"] += parse_float(linha.get("Óleo (bbl/dia)") or "0")
                        entry["gas_mmd"] += parse_float(linha.get("Gás Natural (Mm³/dia)") or "0")
            print(f"OK {periodo}")

    # Arredondar e montar estrutura final: {campo_normalizado: {periodo: {oleo_bpd, gas_mmd, campo}}}
    final = {}
    for chave, periodos in base.items():
        final[chave] = {}
        for periodo, dados in periodos.items():
            final[chave][periodo] = {
                "campo": dados["campo"],
                "oleo_bpd": round(dados["oleo_bpd"], 2),
                "gas_mmd": round(dados["gas_mmd"], 3),
            }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(final, ensure_ascii=False), encoding="utf-8")
    print(f"\nBase gerada: {SAIDA}")
    print(f"Campos: {len(final)} | Períodos por campo: variável")
    if avisos:
        print("\nAvisos (meses sem ZIP):")
        for a in avisos:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
