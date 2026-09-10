import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class CraftCluster(Base):
    __tablename__ = "craft_clusters"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(128), nullable=False, unique=True, index=True)
    craft_name = Column(String(128), nullable=False, index=True)
    state = Column(String(64), nullable=False, index=True)
    district = Column(String(64), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # MoSJE / Ministry of Labour Statutory Skilled Craftsman Wage Rates
    statutory_hourly_wage = Column(Float, nullable=False)  # in INR, e.g. 60.0
    statutory_daily_wage = Column(Float, nullable=False)   # 8-hr standard day, e.g. 480.0
    
    gi_tag_status = Column(String(128), nullable=False)    # e.g. "Registered (GI-99)"
    gi_tag_number = Column(String(32), nullable=True)      # e.g. "GI-99"
    
    materials = Column(JSON, default=list)                 # List of primary raw materials
    techniques = Column(JSON, default=list)                # List of traditional techniques
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    artisans = relationship("Artisan", back_populates="cluster", cascade="all, delete-orphan")
    pricing_benchmarks = relationship("PricingBenchmark", back_populates="cluster", cascade="all, delete-orphan")
