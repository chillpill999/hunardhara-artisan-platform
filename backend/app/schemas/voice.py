from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class VoiceCraftAttributes(BaseModel):
    product_name: Optional[str] = Field(None, description="Extracted product name or null if unknown")
    craft_type: Optional[str] = Field(None, description="Recognized GI/traditional craft category or null if unknown")
    materials: List[str] = Field(default_factory=list, description="Identified raw materials")
    dimensions: Optional[str] = Field(None, description="Approximate dimensions string or null if unstated")
    production_time_days: Optional[float] = Field(None, description="Production time in days or null if unstated")
    technique: Optional[str] = Field(None, description="Craft technique used or null if unstated")
    color: Optional[str] = Field(None, description="Primary finish and dominant color or null if unstated")


class MarketingDescription(BaseModel):
    hi: str = Field(..., description="Devanagari Hindi marketing copywriting")
    en: str = Field(..., description="English marketing copywriting")


class VoiceCatalogResponse(BaseModel):
    transcript_original: str = Field(..., description="ASR transcript in spoken regional language/Hindi")
    transcript_english: str = Field(..., description="English NMT translation of spoken transcript")
    attributes: VoiceCraftAttributes
    marketing_description: MarketingDescription
    seo_tags: List[str] = Field(default_factory=list, description="Search and catalog keywords")
    is_offline_mock: bool = Field(default=False, description="True if generated via deterministic offline fallback")
    warning: Optional[str] = Field(None, description="Quality warnings, e.g. LOW_AUDIO_CONFIDENCE_BACKGROUND_NOISE")
