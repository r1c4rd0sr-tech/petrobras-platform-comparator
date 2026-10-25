#!/usr/bin/env python3
"""Gera backend/data/gas.db a partir dos CSVs da ANP."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

PASTA = Path("backend/data/anp")
BANCO = Path("backend/data/gas.db")


def achar_csv(padrao: str) -> Path | None:
    if not PASTA.exists():
        return None
    for arquivo in sorted(PASTA.glob("*.csv")):
        if padrao.lower() in arquivo.name.lower():
            return arquivo
    return None


def main() -> None:
    BANCO.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(BANCO)
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS polos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS capacidade_processamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            polo TEXT NOT NULL,
            ano INTEGER NOT NULL,
            capacidade_m3_dia REAL,
            UNIQUE(polo, ano)
        );
        CREATE TABLE IF NOT EXISTS volumes_processados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            polo TEXT NOT NULL,
            ano INTEGER NOT NULL,
            volume_m3 REAL,
            UNIQUE(polo, ano)
        );
        CREATE TABLE IF NOT EXISTS producao_derivados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            polo TEXT NOT NULL,
            ano INTEGER NOT NULL,
            produto TEXT NOT NULL,
            volume_m3 REAL,
            UNIQUE(polo, ano, produto)
        );
        """
    )

    for padrao, tabela in [
        ("capacidade", "capacidade_processamento"),
        ("processado", "volumes_processados"),
        ("producao", "producao_derivados"),
    ]:
        caminho = achar_csv(padrao)
        if caminho:
            df = pd.read_csv(caminho, sep=None, engine="python", encoding="utf-8-sig")
            df.columns = [str(c).strip() for c in df.columns]
            df.to_sql(tabela + "_bruto", con, if_exists="replace", index=False)
            print(f"Importado {tabela}_bruto: {len(df)} linhas de {caminho.name}")
        else:
            print(f"Aviso: CSV para {tabela} não encontrado.")

    con.commit()
    con.close()
    print(f"Banco criado: {BANCO}")


if __name__ == "__main__":
    main()
