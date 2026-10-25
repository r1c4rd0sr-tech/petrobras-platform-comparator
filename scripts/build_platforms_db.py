"""Gera o banco SQLite de plataformas a partir dos JSONs em backend/data/platforms."""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "backend" / "data" / "platforms"
DB_PATH = ROOT / "backend" / "app" / "data" / "petrobras_platforms.db"

COLUMNS = [
    "id", "slug", "name", "status", "unit_type", "basin", "field", "operator",
    "latitude", "longitude", "water_depth_m", "distance_to_coast_km", "year",
    "service_life_years", "oil_bpd", "gas_mmd", "boed", "water_injection_bpd",
    "storage_bbl", "accommodation", "length_m", "width_m", "weight_t",
    "location", "notes", "source_url", "data_version", "updated_at",
]

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
if DB_PATH.exists():
    DB_PATH.unlink()

conn = sqlite3.connect(DB_PATH)
cols_sql = ",\n  ".join(
    ["id INTEGER PRIMARY KEY"] + [f"{c} TEXT" for c in COLUMNS[1:-1]] + ["updated_at TEXT"]
)
conn.execute(f"CREATE TABLE platforms (\n  {cols_sql}\n)")

inserted = 0
for json_file in sorted(DATA_DIR.glob("*.json")):
    with open(json_file, encoding="utf-8") as f:
        records = json.load(f)
    for record in records:
        row = {c: record.get(c) for c in COLUMNS}
        row["updated_at"] = row["updated_at"] or datetime.now(timezone.utc).isoformat()
        placeholders = ", ".join("?" for _ in COLUMNS)
        conn.execute(
            f"INSERT INTO platforms ({', '.join(COLUMNS)}) VALUES ({placeholders})",
            [row[c] for c in COLUMNS],
        )
        inserted += 1

conn.commit()
count = conn.execute("SELECT COUNT(*) FROM platforms").fetchone()[0]
conn.close()
print(f"Banco gerado em {DB_PATH} com {count} plataformas ({inserted} inseridas).")
