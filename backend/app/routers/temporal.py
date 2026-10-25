from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def _rows(db: Path, table: str) -> list[dict]:
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(f'SELECT * FROM "{table}"')]
    finally:
        con.close()


def _num(value) -> float:
    if value is None:
        return 0.0
    texto = str(value).strip().replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return 0.0


def _refino() -> dict:
    db = DATA_DIR / "refino.db"
    capacidade: dict[int, float] = {}
    carga: dict[str, dict[int, float]] = {}
    for r in _rows(db, "capacidade_refino_bruto"):
        try:
            ano = int(r.get("ANO"))
            capacidade[ano] = capacidade.get(ano, 0.0) + _num(r.get("CAPACIDADE DE REFINO"))
        except (TypeError, ValueError):
            continue
    for r in _rows(db, "carga_processada_bruto"):
        try:
            origem = r.get("ORIGEM")
            ano = int(r.get("ANO"))
            if not origem:
                continue
            carga.setdefault(origem, {})[ano] = carga.get(origem, {}).get(ano, 0.0) + _num(r.get("VOLUME DE CARGA PROCESSADA"))
        except (TypeError, ValueError):
            continue
    return {
        "capacidade_por_ano": [{"ano": a, "capacidade": v} for a, v in sorted(capacidade.items())],
        "carga_por_origem": [
            {"origem": o, "serie": [{"ano": a, "volume": v} for a, v in sorted(s.items())]}
            for o, s in carga.items()
        ],
    }


def _gas() -> dict:
    db = DATA_DIR / "gas.db"
    capacidade: dict[str, dict[int, float]] = {}
    producao: dict[str, dict[str, float]] = {}
    for r in _rows(db, "capacidade_processamento_bruto"):
        try:
            polo = r.get("POLOS PRODUTORES")
            ano = int(r.get("ANO"))
            if not polo:
                continue
            capacidade.setdefault(polo, {})[ano] = capacidade.get(polo, {}).get(ano, 0.0) + _num(r.get("CAPACIDADE DE PROCESSAMENTO1"))
        except (TypeError, ValueError):
            continue
    for r in _rows(db, "volumes_processados_bruto"):
        polo = r.get("POLOS PRODUTORES (UF)")
        produto = r.get("PRODUTO OBTIDO")
        if not polo or not produto:
            continue
        producao.setdefault(produto, {})
        producao[produto][polo] = producao[produto].get(polo, 0.0) + _num(r.get("VOLUME DE PRODUÇÃO"))
    return {
        "capacidade_por_polo": [
            {"polo": p, "serie": [{"ano": a, "capacidade": v} for a, v in sorted(s.items())]}
            for p, s in capacidade.items()
        ],
        "producao_por_produto": [{"produto": p, "por_polo": s} for p, s in producao.items()],
    }


def _logistica() -> dict:
    db = DATA_DIR / "logistica.db"
    con = sqlite3.connect(db)
    tabelas = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'logistica_%'")]
    con.close()

    por_uf: dict[str, float] = {}
    por_tipo: dict[str, float] = {}
    termos = ("capacidade armazenamento", "capacidade de armazenamento")
    for tabela in tabelas:
        for r in _rows(db, tabela):
            chaves = {k.lower(): k for k in r.keys()}
            uf = next((r[chaves[k]] for k in chaves if k == "uf"), None)
            tipo = next((r[chaves[k]] for k in chaves if k == "tipo de terminal"), None)
            total = 0.0
            for k, original in chaves.items():
                if any(t in k for t in termos):
                    total += _num(r[original])
            if uf and total:
                por_uf[uf] = por_uf.get(uf, 0.0) + total
            if tipo and total:
                por_tipo[tipo] = por_tipo.get(tipo, 0.0) + total
    return {
        "armazenagem_por_uf": [
            {"uf": u, "capacidade": v} for u, v in sorted(por_uf.items(), key=lambda x: -x[1])[:15]
        ],
        "armazenagem_por_tipo": [
            {"tipo": t, "capacidade": v} for t, v in sorted(por_tipo.items(), key=lambda x: -x[1])
        ],
    }


@router.get("/api/temporal/refino-gas-logistica")
def temporal_refino_gas_logistica():
    return JSONResponse({
        "refino": _refino(),
        "gas": _gas(),
        "logistica": _logistica(),
    })
