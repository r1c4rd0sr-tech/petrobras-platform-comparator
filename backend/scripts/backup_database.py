"""Cria uma cópia de segurança (backup) do banco SQLite de plataformas.

Uso:
    python backend/scripts/backup_database.py

O backup é salvo em backend/backups/petrobras_platforms_backup_YYYYMMDD_HHMMSS.db
"""

import sqlite3
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SOURCE_DB = BASE_DIR / "petrobras_platforms.db"
BACKUP_DIR = BASE_DIR / "backups"


def main() -> None:
    if not SOURCE_DB.exists():
        raise SystemExit(f"Banco de dados de origem não encontrado: {SOURCE_DB}")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"petrobras_platforms_backup_{timestamp}.db"

    source = sqlite3.connect(SOURCE_DB)
    destination = sqlite3.connect(backup_path)
    with destination:
        source.backup(destination)
    destination.close()
    source.close()

    print(f"Backup criado com sucesso: {backup_path}")


if __name__ == "__main__":
    main()
