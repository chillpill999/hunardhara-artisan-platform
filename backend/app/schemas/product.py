from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, computed_field


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
    idempotency_key: Optional[str] = Field(None, max_length=128, description="Client-provided idempotency key (UUID) to prevent duplicate creation on retry")

    # Optional client-submitted GI evidence (strictly validated server-side)
    gi_authorization_document_reference: Optional[str] = Field(None, description="Artisan GI authorization certificate or card number")
    gi_artisan_authorization_status: Optional[str] = Field(None, description="Requested artisan status; evaluated and guarded server-side")
    gi_product_provenance_status: Optional[str] = Field(None, description="Requested provenance status; verified server-side")
    gi_certified: Optional[bool] = Field(None, description="Legacy client parameter; overridden server-side based on evidence")


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    listing_price: Optional[float] = None
    stock_quantity: Optional[int] = None
    cost_materials: Optional[float] = None
    labor_hours: Optional[float] = None
    description_hindi: Optional[str] = None
    description_english: Optional[str] = None
    is_active: Optional[bool] = None

    # GI Verification Updates (admin or evidence review)
    gi_authorization_document_reference: Optional[str] = None
    gi_artisan_authorization_status: Optional[str] = None
    gi_product_provenance_status: Optional[str] = None
    gi_verification_source: Optional[str] = None


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
    idempotency_key: Optional[str] = None

    # Distinct GI Fields
    gi_craft_registered: bool = False
    gi_registration_name: Optional[str] = None
    gi_registration_reference: Optional[str] = None
    gi_registered_region: Optional[str] = None
    gi_artisan_authorization_status: str = "NOT_PROVIDED"
    gi_authorization_document_reference: Optional[str] = None
    gi_product_provenance_status: str = "UNVERIFIED"
    gi_verification_source: Optional[str] = None
    gi_verification_date: Optional[datetime] = None

    created_at: Optional[datetime] = None

    @computed_field
    @property
    def is_gi_certified_product(self) -> bool:
        """
        Strict Product-Level GI Certification Rule:
        A product is ONLY certified when:
        1. The craft tradition is officially GI-registered,
        2. The individual artisan has authorized GI user status,
        3. The specific product provenance has been independently verified.
        """
        return bool(
            self.gi_craft_registered and
            self.gi_artisan_authorization_status == "AUTHORIZED" and
            self.gi_product_provenance_status == "VERIFIED"
        )

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
