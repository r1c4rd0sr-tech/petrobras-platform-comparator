import sqlite3
import unicodedata
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

DB_FILE = Path(__file__).resolve().parent / "data" / "producao.db"


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


def _serie_do_banco(campo: str, meses: int) -> list[dict]:
    """Busca a série no SQLite. Levanta erro se o banco não existir ou o campo não for encontrado."""
    if not DB_FILE.exists():
        raise HTTPException(status_code=503, detail="Banco de dados de produção ainda não disponível. Execute o workflow 'Gerar banco SQLite de produção (2021-2023)'.")
    alvo = _normalizar(campo)
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT campo_norm FROM producao_mensal WHERE campo_norm = ? OR ? LIKE '%' || campo_norm || '%' OR campo_norm LIKE '%' || ? || '%' LIMIT 1",
        (alvo, alvo, alvo),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Campo '{campo}' não encontrado no banco de dados.")
    chave = row[0]
    rows = cur.execute(
        "SELECT periodo, campo, oleo_bpd, gas_mmd FROM producao_mensal WHERE campo_norm = ? ORDER BY periodo",
        (chave,),
    ).fetchall()
    conn.close()
    rows = rows[-meses:] if len(rows) > meses else rows
    return [
        {"periodo": r[0], "campo": r[1], "oleo_bpd": r[2], "gas_mmd": r[3]}
        for r in rows
    ]


@router.get("/producao")
async def producao(
    campo: str = Query(..., description="Nome do campo de produção"),
    meses: int = Query(36, ge=1, le=36, description="Meses históricos (máx. 36)"),
):
    """Série histórica por campo — consulta exclusivamente o banco SQLite (instantâneo)."""
    serie = _serie_do_banco(campo, meses)
    return {"campo": campo, "meses": meses, "dados": serie, "avisos": [], "fonte": "banco_sqlite"}
