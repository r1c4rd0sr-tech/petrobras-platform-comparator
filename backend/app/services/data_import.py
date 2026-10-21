import json
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import Platform

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "platforms"


def import_platforms_from_json(db: Session) -> dict:
    created = updated = 0

    for path in sorted(DATA_DIR.glob("part-*.json")):
        items = json.loads(path.read_text(encoding="utf-8"))

        for item in items:
            platform = (
                db.query(Platform)
                .filter(Platform.slug == item["slug"])
                .first()
            )

            if platform is None:
                db.add(Platform(**item))
                created += 1
            else:
                for key, value in item.items():
                    setattr(platform, key, value)
                updated += 1

    db.commit()
    return {"created": created, "updated": updated}
