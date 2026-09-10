from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class VoiceCraftAttributes(BaseModel):
    product_name: str = Field(..., description="Extracted product name", example="Bastar Dhokra Brass Horse")
    craft_type: str = Field(..., description="Recognized GI/traditional craft category", example="Bastar Dhokra")
    materials: List[str] = Field(..., description="Identified raw materials", example=["Brass", "Bell Metal", "Lost-Wax Clay"])
    dimensions: str = Field(..., description="Approximate dimensions string", example="15cm x 12cm x 6cm")
    production_time_days: float = Field(..., ge=0.1, description="Production time in days", example=4.0)
    technique: str = Field(..., description="Craft technique used", example="Lost-Wax Bell Metal Casting")
    color: str = Field(..., description="Primary finish and dominant color", example="Antique Brass Bronze")


class MarketingDescription(BaseModel):
    hi: str = Field(..., description="Devanagari Hindi marketing copywriting", example="प्राचीन 4000 वर्ष पुरानी लॉस्ट-वैक्स तकनीक से मास्टर आदिवासी कारीगरों द्वारा हस्तनिर्मित बस्तर ढोकरा पीतल का घोड़ा।")
    en: str = Field(..., description="English marketing copywriting", example="Authentic hand-cast Bastar Dhokra brass figurine sculpted by master tribal artisans using the ancient 4,000-year-old lost-wax casting technique.")


class VoiceCatalogResponse(BaseModel):
    transcript_original: str = Field(..., description="ASR transcript in spoken regional language/Hindi")
    transcript_english: str = Field(..., description="English NMT translation of spoken transcript")
    attributes: VoiceCraftAttributes
    marketing_description: MarketingDescription
    seo_tags: List[str] = Field(..., min_length=5, description="Search and catalog keywords (minimum 5 tags)")
    is_offline_mock: bool = Field(default=False, description="True if generated via deterministic offline fallback")
    warning: Optional[str] = Field(None, description="Quality warnings, e.g. LOW_AUDIO_CONFIDENCE_BACKGROUND_NOISE")
