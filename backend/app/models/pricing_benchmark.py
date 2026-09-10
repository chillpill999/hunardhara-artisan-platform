import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base, PortableVector


class PricingBenchmark(Base):
    __tablename__ = "pricing_benchmarks"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    cluster_id = Column(String(64), ForeignKey("craft_clusters.id"), nullable=False, index=True)
    
    craft_type = Column(String(128), nullable=False, index=True)
    item_name = Column(String(256), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    materials = Column(JSON, default=list)
    standard_labor_hours = Column(Float, nullable=False, default=8.0)
    
    # Validated market benchmark pricing
    benchmark_floor_price = Column(Float, nullable=False)
    benchmark_retail_price = Column(Float, nullable=False)
    benchmark_wholesale_price = Column(Float, nullable=False)
    
    sample_image_url = Column(String(256), nullable=True)
    
    # 768-dimensional SigLIP image embedding for pgvector cosine distance lookup
    visual_embedding = Column(PortableVector(768), nullable=True)
    
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    cluster = relationship("CraftCluster", back_populates="pricing_benchmarks")
