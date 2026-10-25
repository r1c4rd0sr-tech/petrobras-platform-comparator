# Bancos de Refino, Gás e Logística

## 1. Instalar dependências

```bash
pip install requests beautifulsoup4 pandas
```

## 2. Baixar os CSVs da ANP

```bash
python scripts/download_anp_csvs.py
```

Os arquivos serão salvos em `backend/data/anp/`.

## 3. Criar os bancos SQLite

```bash
python scripts/build_refino_db.py
python scripts/build_gas_db.py
python scripts/build_logistica_db.py
```

## Bancos gerados

| Banco | Local |
|---|---|
| Refino | `backend/data/refino.db` |
| Gás | `backend/data/gas.db` |
| Logística | `backend/data/logistica.db` |

Os scripts criam tabelas `_bruto` com o conteúdo original dos CSVs e tabelas normalizadas para consulta pela aplicação.
