from datetime import datetime
from typing import Optional, List, Union
from pydantic import BaseModel, Field


class ArtisanApplicationCreate(BaseModel):
    craft_category: str = Field(..., min_length=2, description="Craft discipline (e.g. Silk Weaving, Pottery)")
    experience_years: int = Field(default=1, ge=0, description="Years practicing the craft")
    state: Optional[str] = Field(None, description="State of workshop/residence")
    district: Optional[str] = Field(None, description="District of workshop/residence")
    full_name: Optional[str] = Field(None, description="Full name of applicant")
    phone: Optional[str] = Field(None, description="Contact phone number")
    workshop_info: Optional[str] = Field(None, description="Workshop or studio details")
    craft_description: Optional[str] = Field(None, description="Detailed craft description and techniques")
    sample_images: Optional[List[str]] = Field(None, description="Sample image URLs or base64 strings")
    document_references: Optional[List[str]] = Field(None, description="Document verification references")


class ArtisanApplicationRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Mandatory administrative justification for rejection")


class ArtisanApplicationResponse(BaseModel):
    id: str
    user_id: str
    craft_category: str
    experience_years: int
    state: Optional[str] = None
    district: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    workshop_info: Optional[str] = None
    craft_description: Optional[str] = None
    sample_images: Optional[str] = None
    document_references: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

