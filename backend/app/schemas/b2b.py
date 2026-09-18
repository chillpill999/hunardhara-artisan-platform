from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator


class BuyerLocation(BaseModel):
    latitude: float = Field(..., json_schema_extra={"example": 28.6139})
    longitude: float = Field(..., json_schema_extra={"example": 77.2090})


class B2BRFQCreate(BaseModel):
    craft_type: str = Field(..., json_schema_extra={"example": "Bastar Dhokra"})
    required_quantity: Optional[int] = Field(default=None, ge=1, json_schema_extra={"example": 200})
    quantity: Optional[int] = Field(default=None, ge=1, json_schema_extra={"example": 200})
    unit_budget: float = Field(..., ge=1.0, json_schema_extra={"example": 1500.0})
    days_to_deadline: Optional[int] = Field(default=None, ge=1, le=365, json_schema_extra={"example": 45})
    deadline_days: Optional[int] = Field(default=None, ge=1, le=365, json_schema_extra={"example": 45})
    delivery_latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, json_schema_extra={"example": 28.6139})
    delivery_longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, json_schema_extra={"example": 77.2090})
    buyer_location: Optional[BuyerLocation] = None
    buyer_name: Optional[str] = Field(default=None, json_schema_extra={"example": "MoSJE Emporium"})
    buyer_email: Optional[str] = Field(default=None, json_schema_extra={"example": "buyer@crafts.gov.in"})
    buyer_organization: Optional[str] = Field(default=None, json_schema_extra={"example": "TRIFED"})
    buyer_phone: Optional[str] = Field(default=None, json_schema_extra={"example": "+919876500000"})
    delivery_state: Optional[str] = Field(default=None, json_schema_extra={"example": "Delhi"})
    delivery_district: Optional[str] = Field(default=None, json_schema_extra={"example": "New Delhi"})
    requested_artisan_id: Optional[str] = Field(default=None, description="Optional target artisan ID; strictly verified without substitution")

    @model_validator(mode="before")
    @classmethod
    def reconcile_input_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize quantity
            qty = data.get("required_quantity") or data.get("quantity")
            if qty is not None:
                data["required_quantity"] = int(qty)
                data["quantity"] = int(qty)
            elif "required_quantity" not in data and "quantity" not in data:
                data["required_quantity"] = 1
                data["quantity"] = 1

            # Normalize deadline days
            days = data.get("days_to_deadline") or data.get("deadline_days")
            if days is not None:
                data["days_to_deadline"] = int(days)
                data["deadline_days"] = int(days)
            elif "days_to_deadline" not in data and "deadline_days" not in data:
                data["days_to_deadline"] = 30
                data["deadline_days"] = 30

            # Normalize buyer location
            loc = data.get("buyer_location")
            if isinstance(loc, dict):
                lat = loc.get("latitude", data.get("delivery_latitude"))
                lon = loc.get("longitude", data.get("delivery_longitude"))
                if lat is not None:
                    data["delivery_latitude"] = float(lat)
                if lon is not None:
                    data["delivery_longitude"] = float(lon)
            elif hasattr(loc, "latitude") and hasattr(loc, "longitude"):
                data["delivery_latitude"] = float(loc.latitude)
                data["delivery_longitude"] = float(loc.longitude)
        return data


class B2BMatchScoreBreakdown(BaseModel):
    craft_compatibility: float = Field(..., description="Craft & category match (weight 35%)", json_schema_extra={"example": 100.0})
    price_compatibility: float = Field(..., description="Unit budget match (weight 30%)", json_schema_extra={"example": 96.0})
    capacity_feasibility: float = Field(..., description="Production delivery capacity (weight 25%)", json_schema_extra={"example": 92.5})
    location_score: float = Field(..., description="Geodesic proximity (weight 10%)", json_schema_extra={"example": 75.0})


class B2BArtisanMatchItem(BaseModel):
    artisan_id: str
    artisan_name: str
    cluster_name: str
    location: str
    match_percentage: float = Field(..., ge=0.0, le=100.0, json_schema_extra={"example": 94.2})
    breakdown: B2BMatchScoreBreakdown
    scores: Optional[Dict[str, float]] = None
    capacity_feasible: bool = Field(..., description="True if artisan can fulfill order before deadline")
    estimated_production_days: int
    estimated_fulfillment_days: Optional[int] = None
    offered_wholesale_price: float
    quoted_unit_price: Optional[float] = None
    distance_km: Optional[float] = None
    match_explanation: str
    explanation: Optional[str] = None

    model_config = ConfigDict(extra="allow", from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def populate_convenience_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Aliases for scores
            if "breakdown" in data and not data.get("scores"):
                bd = data["breakdown"]
                if isinstance(bd, dict):
                    data["scores"] = {
                        "craft": bd.get("craft_compatibility", 0.0),
                        "price": bd.get("price_compatibility", 0.0),
                        "capacity": bd.get("capacity_feasibility", 0.0),
                        "location": bd.get("location_score", 0.0),
                    }
                elif hasattr(bd, "craft_compatibility"):
                    data["scores"] = {
                        "craft": bd.craft_compatibility,
                        "price": bd.price_compatibility,
                        "capacity": bd.capacity_feasibility,
                        "location": bd.location_score,
                    }
            elif "scores" in data and not data.get("breakdown"):
                sc = data["scores"]
                data["breakdown"] = B2BMatchScoreBreakdown(
                    craft_compatibility=sc.get("craft", 0.0),
                    price_compatibility=sc.get("price", 0.0),
                    capacity_feasibility=sc.get("capacity", 0.0),
                    location_score=sc.get("location", 0.0)
                )

            # Production days alias
            days = data.get("estimated_production_days") or data.get("estimated_fulfillment_days", 30)
            data["estimated_production_days"] = days
            data["estimated_fulfillment_days"] = days

            # Wholesale price alias
            price = data.get("offered_wholesale_price") or data.get("quoted_unit_price", 0.0)
            data["offered_wholesale_price"] = price
            data["quoted_unit_price"] = price

            # Explanation alias
            exp = data.get("match_explanation") or data.get("explanation", "")
            data["match_explanation"] = exp
            data["explanation"] = exp
        return data


class ConsortiumClusterOption(BaseModel):
    consortium_recommended: bool
    cluster_name: str
    participating_artisans: List[str]
    artisan_count: int
    combined_monthly_capacity: int
    deliverable_in_deadline: float
    consortium_feasible: bool
    explanation: str

    model_config = ConfigDict(extra="allow", from_attributes=True)


class B2BRFQSummary(BaseModel):
    craft_type: str
    required_quantity: int
    unit_budget: float
    days_to_deadline: int


class B2BMatchResponse(BaseModel):
    status: str = "success"
    rfq_id: Optional[str] = None
    rfq_summary: B2BRFQSummary
    total_matches_found: int
    matches: List[B2BArtisanMatchItem]
    consortium_feasible: Optional[bool] = None
    consortium_option: Optional[ConsortiumClusterOption] = None

    model_config = ConfigDict(extra="allow", from_attributes=True)


class B2BMatchRecordItem(BaseModel):
    id: str
    artisan_id: str
    artisan_name: Optional[str] = None
    cluster_name: Optional[str] = None
    match_percentage: float
    capacity_feasible: bool
    estimated_production_days: int
    quoted_unit_price: float
    distance_km: float
    match_explanation: str
    status: Optional[str] = "PROPOSED"
    scores: Optional[Dict[str, float]] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class B2BRFQUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, description="Updated status (OPEN, MATCHED, IN_NEGOTIATION, FULFILLED, CLOSED)")
    unit_budget: Optional[float] = Field(None, ge=1.0, description="Updated unit budget in INR")
    required_quantity: Optional[int] = Field(None, ge=1, description="Updated required quantity")
    deadline_days: Optional[int] = Field(None, ge=1, le=365, description="Updated deadline in days")
    delivery_state: Optional[str] = None
    delivery_district: Optional[str] = None


class B2BMatchStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target match status: PROPOSED, ACCEPTED, REJECTED")


class B2BRFQResponse(BaseModel):
    id: str
    buyer_id: Optional[str] = None
    craft_type: str
    required_quantity: int
    unit_budget: float
    total_budget: float
    deadline_days: int
    delivery_state: Optional[str] = None
    delivery_district: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    status: str
    buyer_name: Optional[str] = None
    buyer_organization: Optional[str] = None
    buyer_email: Optional[str] = None
    created_at: Optional[datetime] = None
    matches: List[B2BMatchRecordItem] = []
    consortium_feasible: Optional[bool] = None
    consortium_option: Optional[ConsortiumClusterOption] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")
