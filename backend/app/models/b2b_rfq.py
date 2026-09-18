import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class B2BRFQ(Base):
    __tablename__ = "b2b_rfqs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    buyer_id = Column(String(64), nullable=True, index=True)
    buyer_name = Column(String(128), nullable=False)
    buyer_organization = Column(String(128), nullable=True)
    buyer_email = Column(String(128), nullable=False)
    buyer_phone = Column(String(20), nullable=True)
    
    craft_type = Column(String(128), nullable=False, index=True)
    required_quantity = Column(Integer, nullable=False)   # e.g. 200 units
    unit_budget = Column(Float, nullable=False)          # e.g. ₹1,500/unit
    total_budget = Column(Float, nullable=False)
    deadline_days = Column(Integer, nullable=False)      # e.g. 45 days
    
    delivery_state = Column(String(64), nullable=True)
    delivery_district = Column(String(64), nullable=True)
    delivery_latitude = Column(Float, nullable=True)
    delivery_longitude = Column(Float, nullable=True)
    
    status = Column(String(32), default="OPEN", index=True)  # OPEN, MATCHED, FULFILLED, CLOSED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    matches = relationship("B2BMatchRecord", back_populates="rfq", cascade="all, delete-orphan")


class B2BMatchRecord(Base):
    __tablename__ = "b2b_match_records"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    rfq_id = Column(String(64), ForeignKey("b2b_rfqs.id"), nullable=False, index=True)
    artisan_id = Column(String(64), ForeignKey("artisans.id"), nullable=False, index=True)
    
    match_percentage = Column(Float, nullable=False)      # 0 to 100
    score_craft = Column(Float, nullable=False)          # 0 to 100 (weight 35%)
    score_price = Column(Float, nullable=False)          # 0 to 100 (weight 30%)
    score_capacity = Column(Float, nullable=False)       # 0 to 100 (weight 25%)
    score_location = Column(Float, nullable=False)       # 0 to 100 (weight 10%)
    
    capacity_feasible = Column(Boolean, nullable=False)  # boolean flag for acceptance criterion A3
    estimated_production_days = Column(Integer, nullable=False)
    quoted_unit_price = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    match_explanation = Column(Text, nullable=False)
    
    status = Column(String(32), default="PROPOSED")      # PROPOSED, ACCEPTED, REJECTED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    rfq = relationship("B2BRFQ", back_populates="matches")
    artisan = relationship("Artisan")
