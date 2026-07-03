from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CoreMetrics(Base):
    __tablename__ = "core_metrics"

    enterprise_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enterprise_name: Mapped[str] = mapped_column(String(200))
    industry_l1: Mapped[str] = mapped_column(String(50))
    industry_l2: Mapped[str] = mapped_column(String(50))
    province: Mapped[str] = mapped_column(String(50))
    city: Mapped[str] = mapped_column(String(50))
    credit_level: Mapped[str] = mapped_column(String(1))
    credit_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    tax_on_time_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    tax_arrears_cnt: Mapped[int] = mapped_column(Integer)
    tax_violation_cnt: Mapped[int] = mapped_column(Integer)
    high_severity_cnt: Mapped[int] = mapped_column(Integer)
    is_dishonesty: Mapped[bool] = mapped_column(Boolean)
    is_execution: Mapped[bool] = mapped_column(Boolean)
    vat_revenue: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    public_revenue: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    revenue_deviation: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    invoice_monthly_avg: Mapped[int] = mapped_column(Integer)
    social_trend: Mapped[str] = mapped_column(String(10))
    market_cap: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    pe_ratio: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    revenue_yoy: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    profit_yoy: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    roe: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    debt_ratio: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    z_score: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    z_score_level: Mapped[str] = mapped_column(String(10))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LegalEvent(Base):
    __tablename__ = "legal_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    enterprise_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(1), nullable=False)
    amount_involved: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
