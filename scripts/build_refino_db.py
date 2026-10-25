#!/usr/bin/env python3
"""Gera backend/data/refino.db a partir dos CSVs da ANP."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

PASTA = Path("backend/data/anp")
BANCO = Path("backend/data/refino.db")


def achar_csv(padrao: str) -> Path | None:
    if not PASTA.exists():
        return None
    for arquivo in sorted(PASTA.glob("*.csv")):
        if padrao.lower() in arquivo.name.lower():
            return arquivo
    return None


def criar_tabelas(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS refinarias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            uf TEXT,
            regiao TEXT
        );
        CREATE TABLE IF NOT EXISTS capacidade_refino (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            refinaria TEXT NOT NULL,
            ano INTEGER NOT NULL,
            capacidade_bbl_dia REAL,
            UNIQUE(refinaria, ano)
        );
        CREATE TABLE IF NOT EXISTS carga_processada (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            refinaria TEXT NOT NULL,
            ano INTEGER NOT NULL,
            origem TEXT,
            volume_m3 REAL,
            UNIQUE(refinaria, ano, origem)
        );
        """
    )


def importar_csv(con: sqlite3.Connection, caminho: Path | None, tabela: str) -> None:
    if not caminho:
        print(f"Aviso: CSV para {tabela} não encontrado.")
        return
    df = pd.read_csv(caminho, sep=None, engine="python", encoding="utf-8-sig")
    df.columns = [str(c).strip() for c in df.columns]
    df.to_sql(tabela + "_bruto", con, if_exists="replace", index=False)
    print(f"Importado {tabela}_bruto: {len(df)} linhas de {caminho.name}")


def main() -> None:
    BANCO.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(BANCO)
    criar_tabelas(con)
    importar_csv(con, achar_csv("capacidade"), "capacidade_refino")
    importar_csv(con, achar_csv("carga"), "carga_processada")
    con.commit()
    con.close()
    print(f"Banco criado: {BANCO}")


if __name__ == "__main__":
    main()
