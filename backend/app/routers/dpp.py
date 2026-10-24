import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

DPP_BASE = "https://dpp-api.anp.gov.br/api"


@router.get("/producao")
async def producao(campo: str = Query(..., description="Nome do campo de produção")):
    """Proxy para a API DPP/ANP (Do Poço ao Posto) — evita bloqueio de CORS no navegador."""
    url = f"{DPP_BASE}/upstream-campo/campo/ListarProducaoPorCampo"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json={"campo": campo})
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Erro DPP ({e.response.status_code}): {e.response.text[:300]}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao consultar DPP: {e}")
