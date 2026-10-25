"""
Script de ingestão de Refino: baixa os CSVs da ANP (Processamento de Petróleo e Produção de Derivados por Refinaria),
detecta colunas com colchetes e agrega por refinaria/período.

Uso:
    python scripts/gerar_base_refino.py
"""
import csv
import io
import re
import sqlite3
import unicodedata
from pathlib import Path

import httpx

BASE = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos"

URLS = {
    "processamento": f"{BASE}/processamento-de-petroleo-e-producao-de-derivados/Processamento%20de%20Petr%C3%B3leo%20(m%C2%B3)%201990-2026.csv",
    "derivados": f"{BASE}/processamento-de-petroleo-e-producao-de-derivados/Produ%C3%A7%C3%A3o%20de%20derivados%20de%20petr%C3%B3leo%20por%20refinaria%20(m%C2%B3)%201990-2026.csv",
}

SAIDA = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "refino.db"

M3_PARA_BBL = 6.28981  # 1 m³ = 6.28981 bbl


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


def detectar_colunas(cabecalho: list[str]) -> dict:
    """Detecta colunas com colchetes: [Refinaria], [Mês/Ano], [Processamento de Petróleo (m³)], [Produção de Derivados (m³)]."""
    mapa = {}
    for col in cabecalho:
        c = normalizar(col)
        if c == "[refinaria]" and "refinaria" not in mapa:
            mapa["refinaria"] = col
        elif c == "[mes/ano]" and "periodo" not in mapa:
            mapa["periodo"] = col
        elif "processamento de petroleo" in c and "processamento" not in mapa:
            mapa["processamento"] = col
        elif "producao de derivados" in c and "derivados" not in mapa:
            mapa["derivados"] = col
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


def extrair_periodo(valor: str) -> str | None:
    """Extrai YYYY-MM a partir de valores como 'jan/2024', '01/2024', etc."""
    v = normalizar(valor)
    meses = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}
    for k, m in meses.items():
        if k in v:
            ano = "".join(ch for ch in v if ch.isdigit())
            if len(ano) >= 4:
                return f"{ano[:4]}-{m:02d}"
    match = re.search(r"(\d{1,2})/(\d{4})", valor)
    if match:
        return f"{match.group(2)}-{int(match.group(1)):02d}"
    match = re.search(r"(\d{4})-(\d{1,2})", valor)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}"
    return None


def main():
    if SAIDA.exists():
        SAIDA.unlink()
    conn = sqlite3.connect(SAIDA)
    cur = conn.cursor()
    cur.execute(
        """CREATE TABLE IF NOT EXISTS refino_mensal (
            periodo TEXT NOT NULL,
            refinaria TEXT NOT NULL,
            refinaria_norm TEXT NOT NULL,
            carga_m3 REAL DEFAULT 0,
            carga_bpd REAL DEFAULT 0,
            derivados_m3 REAL DEFAULT 0,
            PRIMARY KEY (periodo, refinaria_norm)
        )"""
    )
    avisos = []
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for rotulo, url in URLS.items():
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
            if not all(k in mapa for k in ("refinaria", "periodo")):
                avisos.append(f"{rotulo}: colunas não detectadas — cabeçalho: {cabecalho}")
                continue
            inseridos = 0
            for linha in leitor:
                refinaria = (linha.get(mapa["refinaria"]) or "").strip()
                periodo_raw = (linha.get(mapa["periodo"]) or "").strip()
                if not refinaria or not periodo_raw:
                    continue
                periodo = extrair_periodo(periodo_raw)
                if periodo is None:
                    continue
                chave = normalizar(refinaria)
                carga_m3 = parse_float(linha.get(mapa.get("processamento", "")) or "0") if "processamento" in mapa else 0.0
                derivados_m3 = parse_float(linha.get(mapa.get("derivados", "")) or "0") if "derivados" in mapa else 0.0
                # Converte carga m³ mensal -> bbl/dia (aproximação: 30 dias)
                carga_bpd = round((carga_m3 * M3_PARA_BBL) / 30, 2)
                existente = cur.execute(
                    "SELECT carga_m3, carga_bpd, derivados_m3 FROM refino_mensal WHERE periodo = ? AND refinaria_norm = ?",
                    (periodo, chave),
                ).fetchone()
                if existente:
                    novo_carga_m3 = round(existente[0] + carga_m3, 2)
                    novo_carga_bpd = round(existente[1] + carga_bpd, 2)
                    novo_derivados = round(existente[2] + derivados_m3, 2)
                    cur.execute(
                        "UPDATE refino_mensal SET carga_m3 = ?, carga_bpd = ?, derivados_m3 = ? WHERE periodo = ? AND refinaria_norm = ?",
                        (novo_carga_m3, novo_carga_bpd, novo_derivados, periodo, chave),
                    )
                else:
                    cur.execute(
                        "INSERT INTO refino_mensal (periodo, refinaria, refinaria_norm, carga_m3, carga_bpd, derivados_m3) VALUES (?, ?, ?, ?, ?, ?)",
                        (periodo, refinaria, chave, carga_m3, carga_bpd, derivados_m3),
                    )
                inseridos += 1
            conn.commit()
            print(f"OK {rotulo} ({inseridos} linhas processadas)")

    total = cur.execute("SELECT COUNT(*) FROM refino_mensal").fetchone()[0]
    periodos = cur.execute("SELECT COUNT(DISTINCT periodo) FROM refino_mensal").fetchone()[0]
    refinarias = cur.execute("SELECT COUNT(DISTINCT refinaria_norm) FROM refino_mensal").fetchone()[0]
    conn.close()
    print(f"\nBanco atualizado: {SAIDA}")
    print(f"Total de registros: {total} | Períodos únicos: {periodos} | Refinarias únicas: {refinarias}")
    if avisos:
        print("\nAvisos:")
        for a in avisos:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
