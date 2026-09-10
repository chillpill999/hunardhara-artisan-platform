from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ArtisanApplicationCreate(BaseModel):
    craft_category: str = Field(..., min_length=2, description="Craft discipline (e.g. Silk Weaving, Pottery)")
    experience_years: int = Field(default=1, ge=0, description="Years practicing the craft")
    state: Optional[str] = Field(None, description="State of workshop/residence")
    district: Optional[str] = Field(None, description="District of workshop/residence")


class ArtisanApplicationResponse(BaseModel):
    id: str
    user_id: str
    craft_category: str
    experience_years: int
    state: Optional[str] = None
    district: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
