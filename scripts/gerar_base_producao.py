"""
Script de ingestão: baixa todos os ZIPs da ANP (2021-01 a 2023-12),
agrega produção por campo/mês e gera backend/app/data/producao_mensal.json.

URLs hardcoded conforme os links reais da ANP (padrões irregulares por período).

Uso:
    python scripts/gerar_base_producao.py
"""
import csv
import io
import json
import unicodedata
import zipfile
from pathlib import Path

import httpx

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas-natural-por-poco"
)

# URLs exatas fornecidas pelo usuário (padrões irregulares por período)
URLS = {
    "2021-01": f"{BASE}/2021_01_producao.zip",
    "2021-02": f"{BASE}/2021_02_producao.zip",
    "2021-03": f"{BASE}/2021_03_producao.zip",
    "2021-04": f"{BASE}/2021_04_producao.zip",
    "2021-05": f"{BASE}/2021_05_producao.zip",
    "2021-06": f"{BASE}/2021_06_producao.zip",
    "2021-07": f"{BASE}/2021_07_producao.zip",
    "2021-08": f"{BASE}/2021-08-producao.zip",
    "2021-09": f"{BASE}/2021-09-producao.zip",
    "2021-10": f"{BASE}/2021-10-producao.zip",
    "2021-11": f"{BASE}/2021-11-producao.zip",
    "2021-12": f"{BASE}/2021-12-producao.zip",
    "2022-01": f"{BASE}/2022/producao-2022-01.zip",
    "2022-02": f"{BASE}/2022/producao-2022-02.zip",
    "2022-03": f"{BASE}/2022/producao-2022-03.zip",
    "2022-04": f"{BASE}/2022/producao-2022-04.zip",
    "2022-05": f"{BASE}/2022/2022_05_producao.zip",
    "2022-06": f"{BASE}/2022/producao-2022-06.zip",
    "2022-07": f"{BASE}/2022/producao-2022-07.zip",
    "2022-08": f"{BASE}/2022/producao-2022-08.zip",
    "2022-09": f"{BASE}/2022/producao-2022-09.zip",
    "2022-10": f"{BASE}/2022/producao-2022-10.zip",
    "2022-11": f"{BASE}/2022/2022_11_producao.zip",
    "2022-12": f"{BASE}/2022/2022_12_producao.zip",
    "2023-01": f"{BASE}/2023/producao-01.zip",
    "2023-02": f"{BASE}/2023/producao-02.zip",
    "2023-03": f"{BASE}/2023/producao-03.zip",
    "2023-04": f"{BASE}/2023/producao-04.zip",
    "2023-05": f"{BASE}/2023/producao-05.zip",
    "2023-06": f"{BASE}/2023/producao-06.zip",
    "2023-07": f"{BASE}/2023/producao-07.zip",
    "2023-08": f"{BASE}/2023/producao-08.zip",
    "2023-09": f"{BASE}/2023/producao-09.zip",
    "2023-10": f"{BASE}/2023/producao-10.zip",
    "2023-11": f"{BASE}/2023/producao-11.zip",
    "2023-12": f"{BASE}/2023/producao-12.zip",
}

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
        for periodo, url in sorted(URLS.items()):
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
    print(f"Campos: {len(final)}")
    if avisos:
        print("\nAvisos (meses sem ZIP):")
        for a in avisos:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
