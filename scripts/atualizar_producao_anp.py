"""Atualiza automaticamente o banco de produção (Temporal) com novos arquivos da ANP.

- Deduz os candidatos de URL (mar por ano; terra por trimestre) a partir do ano corrente.
- Consulta o manifesto backend/data/anp/processados.json para não processar o mesmo arquivo duas vezes.
- Baixa apenas arquivos novos, valida as colunas e faz ingestão incremental em producao.db.
- Os meses de 2021-2023 (ZIPs) já estão no banco e não são reprocessados.
"""
import json
import re
import sqlite3
import unicodedata
import calendar
import csv
import io
from datetime import date
from pathlib import Path

import httpx

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-fase-de-desenvolvimento-e-producao/"
    "arquivos-producao-de-petroleo-e-gas-natural-nacional"
)
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "backend" / "app" / "data" / "producao.db"
MANIFEST_PATH = ROOT / "backend" / "data" / "anp" / "processados.json"
M3_PARA_BBL = 6.28981

# Arquivos já processados pelo gerar_base_2024.py (2024 ao 2026-T2)
JÁ_PROCESSADOS = [
    f"{BASE}/pm/producao_por_poco_2024.csv",
    f"{BASE}/pm/producao-mar-2025.csv",
    f"{BASE}/pm/producao-mar-2026.csv",
    f"{BASE}/pt/2024/producao-por-poco-terra-trim-1.csv",
    f"{BASE}/pt/2024/producao-por-poco-terra-trim-2.csv",
    f"{BASE}/pt/2024/producao-por-poco-terra-trim-3.csv",
    f"{BASE}/pt/2024/producao_por_poco_terra_trim_4.csv",
    f"{BASE}/pt/2025/producao_por_poco_terra_2025_1_trim.csv",
    f"{BASE}/pt/2025/producao_por_poco_terra_2025_2_trim.csv",
    f"{BASE}/pt/2025/producao_por_poco_terra_2025_3_trim.csv",
    f"{BASE}/pt/2025/producao_por_poco_terra_2025_4_trim.csv",
    f"{BASE}/pt/2026/producao_por_poco_terra_2026_1_trim.csv",
    f"{BASE}/pt/2026/producao_por_poco_terra_2026_2_trim.csv",
]


def normalizar(texto):
    sem_acento = unicodedata.normalize("NFD", texto)
    return "".join(c for c in sem_acento if unicodedata.category(c) != "Mn").strip().casefold()


def candidatos(ano_atual: int, mes_atual: int):
    """Gera candidatos de URL para mar (anual) e terra (trimestral)."""
    urls = []
    for ano in range(2024, ano_atual + 1):
        if ano == 2024:
            urls.append((f"mar-{ano}", f"{BASE}/pm/producao_por_poco_{ano}.csv"))
        else:
            urls.append((f"mar-{ano}", f"{BASE}/pm/producao-mar-{ano}.csv"))
        trimestres = 4 if ano < ano_atual else max(1, (mes_atual - 1) // 3 + 1)
        for t in range(1, trimestres + 1):
            if ano == 2024:
                nome = f"producao-por-poco-terra-trim-{t}.csv" if t < 4 else "producao_por_poco_terra_trim_4.csv"
            else:
                nome = f"producao_por_poco_terra_{ano}_{t}_trim.csv"
            urls.append((f"terra-{ano}-T{t}", f"{BASE}/pt/{ano}/{nome}"))
    return urls


def decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def detectar_colunas(cabecalho):
    mapa = {}
    for col in cabecalho:
        c = normalizar(col)
        if c == "[campo]" and "campo" not in mapa:
            mapa["campo"] = col
        elif c == "[mes/ano]" and "periodo" not in mapa:
            mapa["periodo"] = col
        elif "producao de oleo" in c and "oleo" not in mapa:
            mapa["oleo"] = col
        elif "producao de gas associado" in c and "gas_assoc" not in mapa:
            mapa["gas_assoc"] = col
        elif "producao de gas nao associado" in c and "gas_nao_assoc" not in mapa:
            mapa["gas_nao_assoc"] = col
    return mapa


def extrair_periodo(valor):
    v = normalizar(valor)
    meses = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}
    for k, m in meses.items():
        if k in v:
            ano = "".join(ch for ch in v if ch.isdigit())
            if len(ano) >= 4:
                ano_int = int(ano[:4])
                return f"{ano_int}-{m:02d}", calendar.monthrange(ano_int, m)[1]
    m = re.search(r"(\d{1,2})/(\d{4})", valor)
    if m:
        mes, ano = int(m.group(1)), int(m.group(2))
        return f"{ano}-{mes:02d}", calendar.monthrange(ano, mes)[1]
    m = re.search(r"(\d{4})-(\d{1,2})", valor)
    if m:
        ano, mes = int(m.group(1)), int(m.group(2))
        return f"{ano}-{mes:02d}", calendar.monthrange(ano, mes)[1]
    return None


def main():
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MANIFEST_PATH.exists():
        processados = set(json.loads(MANIFEST_PATH.read_text(encoding="utf-8")))
    else:
        processados = set(JÁ_PROCESSADOS)

    hoje = date.today()
    candidatos = candidatos(hoje.year, hoje.month)
    novos = [(rotulo, url) for rotulo, url in candidatos if url not in processados]

    if not novos:
        print("Nenhum arquivo novo da ANP para processar.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    avisos = []
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        for rotulo, url in novos:
            try:
                resp = client.get(url)
                resp.raise_for_status()
            except Exception as e:
                avisos.append(f"{rotulo}: {e}")
                continue
            texto = decode(resp.content)
            linhas = texto.splitlines()
            delim = ";" if linhas[0].count(";") > linhas[0].count(",") else ","
            leitor = csv.DictReader(io.StringIO(texto), delimiter=delim)
            mapa = detectar_colunas(leitor.fieldnames or [])
            if not all(k in mapa for k in ("campo", "periodo", "oleo", "gas_assoc", "gas_nao_assoc")):
                avisos.append(f"{rotulo}: colunas não detectadas — cabeçalho: {leitor.fieldnames}")
                continue
            inseridos = 0
            for linha in leitor:
                campo = (linha.get(mapa["campo"]) or "").strip()
                periodo_raw = (linha.get(mapa["periodo"]) or "").strip()
                if not campo or not periodo_raw:
                    continue
                periodo_dias = extrair_periodo(periodo_raw)
                if periodo_dias is None:
                    continue
                periodo, dias = periodo_dias
                chave = normalizar(campo)

                def num(valor):
                    return float(str(valor or "0").replace(".", "").replace(",", "."))

                oleo_bpd = round((num(linha.get(mapa["oleo"])) * M3_PARA_BBL) / dias, 2)
                gas_mmd = round((num(linha.get(mapa["gas_assoc"])) + num(linha.get(mapa["gas_nao_assoc"]))) / dias, 3)
                existente = cur.execute(
                    "SELECT oleo_bpd, gas_mmd FROM producao_mensal WHERE periodo = ? AND campo_norm = ?",
                    (periodo, chave),
                ).fetchone()
                if existente:
                    cur.execute(
                        "UPDATE producao_mensal SET oleo_bpd = ?, gas_mmd = ? WHERE periodo = ? AND campo_norm = ?",
                        (round(existente[0] + oleo_bpd, 2), round(existente[1] + gas_mmd, 3), periodo, chave),
                    )
                else:
                    cur.execute(
                        "INSERT INTO producao_mensal (periodo, campo, campo_norm, oleo_bpd, gas_mmd) VALUES (?, ?, ?, ?, ?)",
                        (periodo, campo, chave, oleo_bpd, gas_mmd),
                    )
                inseridos += 1
            conn.commit()
            processados.add(url)
            print(f"OK {rotulo} ({inseridos} linhas)")

    conn.close()
    MANIFEST_PATH.write_text(json.dumps(sorted(processados), indent=2), encoding="utf-8")
    print(f"\nManifesto atualizado: {MANIFEST_PATH}")
    if avisos:
        print("\nAvisos:")
        for a in avisos:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
