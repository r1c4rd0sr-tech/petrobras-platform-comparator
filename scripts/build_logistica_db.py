#!/usr/bin/env python3
"""Gera backend/data/logistica.db a partir dos CSVs da ANP.

Importa automaticamente os CSVs cujo conteúdo contenha termos de
armazenagem ou movimentação de derivados.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

PASTA = Path("backend/data/anp")
BANCO = Path("backend/data/logistica.db")

TERMOS = ("armazenagem", "armazenamento", "movimentação", "movimentacao", "terminal")


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

    importados = 0
    if PASTA.exists():
        for caminho in sorted(PASTA.glob("*.csv")):
            try:
                df = pd.read_csv(caminho, sep=None, engine="python", encoding="utf-8-sig", nrows=50)
            except Exception:
                continue
            texto = " ".join(map(str, df.columns)).lower()
            try:
                texto += " " + df.head(20).astype(str).apply(" ".join, axis=1).str.cat(sep=" ").lower()
            except Exception:
                pass
            if not any(termo in texto for termo in TERMOS):
                continue
            nome_tabela = "logistica_" + caminho.stem.replace("-", "_").lower()
            df_full = pd.read_csv(caminho, sep=None, engine="python", encoding="utf-8-sig")
            df_full.columns = [str(c).strip() for c in df_full.columns]
            df_full.to_sql(nome_tabela, con, if_exists="replace", index=False)
            print(f"Importado {nome_tabela}: {len(df_full)} linhas de {caminho.name}")
            importados += 1

    if importados == 0:
        print("Aviso: nenhum CSV de logística identificado.")

    con.commit()
    con.close()
    print(f"Banco criado: {BANCO}")


if __name__ == "__main__":
    main()
