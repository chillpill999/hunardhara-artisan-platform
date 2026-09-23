import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text
from app.core.database import Base


class ArtisanInquiry(Base):
    __tablename__ = "artisan_inquiries"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(64), nullable=True)
    product_title = Column(String(256), nullable=False)
    product_image = Column(Text, nullable=True)
    artisan_id = Column(String(64), nullable=True, index=True)
    artisan_name = Column(String(256), nullable=True)
    customer_name = Column(String(256), nullable=False)
    customer_phone = Column(String(64), nullable=True)
    customer_email = Column(String(256), nullable=True)
    inquiry_type = Column(String(64), default="general", nullable=False)
    message = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=True)
    status = Column(String(32), default="new", nullable=False)  # new, replied, closed
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
