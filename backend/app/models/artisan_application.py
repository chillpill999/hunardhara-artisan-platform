import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text
from app.core.database import Base


class ArtisanApplication(Base):
    __tablename__ = "artisan_applications"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), nullable=False, index=True)
    full_name = Column(String(128), nullable=True)
    phone = Column(String(32), nullable=True)
    craft_category = Column(String(128), nullable=False)
    experience_years = Column(Integer, default=1)
    state = Column(String(64), nullable=True)
    district = Column(String(64), nullable=True)
    workshop_info = Column(Text, nullable=True)
    craft_description = Column(Text, nullable=True)
    sample_images = Column(Text, nullable=True)
    document_references = Column(Text, nullable=True)
    status = Column(String(32), default="pending", nullable=False)  # pending, approved, rejected
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(64), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
