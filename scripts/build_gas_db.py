#!/usr/bin/env python3
"""Gera backend/data/gas.db a partir dos CSVs da ANP.

Tabelas usadas:
- tabela2-39: capacidade de processamento de gás natural por polo
- tabela2-41: volumes processados e produção de derivados
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

PASTA = Path("backend/data/anp")
BANCO = Path("backend/data/gas.db")

TABELAS = {
    "capacidade_processamento_bruto": "anuario-2026-dados_abertos-tabela2-39.csv",
    "volumes_processados_bruto": "anuario-2026-dados_abertos-tabela2-41.csv",
}


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
