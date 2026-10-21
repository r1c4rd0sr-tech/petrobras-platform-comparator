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
    water_depth_m: float | None = None
    distance_to_coast_km: float | None = None
    year: int | None = None
    service_life_years: float | None = None
    oil_bpd: float | None = None
    gas_mmd: float | None = None
    boed: float | None = None
    water_injection_bpd: float | None = None
    storage_bbl: float | None = None
    accommodation: int | None = None
    length_m: float | None = None
    width_m: float | None = None
    weight_t: float | None = None
    location: str | None = None
    notes: str | None = None
    source_url: str | None = None
    data_version: str | None = None


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
    water_injection_bpd: float | None = None
    uptime_percent: float | None = None
    source_url: str | None = None


class MonthlyProductionRead(MonthlyProductionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform_id: int
