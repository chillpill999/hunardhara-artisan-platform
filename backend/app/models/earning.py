import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime
from app.core.database import Base


class ArtisanEarning(Base):
    __tablename__ = "artisan_earnings"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    artisan_id = Column(String(64), nullable=False, index=True)
    order_id = Column(String(64), nullable=False)
    order_type = Column(String(32), default="D2C Retail")
    product_title = Column(String(256), nullable=False)
    quantity = Column(Integer, default=1)
    gross_amount = Column(Float, nullable=False, default=0.0)
    materials_cost = Column(Float, nullable=False, default=0.0)
    artisan_wage_payout = Column(Float, nullable=False, default=0.0)
    middleman_saved = Column(Float, nullable=False, default=0.0)
    status = Column(String(32), default="PAID")
    payout_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
