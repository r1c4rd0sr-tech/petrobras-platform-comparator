#!/usr/bin/env python3
"""Gera backend/data/logistica.db a partir dos CSVs da ANP."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

PASTA = Path("backend/data/anp")
BANCO = Path("backend/data/logistica.db")


def achar_csv(padroes: list[str]) -> Path | None:
    if not PASTA.exists():
        return None
    for arquivo in sorted(PASTA.glob("*.csv")):
        nome = arquivo.name.lower()
        if all(p in nome for p in padroes):
            return arquivo
    return None


def main() -> None:
    BANCO.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(BANCO)
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS terminais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            uf TEXT,
            regiao TEXT,
            tipo TEXT
        );
        CREATE TABLE IF NOT EXISTS capacidade_armazenagem (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            terminal TEXT NOT NULL,
            produto TEXT,
            capacidade_m3 REAL,
            data_referencia TEXT,
            UNIQUE(terminal, produto, data_referencia)
        );
        CREATE TABLE IF NOT EXISTS movimentacao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ano INTEGER NOT NULL,
            mes INTEGER,
            produto TEXT,
            tipo_movimentacao TEXT,
            volume_m3 REAL,
            UNIQUE(ano, mes, produto, tipo_movimentacao)
        );
        """
    )

    alvos = [
        (["armazen"], "capacidade_armazenagem"),
        (["moviment"], "movimentacao"),
    ]
    for padroes, tabela in alvos:
        caminho = achar_csv(padroes)
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
