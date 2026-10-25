"""
Script de ingestão 2024-2026: baixa os CSVs da ANP (mar por ano, terra por trimestre),
detecta colunas automaticamente e insere no banco backend/app/data/producao.db.

Uso:
    python scripts/gerar_base_2024.py
"""
import csv
import io
import sqlite3
import unicodedata
from pathlib import Path

import httpx

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-fase-de-desenvolvimento-e-producao/"
    "arquivos-producao-de-petroleo-e-gas-natural-nacional"
)

URLS = {
    "2024": f"{BASE}/pm/producao_por_poco_2024.csv",
    "2025": f"{BASE}/pm/producao-mar-2025.csv",
    "2026": f"{BASE}/pm/producao-mar-2026.csv",
    "2024-T1": f"{BASE}/pt/2024/producao-por-poco-terra-trim-1.csv",
    "2024-T2": f"{BASE}/pt/2024/producao-por-poco-terra-trim-2.csv",
    "2024-T3": f"{BASE}/pt/2024/producao-por-poco-terra-trim-3.csv",
    "2024-T4": f"{BASE}/pt/2024/producao_por_poco_terra_trim_4.csv",
    "2025-T1": f"{BASE}/pt/2025/producao_por_poco_terra_2025_1_trim.csv",
    "2025-T2": f"{BASE}/pt/2025/producao_por_poco_terra_2025_2_trim.csv",
    "2025-T3": f"{BASE}/pt/2025/producao_por_poco_terra_2025_3_trim.csv",
    "2025-T4": f"{BASE}/pt/2025/producao_por_poco_terra_2025_4_trim.csv",
    "2026-T1": f"{BASE}/pt/2026/producao_por_poco_terra_2026_1_trim.csv",
    "2026-T2": f"{BASE}/pt/2026/producao_por_poco_terra_2026_2_trim.csv",
}

SAIDA = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "producao.db"


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


def detectar_colunas(cabecalho: list[str]) -> dict:
    """Detecta colunas de campo, período, óleo e gás por heurística de nome."""
    mapa = {}
    for col in cabecalho:
        c = normalizar(col)
        if "campo" in c and "campo" not in mapa:
            mapa["campo"] = col
        elif ("periodo" in c or "mes" in c or "competencia" in c) and "periodo" not in mapa:
            mapa["periodo"] = col
        elif ("oleo" in c or "petroleo" in c) and "bbl" in c and "oleo" not in mapa:
            mapa["oleo"] = col
        elif ("gas" in c) and ("mm3" in c or "m3" in c) and "gas" not in mapa:
            mapa["gas"] = col
    return mapa


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


def extrair_periodo(valor: str) -> str:
    """Extrai período no formato YYYY-MM a partir de valores como 'jan/2024', '01/2024', etc."""
    v = normalizar(valor)
    meses = {"jan": "01", "fev": "02", "mar": "03", "abr": "04", "mai": "05", "jun": "06", "jul": "07", "ago": "08", "set": "09", "out": "10", "nov": "11", "dez": "12"}
    for k, m in meses.items():
        if k in v:
            ano = "".join(ch for ch in v if ch.isdigit())
            if len(ano) >= 4:
                return f"{ano[:4]}-{m}"
    # Tenta formato MM/YYYY ou YYYY-MM
    import re
    match = re.search(r"(\d{1,2})/(\d{4})", valor)
    if match:
        return f"{match.group(2)}-{match.group(1).zfill(2)}"
    match = re.search(r"(\d{4})-(\d{1,2})", valor)
    if match:
        return f"{match.group(1)}-{match.group(2).zfill(2)}"
    return valor


def main():
    if not SAIDA.exists():
        raise SystemExit("Banco producao.db não encontrado. Execute primeiro scripts/gerar_base_sqlite.py.")

    conn = sqlite3.connect(SAIDA)
    cur = conn.cursor()
    avisos = []
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for rotulo, url in sorted(URLS.items()):
            try:
                resp = client.get(url)
                resp.raise_for_status()
            except Exception as e:
                avisos.append(f"{rotulo}: {e}")
                continue
            texto = decode(resp.content)
            leitor = dict_reader(texto)
            cabecalho = leitor.fieldnames or []
            mapa = detectar_colunas(cabecalho)
            if not all(k in mapa for k in ("campo", "periodo", "oleo", "gas")):
                avisos.append(f"{rotulo}: colunas não detectadas — cabeçalho: {cabecalho}")
                continue
            inseridos = 0
            for linha in leitor:
                campo = (linha.get(mapa["campo"]) or "").strip()
                periodo_raw = (linha.get(mapa["periodo"]) or "").strip()
                if not campo or not periodo_raw:
                    continue
                periodo = extrair_periodo(periodo_raw)
                chave = normalizar(campo)
                oleo = parse_float(linha.get(mapa["oleo"]) or "0")
                gas = parse_float(linha.get(mapa["gas"]) or "0")
                # Acumular se o mesmo campo/período aparecer mais de uma vez (ex.: vários poços)
                existente = cur.execute(
                    "SELECT oleo_bpd, gas_mmd FROM producao_mensal WHERE periodo = ? AND campo_norm = ?",
                    (periodo, chave),
                ).fetchone()
                if existente:
                    novo_oleo = round(existente[0] + oleo, 2)
                    novo_gas = round(existente[1] + gas, 3)
                    cur.execute(
                        "UPDATE producao_mensal SET oleo_bpd = ?, gas_mmd = ? WHERE periodo = ? AND campo_norm = ?",
                        (novo_oleo, novo_gas, periodo, chave),
                    )
                else:
                    cur.execute(
                        "INSERT INTO producao_mensal (periodo, campo, campo_norm, oleo_bpd, gas_mmd) VALUES (?, ?, ?, ?, ?)",
                        (periodo, campo, chave, round(oleo, 2), round(gas, 3)),
                    )
                inseridos += 1
            conn.commit()
            print(f"OK {rotulo} ({inseridos} linhas processadas)")

    total = cur.execute("SELECT COUNT(*) FROM producao_mensal").fetchone()[0]
    periodos = cur.execute("SELECT COUNT(DISTINCT periodo) FROM producao_mensal").fetchone()[0]
    conn.close()
    print(f"\nBanco atualizado: {SAIDA}")
    print(f"Total de registros: {total} | Períodos únicos: {periodos}")
    if avisos:
        print("\nAvisos:")
        for a in avisos:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
