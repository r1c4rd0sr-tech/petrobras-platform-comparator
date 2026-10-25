import sqlite3
import unicodedata
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/refino", tags=["refino"])

DB_FILE = Path(__file__).resolve().parent.parent / "data" / "refino.db"

ALIASES = {
    "replan": "replan",
    "revap": "revap",
    "rpbc": "rpbc",
    "rnest": "rnest",
    "rlam": "rlam",
    "rnest": "rnest",
}


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


@router.get("/producao")
async def producao(
    refinaria: str = Query(..., description="Nome da refinaria"),
    meses: int = Query(36, ge=1, le=36, description="Meses históricos (máx. 36)"),
):
    """Série histórica de refino por refinaria — consulta o banco SQLite (instantâneo)."""
    if not DB_FILE.exists():
        raise HTTPException(status_code=503, detail="Banco de dados de refino ainda não disponível.")
    alvo = _normalizar(refinaria)
    alvo = ALIASES.get(alvo, alvo)
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT refinaria_norm FROM refino_mensal WHERE refinaria_norm = ? OR ? LIKE '%' || refinaria_norm || '%' OR refinaria_norm LIKE '%' || ? || '%' LIMIT 1",
        (alvo, alvo, alvo),
    ).fetchone()
    if row is None:
        conn.close()
        return {
            "refinaria": refinaria,
            "meses": meses,
            "dados": [],
            "avisos": [f"Refinaria '{refinaria}' não encontrada no banco de dados."],
            "fonte": "banco_sqlite",
        }
    chave = row[0]
    rows = cur.execute(
        "SELECT periodo, refinaria, carga_m3, carga_bpd, derivados_m3 FROM refino_mensal WHERE refinaria_norm = ? ORDER BY periodo",
        (chave,),
    ).fetchall()
    conn.close()
    rows = rows[-meses:] if len(rows) > meses else rows
    return {
        "refinaria": refinaria,
        "meses": meses,
        "dados": [
            {"periodo": r[0], "refinaria": r[1], "carga_m3": r[2], "carga_bpd": r[3], "derivados_m3": r[4]}
            for r in rows
        ],
        "avisos": [],
        "fonte": "banco_sqlite",
    }


@router.get("/test")
def test_banco():
    """Endpoint de teste: confirma que o banco SQLite de refino existe e responde a consultas."""
    if not DB_FILE.exists():
        return {"status": "erro", "mensagem": f"Banco refino.db não encontrado em {DB_FILE}"}
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    total = cur.execute("SELECT COUNT(*) FROM refino_mensal").fetchone()[0]
    refinarias = cur.execute("SELECT COUNT(DISTINCT refinaria_norm) FROM refino_mensal").fetchone()[0]
    periodos = cur.execute("SELECT COUNT(DISTINCT periodo) FROM refino_mensal").fetchone()[0]
    amostra = cur.execute(
        "SELECT periodo, refinaria, carga_m3, carga_bpd, derivados_m3 FROM refino_mensal ORDER BY periodo LIMIT 5"
    ).fetchall()
    conn.close()
    return {
        "status": "ok",
        "caminho": str(DB_FILE),
        "total_registros": total,
        "refinarias_unicas": refinarias,
        "periodos_unicos": periodos,
        "amostra": [
            {"periodo": r[0], "refinaria": r[1], "carga_m3": r[2], "carga_bpd": r[3], "derivados_m3": r[4]}
            for r in amostra
        ],
    }
