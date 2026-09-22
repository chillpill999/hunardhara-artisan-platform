from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ArtisanBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128, example="Rameshwar Baghel")
    phone_number: str = Field(..., pattern=r"^\+?[0-9]{10,13}$", example="+919876543210")
    social_category: str = Field(default="ST", example="ST")  # ST, SC, OBC, General, Divyangjan (Internal MoSJE)
    gender: Optional[str] = Field(None, example="Male")
    cluster_id: str = Field(..., example="cluster-bastar-dhokra")
    state: str = Field(..., example="Chhattisgarh")
    district: str = Field(..., example="Bastar")
    village: Optional[str] = Field(None, example="Kondagaon")
    latitude: float = Field(..., example=19.0748)
    longitude: float = Field(..., example=82.0298)
    primary_craft: str = Field(..., example="Bastar Dhokra")
    experience_years: int = Field(default=5, ge=0, example=12)
    monthly_capacity_units: int = Field(default=50, ge=1, example=80)
    profile_photo_url: Optional[str] = None
    voice_intro_url: Optional[str] = None
    preferred_language: str = Field(default="hi", example="hi")


class ArtisanCreate(ArtisanBase):
    raw_aadhaar: str = Field(
        ...,
        min_length=12,
        max_length=14,
        description="12-digit Aadhaar number for KYC validation via Verhoeff algorithm. Masked immediately upon receipt.",
        example="987654321098"
    )


class ArtisanUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=128)
    village: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0)
    monthly_capacity_units: Optional[int] = Field(None, ge=1)
    preferred_language: Optional[str] = None
    profile_photo_url: Optional[str] = None
    voice_intro_url: Optional[str] = None


class ArtisanResponse(ArtisanBase):
    id: str
    masked_aadhaar: str = Field(..., example="XXXXXXXX1098")
    aadhaar_hash: str
    daily_capacity_units: float
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ArtisanPublicProfile(BaseModel):
    """
    Publicly safe artisan representation with Zero PII exposure:
    Phone numbers, Aadhaar hashes, exact GPS coordinates, and sensitive affirmative action
    demographic categories (social_category / caste) are strictly stripped.
    """
    id: str
    full_name: str
    primary_craft: str
    cluster_name: Optional[str] = None
    cluster_id: Optional[str] = None
    state: str
    district: str
    experience_years: int
    profile_photo_url: Optional[str] = None
    preferred_language: str = "hi"

    model_config = ConfigDict(from_attributes=True)
