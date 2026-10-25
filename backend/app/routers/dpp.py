import sqlite3
import unicodedata
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/dpp", tags=["dpp"])

DB_FILE = Path(__file__).resolve().parent.parent / "data" / "producao.db"

# Mapeamento de apelidos: nomes antigos -> nomes atuais no banco
ALIASES = {
    "lula": "tupi",
    "santos": "tupi",
    "tambu": "tambu",
}


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return sem_acento.strip().casefold()


@router.get("/producao")
async def producao(
    campo: str = Query(..., description="Nome do campo de produção"),
    meses: int = Query(36, ge=1, le=36, description="Meses históricos (máx. 36)"),
):
    """Série histórica por campo — consulta o banco SQLite (instantâneo)."""
    if not DB_FILE.exists():
        raise HTTPException(status_code=503, detail="Banco de dados de produção ainda não disponível.")
    alvo = _normalizar(campo)
    # Aplica apelido se existir (ex.: Lula -> Tupi)
    alvo = ALIASES.get(alvo, alvo)
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT campo_norm FROM producao_mensal WHERE campo_norm = ? OR ? LIKE '%' || campo_norm || '%' OR campo_norm LIKE '%' || ? || '%' LIMIT 1",
        (alvo, alvo, alvo),
    ).fetchone()
    if row is None:
        conn.close()
        # Fallback: retorna 200 com lista vazia em vez de 404 (não quebra o frontend)
        return {
            "campo": campo,
            "meses": meses,
            "dados": [],
            "avisos": [f"Campo '{campo}' não encontrado no banco de dados."],
            "fonte": "banco_sqlite",
        }
    chave = row[0]
    rows = cur.execute(
        "SELECT periodo, campo, oleo_bpd, gas_mmd FROM producao_mensal WHERE campo_norm = ? ORDER BY periodo",
        (chave,),
    ).fetchall()
    conn.close()
    rows = rows[-meses:] if len(rows) > meses else rows
    return {
        "campo": campo,
        "meses": meses,
        "dados": [
            {"periodo": r[0], "campo": r[1], "oleo_bpd": r[2], "gas_mmd": r[3]}
            for r in rows
        ],
        "avisos": [],
        "fonte": "banco_sqlite",
    }


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
