from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CraftClusterBase(BaseModel):
    name: str = Field(..., example="Varanasi Silk Craft Cluster")
    craft_name: str = Field(..., example="Varanasi Silk")
    state: str = Field(..., example="Uttar Pradesh")
    district: str = Field(..., example="Varanasi")
    latitude: float = Field(..., example=25.3176)
    longitude: float = Field(..., example=82.9739)
    statutory_hourly_wage: float = Field(..., example=60.0)
    statutory_daily_wage: float = Field(..., example=480.0)
    gi_tag_status: str = Field(..., example="Registered (GI-99)")
    gi_tag_number: Optional[str] = Field(None, example="GI-99")
    materials: List[str] = Field(default_factory=list)
    techniques: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class CraftClusterCreate(CraftClusterBase):
    id: Optional[str] = None


class CraftClusterResponse(CraftClusterBase):
    id: str
    created_at: Optional[datetime] = None
    artisan_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
