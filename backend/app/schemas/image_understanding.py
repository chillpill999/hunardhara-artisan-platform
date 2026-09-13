from typing import List, Optional
from pydantic import BaseModel, Field


class ImageUnderstandingResponse(BaseModel):
    success: bool = Field(True, description="Status of image recognition and catalog extraction")
    craft_type: str = Field(..., description="Identified Indian traditional craft form")
    product_name_hi: str = Field(..., description="Authentic Hindi product name in Devanagari script")
    product_name_en: str = Field(..., description="English product name")
    materials: List[str] = Field(default_factory=list, description="Detected craft raw materials")
    technique: str = Field(..., description="Traditional artisanal manufacturing technique")
    dominant_colors: List[str] = Field(default_factory=list, description="Primary visual color palette")
    estimated_dimensions: str = Field(..., description="Estimated physical dimensions")
    estimated_production_days: float = Field(..., description="Artisan labor days required")
    suggested_retail_price: float = Field(..., description="Fair market valuation in INR")
    description_hi: str = Field(..., description="Engaging marketing description in Hindi")
    description_en: str = Field(..., description="Engaging marketing description in English")
    artisan_heritage_notes: Optional[str] = Field(None, description="Cultural significance and cluster heritage")
    visual_quality_score: float = Field(8.5, description="AI visual studio quality score (1-10)")
    model: str = Field("google/gemma-4-31b-it:free", description="LLM/VLM model utilized for inference")
    provider: str = Field("openrouter", description="Inference gateway provider")
    raw_analysis: Optional[str] = Field(None, description="Raw inspection thoughts from model")


class ImageAnalyzeRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64 encoded image data URL")
    hint: Optional[str] = Field(None, description="Optional artisan hint or craft cluster note")
    language_code: Optional[str] = Field("hi-IN", description="Target language for regional text")
