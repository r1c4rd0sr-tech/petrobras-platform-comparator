"""
Script de ingestão: baixa todos os ZIPs da ANP (2021-01 a 2023-12),
processa os 3 CSVs de cada ZIP, agrega produção por campo/mês e cria
backend/app/data/producao.db (SQLite).

Uso:
    python scripts/gerar_base_sqlite.py

O banco gerado deve ser commitado no repositório para que o backend
leia dele instantaneamente (sem baixar ZIPs em runtime).
"""
import csv
import io
import sqlite3
import unicodedata
import zipfile
from pathlib import Path

import httpx

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas-natural-por-poco"
)

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

SAIDA = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "producao.db"


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
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    if SAIDA.exists():
        SAIDA.unlink()

    conn = sqlite3.connect(SAIDA)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS producao_mensal (
            periodo TEXT NOT NULL,
            campo TEXT NOT NULL,
            campo_norm TEXT NOT NULL,
            oleo_bpd REAL NOT NULL,
            gas_mmd REAL NOT NULL,
            PRIMARY KEY (periodo, campo_norm)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_campo_periodo ON producao_mensal (campo_norm, periodo)")

    avisos = []
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for periodo, url in sorted(URLS.items()):
            try:
                resp = client.get(url)
                resp.raise_for_status()
            except Exception as e:
                avisos.append(f"{periodo}: {e}")
                continue
            agregado = {}
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
                        entry = agregado.setdefault(chave, {"campo": campo, "oleo": 0.0, "gas": 0.0})
                        entry["oleo"] += parse_float(linha.get("Óleo (bbl/dia)") or "0")
                        entry["gas"] += parse_float(linha.get("Gás Natural (Mm³/dia)") or "0")
            for chave, dados in agregado.items():
                cur.execute(
                    "INSERT OR REPLACE INTO producao_mensal (periodo, campo, campo_norm, oleo_bpd, gas_mmd) VALUES (?, ?, ?, ?, ?)",
                    (periodo, dados["campo"], chave, round(dados["oleo"], 2), round(dados["gas"], 3)),
                )
            conn.commit()
            print(f"OK {periodo} ({len(agregado)} campos)")

    total = cur.execute("SELECT COUNT(*) FROM producao_mensal").fetchone()[0]
    campos = cur.execute("SELECT COUNT(DISTINCT campo_norm) FROM producao_mensal").fetchone()[0]
    conn.close()
    print(f"\nBanco gerado: {SAIDA}")
    print(f"Registros: {total} | Campos únicos: {campos}")
    if avisos:
        print("\nAvisos (meses sem ZIP):")
        for a in avisos:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
