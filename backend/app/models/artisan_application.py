import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from app.core.database import Base


class ArtisanApplication(Base):
    __tablename__ = "artisan_applications"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), nullable=False, index=True)
    craft_category = Column(String(128), nullable=False)
    experience_years = Column(Integer, default=1)
    state = Column(String(64), nullable=True)
    district = Column(String(64), nullable=True)
    status = Column(String(32), default="pending", nullable=False)  # pending, approved, rejected
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
