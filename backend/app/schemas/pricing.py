from typing import Optional, Dict
from pydantic import BaseModel, Field


class PricingEstimateRequest(BaseModel):
    craft_cluster: Optional[str] = Field(None, description="Cluster name or ID")
    cluster_id: Optional[str] = Field(None, description="Cluster unique ID")
    craft_type: str = Field(..., description="Traditional craft specialty")
    materials_cost: Optional[float] = Field(None, ge=0.0, description="Raw materials cost")
    raw_material_cost: Optional[float] = Field(None, ge=0.0, description="Alias for materials_cost")
    labor_hours: float = Field(..., ge=0.1, description="Reported production labor hours")
    product_image_url: Optional[str] = Field(None, description="Image URL for visual embedding matching")
    image_url: Optional[str] = Field(None, description="Alias for product_image_url")

    def get_materials_cost(self) -> float:
        if self.materials_cost is not None:
            return self.materials_cost
        if self.raw_material_cost is not None:
            return self.raw_material_cost
        return 0.0


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


class PricingEstimateResponse(BaseModel):
    status: str = "success"
    currency: str = "INR"
    pricing_tiers: PricingTiers
    cost_breakdown: CostBreakdown
    market_benchmark: Optional[MarketBenchmarkResult] = None
    rationale_english: str
    rationale_hindi: str
    
    # Flat top-level convenience fields (PROJECT.md contract compatibility)
    floor_price: Optional[float] = None
    recommended_retail_price: Optional[float] = None
    wholesale_b2b_price: Optional[float] = None
    statutory_wage_rate: Optional[float] = None
    market_benchmark_price: Optional[float] = None
    rationale: Optional[Dict[str, str]] = None

