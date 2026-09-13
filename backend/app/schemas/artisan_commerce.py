"""
Hunardhara Artisan Commerce Schemas
Strict structured schemas for attribute extraction, verified catalog output, and artisan approval.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class DimensionsSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    length_cm: Optional[float] = Field(None, description="Length in centimeters")
    width_cm: Optional[float] = Field(None, description="Width in centimeters")
    height_cm: Optional[float] = Field(None, description="Height in centimeters")
    unit: str = Field("cm", description="Measurement unit")
    raw_str: Optional[str] = Field(None, description="Original colloquial dimensions string")


class StructuredArtisanAttributes(BaseModel):
    """
    Module C: Canonical structured product representation.
    Enforces truthfulness: unknown fields are None/empty, never hallucinated.
    """
    model_config = ConfigDict(extra="ignore")

    product_name: str = Field(..., description="Normalized product name")
    category: str = Field(..., description="Top-level commerce category")
    sub_category: Optional[str] = Field(None, description="Specific sub-category")
    craft_type: str = Field(..., description="Craft style/type (e.g. Bastar Dhokra, Varanasi Silk)")
    material: List[str] = Field(default_factory=list, description="Verified or stated materials")
    primary_color: str = Field(..., description="Primary dominant color")
    secondary_colors: List[str] = Field(default_factory=list, description="Secondary accent colors")
    pattern: Optional[str] = Field(None, description="Surface pattern or design style")
    dimensions: DimensionsSchema = Field(default_factory=DimensionsSchema, description="Structured dimensions")
    weight: Optional[str] = Field(None, description="Weight with unit where stated")
    production_time_days: Optional[float] = Field(None, description="Days of labor required")
    artisan_stated_price: Optional[float] = Field(None, description="Artisan's self-stated desired price in INR")
    material_cost: Optional[float] = Field(None, description="Raw material costs in INR where known")
    labor_cost: Optional[float] = Field(None, description="Calculated or stated labor cost in INR")
    region: Optional[str] = Field(None, description="Geographic craft cluster or state")
    language: str = Field("hi", description="Artisan's primary communication language code")
    confidence: Dict[str, float] = Field(default_factory=dict, description="Field-level extraction confidence (0.0 - 1.0)")
    verification_required: List[str] = Field(default_factory=list, description="Fields requiring human/artisan verification")


class CareInstructions(BaseModel):
    model_config = ConfigDict(extra="ignore")

    instructions_hi: str = Field(..., description="Care guidance in Hindi")
    instructions_en: str = Field(..., description="Care guidance in English")
    washing_recommendation: Optional[str] = None
    handling_notes: Optional[str] = None


class PricingRecommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cost_estimate: float = Field(..., description="Estimated cost floor (materials + statutory labor)")
    market_range_min: float = Field(..., description="Lower bound of observed fair market prices")
    market_range_max: float = Field(..., description="Upper bound of observed fair market prices")
    suggested_retail_min: float = Field(..., description="Recommended retail price lower bound")
    suggested_retail_max: float = Field(..., description="Recommended retail price upper bound")
    suggested_wholesale_price: float = Field(..., description="Recommended B2B bulk unit price")
    confidence: float = Field(0.85, description="Pricing confidence based on benchmark depth")
    factors_affecting_recommendation: List[str] = Field(default_factory=list, description="Explainable pricing factors")
    statutory_daily_wage_used: float = Field(650.0, description="Minimum daily craft wage used in calculation")


class CertificationStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")

    gi_status: str = Field("unverified", description="'verified', 'unverified', or 'not_applicable'")
    gi_registration_number: Optional[str] = Field(None, description="Government GI registration number if verified")
    material_purity_status: str = Field("artisan_stated", description="'ai_detected', 'artisan_stated', or 'verified'")
    provenance_claim: str = Field("Craft tradition style", description="Accurate provenance statement")


class HunardharaCatalogOutput(BaseModel):
    """
    Module D: Market-ready professional product listing.
    Adheres strictly to the Hunardhara writing style (dignified, warm, simple, zero hyperbole).
    """
    model_config = ConfigDict(extra="ignore")

    # 1. Product title
    title_en: str = Field(..., description="Professional English product title")
    title_hi: str = Field(..., description="देवनागरी हिंदी शीर्षक")
    
    # 2. Short description
    short_description_en: str = Field(..., description="2-3 sentence concise English summary")
    short_description_hi: str = Field(..., description="2-3 वाक्यों का संक्षिप्त हिंदी विवरण")

    # 3. Long description
    long_description_en: str = Field(..., description="Detailed cultural context, making process, and usage")
    long_description_hi: str = Field(..., description="विस्तृत निर्माण विधि, परंपरा और उपयोगिता")

    # 4. Bullet highlights
    bullet_highlights_en: List[str] = Field(default_factory=list, description="Key features in English")
    bullet_highlights_hi: List[str] = Field(default_factory=list, description="प्रमुख विशेषताएं (हिंदी)")

    # 5. Materials
    materials: List[str] = Field(default_factory=list, description="Verified or stated materials")

    # 6. Craft technique
    craft_technique: str = Field(..., description="Specific artisan technique (e.g. Lost-Wax Bell Metal Casting)")

    # 7. Care instructions
    care_instructions: CareInstructions

    # 8. Keywords & Search tags
    keywords: List[str] = Field(default_factory=list, description="High-intent commercial keywords")
    search_tags: List[str] = Field(default_factory=list, description="Regional, material, and category search tags")

    # 9. Category taxonomy
    category: str
    sub_category: Optional[str] = None

    # 10. Regional language description (optional third localized language)
    local_language_code: Optional[str] = None
    local_language_description: Optional[str] = None

    # 11. Structured attributes
    attributes: StructuredArtisanAttributes

    # 12. Pricing assistance
    pricing: PricingRecommendation

    # 13. Certification & Safety
    certification: CertificationStatus

    # 14. Verification Flags
    verification_required: List[str] = Field(default_factory=list)
    style_compliance_score: float = Field(1.0, description="1.0 = zero banned words, fully compliant")
