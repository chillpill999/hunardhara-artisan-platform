from typing import List, Optional
from pydantic import BaseModel, Field


class ImageUnderstandingResponse(BaseModel):
    success: bool = Field(True, description="Status of image recognition and catalog extraction")
    error: Optional[str] = Field(None, description="Error explanation if vision inspection failed")
    craft_type: Optional[str] = Field(None, description="Identified Indian traditional craft form")
    product_name_hi: Optional[str] = Field(None, description="Authentic Hindi product name in Devanagari script")
    product_name_en: Optional[str] = Field(None, description="English product name")
    materials: List[str] = Field(default_factory=list, description="Detected craft raw materials")
    technique: Optional[str] = Field(None, description="Traditional artisanal manufacturing technique")
    dominant_colors: List[str] = Field(default_factory=list, description="Primary visual color palette")
    estimated_dimensions: Optional[str] = Field(None, description="Estimated physical dimensions")
    estimated_production_days: Optional[float] = Field(None, description="Artisan labor days required")
    suggested_retail_price: Optional[float] = Field(None, description="Fair market valuation in INR")
    description_hi: Optional[str] = Field(None, description="Engaging marketing description in Hindi")
    description_en: Optional[str] = Field(None, description="Engaging marketing description in English")
    artisan_heritage_notes: Optional[str] = Field(None, description="Cultural significance and cluster heritage")
    visual_quality_score: Optional[float] = Field(None, description="AI visual studio quality score (1-10)")
    model: str = Field("vision-curator", description="Vision model identifier")
    provider: str = Field("sovereign-ai", description="Inference provider")
    raw_analysis: Optional[str] = Field(None, description="Raw inspection thoughts from model")


class ImageAnalyzeRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64 encoded image data URL")
    hint: Optional[str] = Field(None, description="Optional artisan hint or craft cluster note")
    language_code: Optional[str] = Field("hi-IN", description="Target language for regional text")
