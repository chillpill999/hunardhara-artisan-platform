from typing import Optional, List, Dict, Any
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
    artisan_id: Optional[str] = None
    user_id: Optional[str] = None
    consent_type: str
    granted: bool
    purpose: str
    language: str
    revoked_at: Optional[datetime] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsentRevokeRequest(BaseModel):
    reason: Optional[str] = Field(default="Consent withdrawn by data principal under DPDP Act 2023 Section 6(4)")


class ConsentRevokeResponse(BaseModel):
    status: str = "revoked"
    consent_id: str
    revoked_at: datetime
    message: str = "Consent revoked successfully under DPDP Act 2023 Section 6(4)."


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


class UserDataIdentity(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: str
    is_active: bool


class DataExportResponse(BaseModel):
    export_id: str
    standard: str = "DPDP_ACT_2023_DATA_PORTABILITY_SECTION_11"
    user_id: str
    generated_at: datetime
    account: UserDataIdentity
    artisan_profile: Optional[Dict[str, Any]] = None
    products: List[Dict[str, Any]] = Field(default_factory=list)
    orders: List[Dict[str, Any]] = Field(default_factory=list)
    b2b_rfqs: List[Dict[str, Any]] = Field(default_factory=list)
    applications: List[Dict[str, Any]] = Field(default_factory=list)
    consent_records: List[Dict[str, Any]] = Field(default_factory=list)
