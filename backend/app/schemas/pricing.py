from typing import Optional, Dict, List
from pydantic import BaseModel, Field


class PricingEstimateRequest(BaseModel):
    craft_cluster: Optional[str] = Field(None, description="Cluster name or ID")
    cluster_id: Optional[str] = Field(None, description="Cluster unique ID")
    craft_type: str = Field(..., description="Traditional craft specialty")
    materials_cost: Optional[float] = Field(None, ge=0.0, description="Raw materials cost")
    raw_material_cost: Optional[float] = Field(None, ge=0.0, description="Alias for materials_cost")
    labor_hours: float = Field(..., ge=0.1, description="Reported production labor hours")
    product_description: Optional[str] = Field(None, description="Product description or voice transcript for NLP analysis")
    description: Optional[str] = Field(None, description="Alias for product_description")
    product_image_url: Optional[str] = Field(None, description="Image URL for visual embedding matching")
    image_url: Optional[str] = Field(None, description="Alias for product_image_url")
    product_image_base64: Optional[str] = Field(None, description="Base64 encoded craft image for visual inspection")
    image_base64: Optional[str] = Field(None, description="Alias for product_image_base64")
    artisan_stated_price: Optional[float] = Field(None, ge=0.0, description="Artisan stated target price")

    def get_materials_cost(self) -> float:
        if self.materials_cost is not None:
            return self.materials_cost
        if self.raw_material_cost is not None:
            return self.raw_material_cost
        return 0.0

    def get_description(self) -> str:
        return (self.product_description or self.description or "").strip()

    def get_image_input(self) -> Optional[str]:
        return self.product_image_base64 or self.image_base64 or self.product_image_url or self.image_url


class PricingTiers(BaseModel):
    floor_price: float = Field(..., description="Certified minimum cost-plus floor price")
    recommended_retail_d2c: float = Field(..., description="Recommended direct-to-consumer price")
    wholesale_b2b: float = Field(..., description="Recommended bulk wholesale price")


class CostBreakdown(BaseModel):
    raw_materials: float
    labor_hours: float
    hourly_wage_applied: float
    total_labor_cost: float
    overhead_cost: float
    district: str
    state: str


class MarketBenchmarkResult(BaseModel):
    similarity_score: float = Field(default=0.0)
    matched_benchmark_item: Optional[str] = None
    average_market_retail: Optional[float] = None


class DynamicValuationFactors(BaseModel):
    statutory_cost_floor: float = Field(..., description="Certified anti-exploitation lower bound (INR)")
    craftsmanship_quality_score: float = Field(..., description="Visual finishing & craftsmanship score (0.0 - 1.0)")
    craftsmanship_premium: float = Field(..., description="Visual premium added above floor (INR)")
    heritage_technique_score: float = Field(..., description="NLP heritage technique score (0.0 - 1.0)")
    heritage_narrative_premium: float = Field(..., description="Narrative heritage premium added (INR)")
    market_demand_index: float = Field(..., description="Cluster demand intensity multiplier")
    market_trend_direction: str = Field(..., description="Trend: peak_festival, rising, stable, high_export_demand")
    market_seasonal_boost: float = Field(..., description="Seasonal festive/wedding calendar boost")
    commodity_inflation_rate: float = Field(..., description="Annualized raw material inflation (%)")
    factors_applied: List[str] = Field(default_factory=list)


class PricingEstimateResponse(BaseModel):
    status: str = "success"
    currency: str = "INR"
    pricing_tiers: PricingTiers
    cost_breakdown: CostBreakdown
    market_benchmark: Optional[MarketBenchmarkResult] = None
    dynamic_factors: Optional[DynamicValuationFactors] = None
    rationale_english: str
    rationale_hindi: str

    # Flat top-level convenience fields (PROJECT.md contract compatibility)
    floor_price: Optional[float] = None
    recommended_retail_price: Optional[float] = None
    wholesale_b2b_price: Optional[float] = None
    statutory_wage_rate: Optional[float] = None
    market_benchmark_price: Optional[float] = None
    rationale: Optional[Dict[str, str]] = None


class MarketTrendResponse(BaseModel):
    craft_type: str
    cluster_id: str
    category: str
    state: str
    demand_index: float
    trend_direction: str
    seasonal_focus: str
    raw_material_inflation_pct: float
    moving_avg_30d: float
    moving_avg_90d: float
    growth_rate_pct: float
    data_sources: List[str]
    key_market_drivers: List[str]
    last_updated: str


