import sqlite3
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

# Correção: sobe dois níveis (routers/ -> app/) para encontrar backend/app/data/producao.db
DB_FILE = Path(__file__).resolve().parent.parent / "data" / "producao.db"


@router.get("/test")
def test_banco():
    """Endpoint de teste: confirma que o banco SQLite existe e responde a consultas."""
    if not DB_FILE.exists():
        return {"status": "erro", "mensagem": f"Banco producao.db não encontrado em {DB_FILE}"}
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    total = cur.execute("SELECT COUNT(*) FROM producao_mensal").fetchone()[0]
    campos = cur.execute("SELECT COUNT(DISTINCT campo_norm) FROM producao_mensal").fetchone()[0]
    periodos = cur.execute("SELECT COUNT(DISTINCT periodo) FROM producao_mensal").fetchone()[0]
    amostra = cur.execute(
        "SELECT periodo, campo, oleo_bpd, gas_mmd FROM producao_mensal ORDER BY periodo LIMIT 5"
    ).fetchall()
    conn.close()
    return {
        "status": "ok",
        "caminho": str(DB_FILE),
        "total_registros": total,
        "campos_unicos": campos,
        "periodos_unicos": periodos,
        "amostra": [
            {"periodo": r[0], "campo": r[1], "oleo_bpd": r[2], "gas_mmd": r[3]}
            for r in amostra
        ],
    }
