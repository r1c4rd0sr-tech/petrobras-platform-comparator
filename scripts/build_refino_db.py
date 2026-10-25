#!/usr/bin/env python3
"""Gera backend/data/refino.db a partir dos CSVs da ANP.

Tabelas usadas:
- tabela2-34: capacidade de refino por refinaria
- tabela2-36: carga processada por origem
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

PASTA = Path("backend/data/anp")
BANCO = Path("backend/data/refino.db")

TABELAS = {
    "capacidade_refino_bruto": "anuario-2026-dados_abertos-tabela2-34.csv",
    "carga_processada_bruto": "anuario-2026-dados_abertos-tabela2-36.csv",
}


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


def main() -> None:
    BANCO.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(BANCO)
    criar_tabelas(con)

    for tabela, nome_arquivo in TABELAS.items():
        caminho = PASTA / nome_arquivo
        if not caminho.exists():
            print(f"Aviso: arquivo não encontrado: {nome_arquivo}")
            continue
        df = pd.read_csv(caminho, sep=None, engine="python", encoding="utf-8-sig")
        df.columns = [str(c).strip() for c in df.columns]
        df.to_sql(tabela, con, if_exists="replace", index=False)
        print(f"Importado {tabela}: {len(df)} linhas de {caminho.name}")

    con.commit()
    con.close()
    print(f"Banco criado: {BANCO}")


if __name__ == "__main__":
    main()
