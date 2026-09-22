import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from app.core.database import Base


class DeactivatedUser(Base):
    """
    Registry of deactivated and forgotten users under DPDP Act 2023.
    Once a user/artisan is recorded here, all further attempts to access protected resources
    using their credentials or tokens are immediately rejected with HTTP 403 ACCOUNT_DEACTIVATED.
    """
    __tablename__ = "deactivated_users"

    id = Column(String(64), primary_key=True)  # user_id or artisan_id
    reason = Column(String(256), nullable=True)
    deactivated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
