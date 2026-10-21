import json
from pathlib import Path
from sqlalchemy.orm import Session
from ..models import Platform


def import_platforms_from_json(db: Session, path: str | Path = "data/platforms.json") -> dict:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    created, updated = 0, 0
    for item in payload:
        platform = db.query(Platform).filter(Platform.slug == item["slug"]).first()
        if platform is None:
            db.add(Platform(**item))
            created += 1
        else:
            for key, value in item.items():
                setattr(platform, key, value)
            updated += 1
    db.commit()
    return {"created": created, "updated": updated}
