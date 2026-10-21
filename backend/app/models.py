from datetime import date, datetime
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Platform(Base):
    __tablename__ = "platforms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="unknown")
    unit_type: Mapped[str] = mapped_column(String, default="unknown")
    basin: Mapped[str | None] = mapped_column(String, nullable=True)
    field: Mapped[str | None] = mapped_column(String, nullable=True)
    operator: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_to_coast_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    oil_bpd: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_mmd: Mapped[float | None] = mapped_column(Float, nullable=True)
    boed: Mapped[float | None] = mapped_column(Float, nullable=True)
    accommodation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_m3: Mapped[float | None] = mapped_column(Float, nullable=True)
    length_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_t: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    production_records = relationship("MonthlyProduction", back_populates="platform", cascade="all, delete-orphan")
    snapshots = relationship("DataSnapshot", back_populates="platform", cascade="all, delete-orphan")


class MonthlyProduction(Base):
    __tablename__ = "monthly_production"
    __table_args__ = (UniqueConstraint("platform_id", "period"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), index=True)
    period: Mapped[date] = mapped_column(Date, index=True)
    oil_bpd: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_mmd: Mapped[float | None] = mapped_column(Float, nullable=True)
    boed: Mapped[float | None] = mapped_column(Float, nullable=True)
    uptime_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    platform = relationship("Platform", back_populates="production_records")


class DataSnapshot(Base):
    __tablename__ = "data_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), index=True)
    field_name: Mapped[str] = mapped_column(String, index=True)
    old_value: Mapped[str | None] = mapped_column(String, nullable=True)
    new_value: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    platform = relationship("Platform", back_populates="snapshots")
