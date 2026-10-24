import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/data", tags=["data"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

@router.get("/{name}")
def get_data(name: str):
    file_path = DATA_DIR / f"{name}.json"
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Dataset não encontrado")
    with open(file_path, encoding="utf-8") as f:
        return json.load(f)
