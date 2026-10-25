from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def _col(row: sqlite3.Row, candidates: list[str]):
    keys = {k.lower(): k for k in row.keys()}
    for c in candidates:
        k = c.lower()
        if k in keys:
            return row[keys[k]]
    return None


def _rows(db: Path, table: str):
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    try:
        return con.execute(f'SELECT * FROM "{table}"').fetchall()
    finally:
        con.close()


def _refino():
    db = DATA_DIR / "refino.db"
    capacidade: dict[int, float] = {}
    carga: dict[str, dict[int, float]] = {}
    for r in _rows(db, "capacidade_refino_bruto"):
        ano = r["ANO"]
        cap = r["CAPACIDADE DE REFINO"]
        if ano is None or cap is None:
            continue
        capacidade[int(ano)] = capacidade.get(int(ano), 0) + float(str(cap).replace(".", "").replace(",", "."))
    for r in _rows(db, "carga_processada_bruto"):
        origem = r["ORIGEM"]
        ano = r["ANO"]
        vol = r["VOLUME DE CARGA PROCESSADA"]
        if not origem or ano is None or vol is None:
            continue
        carga.setdefault(origem, {})[int(ano)] = float(str(vol).replace(".", "").replace(",", "."))
    return {
        "capacidade_por_ano": [ {"ano": a, "capacidade": capacidade[a]} for a in sorted(capacidade) ],
        "carga_por_origem": [ {"origem": o, "serie": [ {"ano": a, "volume": v} for a, v in sorted(s.items()) ]} for o, s in carga.items() ],
    }


def _gas():
    db = DATA_DIR / "gas.db"
    capacidade: dict[str, dict[int, float]] = {}
    producao: dict[str, dict[str, float]] = {}
    for r in _rows(db, "capacidade_processamento_bruto"):
        polo = r["POLOS PRODUTORES"]
        ano = r["ANO"]
        cap = r["CAPACIDADE DE PROCESSAMENTO1"]
        if polo and ano is not None and cap is not None:
            capacidade.setdefault(polo, {})[int(ano)] = float(str(cap).replace(".", "").replace(",", "."))
    for r in _rows(db, "volumes_processados_bruto"):
        polo = r["POLOS PRODUTORES (UF)"]
        produto = r["PRODUTO OBTIDO"]
        vol = r["VOLUME DE PRODUÇÃO"]
        if polo and produto and vol is not None:
            producao.setdefault(produto, {})[polo] = producao.get(produto, {}).get(polo, 0) + float(str(vol).replace(".", "").replace(",", "."))
    return {
        "capacidade_por_polo": [ {"polo": p, "serie": [ {"ano": a, "capacidade": v} for a, v in sorted(s.items()) ]} for p, s in capacidade.items() ],
        "producao_por_produto": [ {"produto": p, "por_polo": s} for p, s in producao.items() ],
    }


def _logistica():
    db = DATA_DIR / "logistica.db"
    por_uf: dict[str, float] = {}
    por_tipo: dict[str, float] = {}
    tabelas = [r[0] for r in _rows(db, "sqlite_master") ] if False else []
    con = sqlite3.connect(db)
    tabelas = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'logistica_%'").fetchall()]
    con.close()
    for tabela in tabelas:
        for r in _rows(db, tabela):
            keys = {k.lower(): k for k in r.keys()}
            uf = r.get(keys.get("uf", "")) if "uf" in keys else None
            tipo = r.get(keys.get("tipo de terminal", "")) if "tipo de terminal" in keys else None
            caps = []
            for k in keys:
                if "capacidade armazenamento" in k:
                    try:
                        caps.append(float(str(r[keys[k]] or 0).replace(".", "").replace(",", ".")))
                    except Exception:
                        pass
            total = sum(caps)
            if uf and total:
                por_uf[uf] = por_uf.get(uf, 0) + total
            if tipo and total:
                por_tipo[tipo] = por_tipo.get(tipo, 0) + total
    return {
        "armazenagem_por_uf": [ {"uf": u, "capacidade": v} for u, v in sorted(por_uf.items(), key=lambda x: -x[1])[:15] ],
        "armazenagem_por_tipo": [ {"tipo": t, "capacidade": v} for t, v in sorted(por_tipo.items(), key=lambda x: -x[1]) ],
    }


@router.get("/api/temporal/refino-gas-logistica")
def temporal_refino_gas_logistica():
    return JSONResponse({
        "refino": _refino(),
        "gas": _gas(),
        "logistica": _logistica(),
    })
