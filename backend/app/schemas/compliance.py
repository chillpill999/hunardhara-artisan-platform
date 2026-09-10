from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ConsentLogCreate(BaseModel):
    artisan_id: str = Field(..., example="artisan-uuid")
    consent_type: str = Field(
        ...,
        description="Type of consent: DATA_COLLECTION, VOICE_RECORDING, CATALOG_LISTING, AADHAAR_VAULT",
        example="DATA_COLLECTION"
    )
    granted: bool = Field(default=True)
    purpose: str = Field(..., example="Generation of e-commerce catalog and price estimation")
    language: str = Field(default="hi", example="hi")
    consent_artifact_type: str = Field(default="VISUAL_TOUCH", example="VISUAL_TOUCH")
    consent_artifact_hash: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ConsentLogResponse(BaseModel):
    id: str
    artisan_id: str
    consent_type: str
    granted: bool
    purpose: str
    language: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class RightToBeForgottenRequest(BaseModel):
    artisan_id: str
    reason: Optional[str] = Field(default="Artisan requested full data deletion under DPDP Act 2023 Section 12")
    confirmation: bool = Field(..., description="Must be true to authorize deletion")


class RightToBeForgottenResponse(BaseModel):
    status: str = "success"
    artisan_id: str
    message: str = "All personal identifiers and biometric audio artifacts have been purged in compliance with DPDP Act 2023."
    records_redacted: int
    timestamp: datetime
