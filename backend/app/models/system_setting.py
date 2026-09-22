from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(64), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
