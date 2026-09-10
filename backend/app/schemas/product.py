from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProductDimensions(BaseModel):
    length: float = Field(default=0.0, example=18.0)
    width: float = Field(default=0.0, example=8.0)
    height: float = Field(default=0.0, example=15.0)
    unit: str = Field(default="cm", example="cm")


class ProductBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=256, example="Bastar Handcrafted Dhokra Brass Bull Figurine")
    craft_type: str = Field(..., example="Bastar Dhokra")
    materials: List[str] = Field(default_factory=list, example=["Brass Scrap", "Natural Beeswax", "River Clay"])
    dimensions: ProductDimensions = Field(default_factory=ProductDimensions)
    production_time_hours: float = Field(default=8.0, ge=0.5, example=24.0)
    technique: str = Field(..., example="Lost-wax bell metal casting (Cire perdue)")
    dominant_colors: List[str] = Field(default_factory=list, example=["Antique Golden Brass", "Earth Patina"])
    
    # Pricing Breakdown
    cost_materials: float = Field(..., ge=0.0, example=350.0)
    labor_hours: float = Field(..., ge=0.5, example=24.0)
    hourly_wage_rate: Optional[float] = Field(default=50.0, example=50.0)
    
    listing_price: float = Field(..., ge=0.0, example=2850.0)
    stock_quantity: int = Field(default=1, ge=0, example=5)
    
    # Story & Content
    description_hindi: Optional[str] = None
    description_english: Optional[str] = None
    seo_tags_hindi: List[str] = Field(default_factory=list)
    seo_tags_english: List[str] = Field(default_factory=list)


class ProductCreate(ProductBase):
    artisan_id: str = Field(..., example="artisan-uuid")
    cluster_id: str = Field(..., example="cluster-bastar-dhokra")
    raw_photo_url: Optional[str] = None
    studio_image_url: Optional[str] = None
    before_after_preview_url: Optional[str] = None
    raw_audio_url: Optional[str] = None
    transcription_regional: Optional[str] = None
    transcription_english: Optional[str] = None


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    listing_price: Optional[float] = None
    stock_quantity: Optional[int] = None
    description_hindi: Optional[str] = None
    description_english: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: str
    artisan_id: str
    cluster_id: str
    raw_photo_url: Optional[str] = None
    studio_image_url: Optional[str] = None
    before_after_preview_url: Optional[str] = None
    floor_price: float
    recommended_retail_price: float
    wholesale_b2b_price: float
    is_active: bool
    qr_passport_id: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductFilter(BaseModel):
    craft_type: Optional[str] = None
    state: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    cluster_id: Optional[str] = None
    search_query: Optional[str] = None
    limit: int = 20
    offset: int = 0
