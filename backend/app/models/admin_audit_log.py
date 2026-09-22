import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime
from app.core.database import Base


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String(64), nullable=False, index=True)
    actor_id = Column(String(64), nullable=False, index=True)
    actor_email = Column(String(128), nullable=True)
    target_user_id = Column(String(64), nullable=True, index=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
