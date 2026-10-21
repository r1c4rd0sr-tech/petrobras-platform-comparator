from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class PlatformBase(BaseModel):
    slug: str
    name: str
    status: str = "unknown"
    unit_type: str = "unknown"
    basin: str | None = None
    field: str | None = None
    operator: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    distance_to_coast_km: float | None = None
    year: int | None = None
    oil_bpd: float | None = None
    gas_mmd: float | None = None
    boed: float | None = None
    accommodation: int | None = None
    storage_m3: float | None = None
    length_m: float | None = None
    weight_t: float | None = None
    source_url: str | None = None


class PlatformCreate(PlatformBase):
    pass


class PlatformRead(PlatformBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    updated_at: datetime


class MonthlyProductionCreate(BaseModel):
    period: date
    oil_bpd: float | None = None
    gas_mmd: float | None = None
    boed: float | None = None
    uptime_percent: float | None = None
    source_url: str | None = None


class MonthlyProductionRead(MonthlyProductionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    platform_id: int
