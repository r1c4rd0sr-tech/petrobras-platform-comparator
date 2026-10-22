import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import MonthlyProduction, Platform
from ..schemas import MonthlyProductionCreate, MonthlyProductionRead, PlatformCreate, PlatformRead

router = APIRouter(prefix="/api/platforms", tags=["platforms"])


@router.get("", response_model=list[PlatformRead])
def list_platforms(search: str | None = None, status: str | None = None, basin: str | None = None, operator: str | None = None, min_oil_bpd: float | None = Query(default=None, alias="oilMin"), min_gas_mmd: float | None = Query(default=None, alias="gasMin"), db: Session = Depends(get_db)):
    query = db.query(Platform)
    if search:
        term = f"%{search.lower()}%"
        query = query.filter(or_(Platform.name.ilike(term), Platform.field.ilike(term), Platform.basin.ilike(term)))
    if status:
        query = query.filter(Platform.status == status)
    if basin:
        query = query.filter(Platform.basin == basin)
    if operator:
        query = query.filter(Platform.operator == operator)
    if min_oil_bpd is not None:
        query = query.filter(Platform.oil_bpd >= min_oil_bpd)
    if min_gas_mmd is not None:
        query = query.filter(Platform.gas_mmd >= min_gas_mmd)
    return query.order_by(Platform.name).all()


@router.get("/export.csv")
def export_platforms_csv(db: Session = Depends(get_db)):
    platforms = db.query(Platform).order_by(Platform.name).all()
    output = io.StringIO()
    writer = csv.writer(output)
    columns = [c.name for c in Platform.__table__.columns]
    writer.writerow(columns)
    for platform in platforms:
        writer.writerow([getattr(platform, column) for column in columns])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plataformas_petrobras.csv"},
    )


@router.post("", response_model=PlatformRead, status_code=201)
def create_platform(payload: PlatformCreate, db: Session = Depends(get_db)):
    if db.query(Platform).filter(Platform.slug == payload.slug).first():
        raise HTTPException(status_code=409, detail="Platform slug already exists")
    platform = Platform(**payload.model_dump())
    db.add(platform)
    db.commit()
    db.refresh(platform)
    return platform


@router.get("/{slug}", response_model=PlatformRead)
def get_platform(slug: str, db: Session = Depends(get_db)):
    platform = db.query(Platform).filter(Platform.slug == slug).first()
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    return platform


@router.get("/{slug}/production", response_model=list[MonthlyProductionRead])
def get_production_history(slug: str, db: Session = Depends(get_db)):
    platform = db.query(Platform).filter(Platform.slug == slug).first()
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    return db.query(MonthlyProduction).filter(MonthlyProduction.platform_id == platform.id).order_by(MonthlyProduction.period).all()


@router.post("/{slug}/production", response_model=MonthlyProductionRead, status_code=201)
def add_production_record(slug: str, payload: MonthlyProductionCreate, db: Session = Depends(get_db)):
    platform = db.query(Platform).filter(Platform.slug == slug).first()
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    record = MonthlyProduction(platform_id=platform.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
