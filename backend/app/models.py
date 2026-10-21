from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Platform(Base):
    __tablename__ = "platforms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="unknown", index=True)
    unit_type: Mapped[str] = mapped_column(String, default="unknown", index=True)
    basin: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    field: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    operator: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_depth_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_to_coast_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    service_life_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    oil_bpd: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_mmd: Mapped[float | None] = mapped_column(Float, nullable=True)
    boed: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_injection_bpd: Mapped[float | None] = mapped_column(Float, nullable=True)
    storage_bbl: Mapped[float | None] = mapped_column(Float, nullable=True)
    accommodation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    length_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    width_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_t: Mapped[float | None] = mapped_column(Float, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    data_version: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    production_records: Mapped[list["MonthlyProduction"]] = relationship(
        back_populates="platform",
        cascade="all, delete-orphan",
    )
    snapshots: Mapped[list["DataSnapshot"]] = relationship(
        back_populates="platform",
        cascade="all, delete-orphan",
    )


class MonthlyProduction(Base):
    __tablename__ = "monthly_production"
    __table_args__ = (UniqueConstraint("platform_id", "period"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), index=True)
    period: Mapped[date] = mapped_column(Date, index=True)
    oil_bpd: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_mmd: Mapped[float | None] = mapped_column(Float, nullable=True)
    boed: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_injection_bpd: Mapped[float | None] = mapped_column(Float, nullable=True)
    uptime_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)

    platform: Mapped[Platform] = relationship(back_populates="production_records")


class DataSnapshot(Base):
    __tablename__ = "data_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), index=True)
    field_name: Mapped[str] = mapped_column(String, index=True)
    old_value: Mapped[str | None] = mapped_column(String, nullable=True)
    new_value: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    platform: Mapped[Platform] = relationship(back_populates="snapshots")
