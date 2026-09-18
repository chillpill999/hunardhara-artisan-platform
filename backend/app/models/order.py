import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = Column(String(64), unique=True, nullable=False, index=True)
    customer_id = Column(String(64), nullable=False, index=True)
    artisan_id = Column(String(64), nullable=False, index=True)
    product_id = Column(String(64), nullable=False, index=True)
    product_title = Column(String(256), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    total_price = Column(Float, nullable=False)
    status = Column(String(32), default="pending", nullable=False)  # pending, paid, confirmed, processing, shipped, delivered, cancelled
    payment_status = Column(String(32), default="unpaid", nullable=False)  # unpaid, paid, refunded
    payment_id = Column(String(128), nullable=True)
    payment_provider = Column(String(64), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
