import csv
import io
import zipfile
from datetime import date
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas-natural-por-poco"
)


def _url_zip(ano: int, mes: int | None) -> str:
    if ano <= 2020:
        return f"{BASE}/producao-por-poco-{ano}.zip"
    return f"{BASE}/{ano}/producao-{ano}-{mes:02d}.zip"


def _parse_float(value: str) -> float:
    if not value:
        return 0.0
    return float(str(value).replace(".", "").replace(",", "."))


def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


@lru_cache(maxsize=64)
def _csv_de_zip(url: str) -> str:
    """Baixa o ZIP uma vez e retorna o CSV interno como texto (cache em memória)."""
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        nome_csv = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        return _decode(z.read(nome_csv))


def _agregar_por_campo(csv_texto: str, campo: str) -> dict | None:
    leitor = csv.DictReader(io.StringIO(csv_texto))
    total_oleo = 0.0
    total_gas = 0.0
    periodo = None
    for linha in leitor:
        nome = (linha.get("Campo") or linha.get("CAMPO") or "").strip()
        if nome.lower() != campo.strip().lower():
            continue
        if periodo is None:
            periodo = (linha.get("Período") or linha.get("Periodo") or linha.get("PERÍODO") or "").strip()
        total_oleo += _parse_float(linha.get("Óleo (bbl/dia)") or linha.get("Oleo (bbl/dia)") or "0")
        total_gas += _parse_float(linha.get("Gás (10^6 m3/dia)") or linha.get("Gas (10^6 m3/dia)") or "0")
    if periodo is None:
        return None
    return {"periodo": periodo, "campo": campo, "oleo_bpd": round(total_oleo, 2), "gas_mmd": round(total_gas, 3)}


@router.get("/producao")
async def producao(
    campo: str = Query(..., description="Nome do campo de produção"),
    meses: int = Query(36, ge=1, le=36, description="Meses históricos (máx. 36)")
    ,
    ano: int | None = Query(None, description="Ano específico para teste pontual"),
    mes: int | None = Query(None, ge=1, le=12, description="Mês específico para teste pontual"),
):
    """Série histórica por campo a partir dos ZIPs de produção por poço da ANP.

    - ano/mes informados: retorna apenas aquele mês (teste pontual)
    - caso contrário: últimos N meses (2021-2023 mensal; <=2020 anual)
    - 2024+: disponível apenas via CDP/ORDS (aviso)
    """
    if ano and mes:
        url = _url_zip(ano, mes)
        try:
            csv_texto = _csv_de_zip(url)
            registro = _agregar_por_campo(csv_texto, campo)
            return {
                "campo": campo,
                "periodo": f"{ano}-{mes:02d}",
                "dados": [registro] if registro else [],
                "avisos": [] if registro else ["Campo não encontrado no CSV deste mês"],
            }
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Falha ao consultar ZIP {ano}-{mes:02d}: {e}")

    hoje = date.today()
    dados = []
    avisos = []
    for i in range(meses):
        a = hoje.year
        m = hoje.month - i
        while m <= 0:
            m += 12
            a -= 1
        if a >= 2024:
            avisos.append(f"{a}-{m:02d}: disponível apenas via CDP/ORDS (integração futura)")
            continue
        url = _url_zip(a, m)
        try:
            csv_texto = _csv_de_zip(url)
            registro = _agregar_por_campo(csv_texto, campo)
            if registro:
                dados.append(registro)
        except Exception as e:
            avisos.append(f"{a}-{m:02d}: {e}")

    dados.sort(key=lambda r: r["periodo"])
    return {"campo": campo, "meses": meses, "dados": dados, "avisos": avisos}
