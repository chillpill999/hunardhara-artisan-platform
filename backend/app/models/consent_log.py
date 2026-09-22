import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ConsentLog(Base):
    """
    DPDP Act 2023 (Digital Personal Data Protection Act) Sovereign Consent Ledger.
    Tracks all explicit notices, audio consent artifacts, visual consent interactions,
    and sovereign data erasure requests.
    """
    __tablename__ = "dpdp_consent_logs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    artisan_id = Column(String(64), ForeignKey("artisans.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    
    consent_type = Column(String(64), nullable=False, index=True)
    # Types: DATA_COLLECTION, VOICE_RECORDING, CATALOG_LISTING, AADHAAR_VAULT, RIGHT_TO_BE_FORGOTTEN
    
    granted = Column(Boolean, nullable=False, default=True)
    purpose = Column(String(256), nullable=False)
    language = Column(String(10), default="hi")
    
    # Artifact proving affirmative consent (visual touch acknowledgment or voice hash)
    consent_artifact_type = Column(String(32), default="VISUAL_TOUCH")  # VISUAL_TOUCH, VOICE_RECORDING, OTP
    consent_artifact_hash = Column(String(64), nullable=True)
    
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)
    
    revoked_at = Column(DateTime, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    artisan = relationship("Artisan", back_populates="consent_logs")
