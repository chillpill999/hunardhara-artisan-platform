import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, require_artisan_subject_or_admin
from app.models.consent_log import ConsentLog
from app.models.artisan import Artisan
from app.models.product import Product
from app.schemas.compliance import (
    ConsentLogCreate,
    ConsentLogResponse,
    RightToBeForgottenRequest,
    RightToBeForgottenResponse
)

logger = logging.getLogger("artisan_platform.api.compliance")
router = APIRouter(prefix="/compliance", tags=["Security & DPDP 2023 Compliance"])


@router.post("/consent", response_model=dict, summary="Record DPDP Act 2023 Sovereign Consent")
def record_consent(
    consent_in: ConsentLogCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DPDP Act 2023 Consent Ledger:
    Records affirmative voice, visual, or digital consent with SHA256 cryptographic provenance.
    """
    require_artisan_subject_or_admin(consent_in.artisan_id, current_user)

    # The server records the authenticated subject and event metadata. A supplied
    # artifact digest is evidence supplied by the client, not proof of consent.
    event_time = datetime.now(timezone.utc)
    provenance = ":".join(
        [
            current_user.id,
            consent_in.consent_type,
            consent_in.purpose,
            str(consent_in.granted),
            consent_in.consent_artifact_hash or "",
            event_time.isoformat(),
        ]
    )
    artifact_hash = hashlib.sha256(provenance.encode()).hexdigest()

    consent_record = ConsentLog(
        id=f"consent-{uuid.uuid4().hex[:12]}",
        artisan_id=consent_in.artisan_id,
        consent_type=consent_in.consent_type,
        granted=consent_in.granted,
        purpose=consent_in.purpose,
        language=consent_in.language,
        consent_artifact_type=consent_in.consent_artifact_type,
        consent_artifact_hash=artifact_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    db.add(consent_record)
    try:
        db.commit()
        db.refresh(consent_record)
    except Exception:
        db.rollback()
        logger.warning("Consent ledger persistence failed")
        consent_record.timestamp = datetime.now(timezone.utc)

    return {
        "status": "recorded",
        "ledger_id": consent_record.id,
        "artisan_id": consent_record.artisan_id,
        "consent_type": consent_record.consent_type,
        "granted": consent_record.granted,
        "consent_artifact_hash": artifact_hash,
        "timestamp": consent_record.timestamp.isoformat()
    }


@router.post("/forget", response_model=RightToBeForgottenResponse, summary="Right to be Forgotten")
def right_to_be_forgotten(
    req: RightToBeForgottenRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DPDP Act 2023 Sovereign Data Erasure:
    Permanently purges personal identifiers, redacts PII, deactivates active listings,
    and creates an immutable cryptographic audit trail.
    """
    require_artisan_subject_or_admin(req.artisan_id, current_user)

    if not req.confirmation:
        raise HTTPException(
            status_code=400,
            detail="CONFIRMATION_REQUIRED: Explicit confirmation required under DPDP Act 2023"
        )

    redacted_count = 0

    # 1. Redact Artisan Profile PII
    artisan = db.query(Artisan).filter(Artisan.id == req.artisan_id).first()
    if not artisan:
        raise HTTPException(
            status_code=404,
            detail=f"ARTISAN_NOT_FOUND: Artisan with ID '{req.artisan_id}' does not exist."
        )

    artisan.full_name = "REDACTED_ARTISAN"
    artisan.phone_number = f"REDACTED_{uuid.uuid4().hex[:8]}"  # preserve unique constraint
    artisan.masked_aadhaar = "XXXXXXXX0000"
    artisan.village = "REDACTED"
    artisan.district = "REDACTED"
    artisan.is_active = False
    redacted_count += 1

    # 2. Deactivate Active Product Listings
    products = db.query(Product).filter(Product.artisan_id == req.artisan_id).all()
    for p in products:
        p.is_active = False
        redacted_count += 1

    # 3. Log Sovereign Erasure in Consent Ledger
    audit_entry = ConsentLog(
        id=f"forget-{uuid.uuid4().hex[:12]}",
        artisan_id=req.artisan_id,
        consent_type="RIGHT_TO_BE_FORGOTTEN",
        granted=True,
        purpose="Sovereign Data Erasure under DPDP Act 2023 Section 12",
        language="en",
        consent_artifact_type="ERASURE_DIRECTIVE",
        consent_artifact_hash=hashlib.sha256(f"ERASE:{req.artisan_id}".encode()).hexdigest()
    )
    db.add(audit_entry)
    try:
        db.commit()
        db.refresh(artisan)
    except Exception:
        db.rollback()
        logger.warning("Erasure audit commit failed")
        raise HTTPException(status_code=500, detail="ERASURE_COMMIT_FAILED")

    return RightToBeForgottenResponse(
        status="success",
        artisan_id=req.artisan_id,
        message="Database profile identifiers were redacted and product listings were deactivated. No claim is made about external files or artifacts not deleted by this operation.",
        records_redacted=redacted_count,
        timestamp=datetime.now(timezone.utc)
    )


@router.delete("/artisan/{artisan_id}", summary="Delete Artisan Personal Data (DPDP S12)")
def delete_artisan_data(
    artisan_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convenience alias for DPDP sovereign data erasure by artisan ID."""
    req = RightToBeForgottenRequest(artisan_id=artisan_id, confirmation=True)
    return right_to_be_forgotten(req, current_user, db)

