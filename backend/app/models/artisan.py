import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Artisan(Base):
    __tablename__ = "artisans"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(128), nullable=False, index=True)
    phone_number = Column(String(20), nullable=False, unique=True, index=True)
    
    # UIDAI Sovereign Compliance: NEVER store raw Aadhaar
    masked_aadhaar = Column(String(16), nullable=False)     # "XXXXXXXX1234"
    aadhaar_hash = Column(String(64), nullable=False, unique=True, index=True)  # HMAC-SHA256
    
    # Affirmative action / demographic tracking for MoSJE
    social_category = Column(String(32), nullable=False, default="ST")  # SC, ST, OBC, General, Divyangjan
    gender = Column(String(16), nullable=True)                          # Female, Male, Other
    
    cluster_id = Column(String(64), ForeignKey("craft_clusters.id"), nullable=False, index=True)
    state = Column(String(64), nullable=False, index=True)
    district = Column(String(64), nullable=False, index=True)
    village = Column(String(128), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    primary_craft = Column(String(128), nullable=False, index=True)
    experience_years = Column(Integer, default=5)
    
    # Production capacity metrics for B2B matchmaking
    monthly_capacity_units = Column(Integer, default=50)
    daily_capacity_units = Column(Float, default=1.67)
    
    profile_photo_url = Column(String(256), nullable=True)
    voice_intro_url = Column(String(256), nullable=True)
    preferred_language = Column(String(10), default="hi")
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    cluster = relationship("CraftCluster", back_populates="artisans")
    products = relationship("Product", back_populates="artisan", cascade="all, delete-orphan")
    consent_logs = relationship("ConsentLog", back_populates="artisan", cascade="all, delete-orphan")
