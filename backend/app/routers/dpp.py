import csv
import io
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

# Dados abertos da ANP — produção de petróleo e gás por campo (CSV mensal)
DADOS_ABERTOS_BASE = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/"
    "arquivos/arquivos-producao-de-petroleo-e-gas"
)


def _csv_url(ano: int, mes: int) -> str:
    return f"{DADOS_ABERTOS_BASE}/producao-petroleo-gas-campos-{ano}-{mes:02d}.csv"


def _parse_float(value: str) -> float:
    if not value:
        return 0.0
    return float(str(value).replace(".", "").replace(",", "."))


@router.get("/producao")
async def producao(
    campo: str = Query(..., description="Nome do campo de produção"),
    meses: int = Query(12, ge=1, le=36, description="Quantidade de meses históricos"),
):
    """Série histórica mensal de produção por campo, a partir dos dados abertos da ANP."""
    hoje = date.today()
    resultados = []
    avisos = []
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for i in range(meses):
            # Retrocede mês a mês
            ano = hoje.year
            mes = hoje.month - i
            while mes <= 0:
                mes += 12
                ano -= 1
            url = _csv_url(ano, mes)
            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    avisos.append(f"{ano}-{mes:02d}: HTTP {resp.status_code}")
                    continue
                texto = resp.content.decode("utf-8-sig", errors="replace")
                leitor = csv.DictReader(io.StringIO(texto))
                for linha in leitor:
                    nome_campo = (linha.get("Campo") or linha.get("CAMPO") or "").strip()
                    if nome_campo.lower() != campo.strip().lower():
                        continue
                    periodo = (linha.get("Período") or linha.get("Periodo") or linha.get("PERÍODO") or f"{ano}-{mes:02d}")
                    oleo = _parse_float(linha.get("Óleo (bbl/dia)") or linha.get("Oleo (bbl/dia)") or "0")
                    gas = _parse_float(linha.get("Gás (10^6 m3/dia)") or linha.get("Gas (10^6 m3/dia)") or "0")
                    resultados.append({
                        "periodo": periodo,
                        "campo": nome_campo,
                        "oleo_bpd": oleo,
                        "gas_mmd": gas,
                    })
            except Exception as e:
                avisos.append(f"{ano}-{mes:02d}: {e}")

    resultados.sort(key=lambda r: r["periodo"])
    return {"campo": campo, "meses": meses, "dados": resultados, "avisos": avisos}
