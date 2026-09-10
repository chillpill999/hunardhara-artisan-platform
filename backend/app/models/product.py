import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base, PortableVector


class Product(Base):
    __tablename__ = "products"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    artisan_id = Column(String(64), ForeignKey("artisans.id"), nullable=False, index=True)
    cluster_id = Column(String(64), ForeignKey("craft_clusters.id"), nullable=False, index=True)
    
    title = Column(String(256), nullable=False, index=True)
    craft_type = Column(String(128), nullable=False, index=True)
    materials = Column(JSON, default=list)
    dimensions = Column(JSON, default=dict)  # {"length": float, "width": float, "height": float, "unit": "cm"}
    production_time_hours = Column(Float, nullable=False, default=8.0)
    technique = Column(String(128), nullable=False)
    dominant_colors = Column(JSON, default=list)
    
    # Image Studio Artifacts
    raw_photo_url = Column(String(256), nullable=True)
    studio_image_url = Column(String(256), nullable=True)
    before_after_preview_url = Column(String(256), nullable=True)
    
    # Voice-to-Catalog Artifacts
    raw_audio_url = Column(String(256), nullable=True)
    transcription_regional = Column(Text, nullable=True)
    transcription_english = Column(Text, nullable=True)
    description_hindi = Column(Text, nullable=True)
    description_english = Column(Text, nullable=True)
    seo_tags_hindi = Column(JSON, default=list)
    seo_tags_english = Column(JSON, default=list)
    
    # Smart Pricing Breakdown
    cost_materials = Column(Float, nullable=False, default=0.0)
    labor_hours = Column(Float, nullable=False, default=8.0)
    hourly_wage_rate = Column(Float, nullable=False, default=50.0)
    
    # Non-negotiable Anti-Exploitation Floor
    floor_price = Column(Float, nullable=False)
    recommended_retail_price = Column(Float, nullable=False)
    wholesale_b2b_price = Column(Float, nullable=False)
    
    # Actual Marketplace Listing Price (Enforced: listing_price >= floor_price)
    listing_price = Column(Float, nullable=False)
    
    # Visual Embedding (768-dim SigLIP embedding for vector similarity search)
    visual_embedding = Column(PortableVector(768), nullable=True)
    
    stock_quantity = Column(Integer, default=5)
    is_active = Column(Boolean, default=True)
    qr_passport_id = Column(String(64), nullable=True, unique=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    artisan = relationship("Artisan", back_populates="products")
    cluster = relationship("CraftCluster")
