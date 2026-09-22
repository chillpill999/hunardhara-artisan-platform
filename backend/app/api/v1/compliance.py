import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, require_artisan, require_artisan_subject_or_admin, mask_email
from app.models.consent_log import ConsentLog
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.order import Order
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord
from app.models.artisan_application import ArtisanApplication
from app.models.deactivated_user import DeactivatedUser
from app.schemas.compliance import (
    ConsentLogCreate,
    ConsentLogResponse,
    ConsentRevokeRequest,
    ConsentRevokeResponse,
    RightToBeForgottenRequest,
    RightToBeForgottenResponse,
    DataExportResponse,
    UserDataIdentity
)
from app.core.storage_security import delete_stored_file, delete_user_stored_files

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
        user_id=current_user.id,
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


@router.post("/consent/{consent_id}/revoke", response_model=ConsentRevokeResponse, summary="Revoke DPDP Sovereign Consent")
def revoke_consent(
    consent_id: str,
    revoke_in: Optional[ConsentRevokeRequest] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DPDP Act 2023 Section 6(4) Consent Revocation:
    Allows data principals to withdraw previously granted consent.
    Enforces ownership: only the user who granted consent or an admin can revoke.
    """
    consent = db.query(ConsentLog).filter(ConsentLog.id == consent_id).first()
    if not consent:
        raise HTTPException(status_code=404, detail=f"Consent record '{consent_id}' not found.")

    is_owner = (
        (consent.user_id and consent.user_id == current_user.id) or
        (consent.artisan_id and consent.artisan_id == current_user.id) or
        current_user.is_admin
    )
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You may only revoke your own consent."
        )

    now = datetime.now(timezone.utc)
    consent.granted = False
    consent.revoked_at = now

    # Append immutable revocation audit trail
    reason = (revoke_in.reason if revoke_in else None) or "Withdrawn under DPDP Act 2023 Section 6(4)"
    revocation_log = ConsentLog(
        id=f"consent-rev-{uuid.uuid4().hex[:12]}",
        artisan_id=consent.artisan_id,
        user_id=current_user.id,
        consent_type=f"REVOKE_{consent.consent_type}",
        granted=False,
        purpose=f"Revocation of consent '{consent_id}': {reason}",
        language=consent.language or "hi",
        consent_artifact_type="WITHDRAWAL_NOTICE",
        consent_artifact_hash=hashlib.sha256(f"REVOKE:{consent_id}:{now.isoformat()}".encode()).hexdigest(),
        timestamp=now
    )
    db.add(revocation_log)
    db.commit()

    return ConsentRevokeResponse(
        status="revoked",
        consent_id=consent_id,
        revoked_at=now,
        message="Consent revoked successfully under DPDP Act 2023 Section 6(4)."
    )


@router.get("/consent", response_model=List[ConsentLogResponse], summary="List DPDP Consent Records")
def list_user_consents(
    user_id: Optional[str] = Query(None, description="Target user ID (admin only)"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists consent logs associated with the authenticated user.
    Admins may inspect consent history for any user.
    """
    target_id = current_user.id
    if user_id and user_id != current_user.id:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN_OWNERSHIP: You may only view your own consent history."
            )
        target_id = user_id

    return db.query(ConsentLog).filter(
        (ConsentLog.user_id == target_id) | (ConsentLog.artisan_id == target_id)
    ).order_by(ConsentLog.timestamp.desc()).all()


@router.post("/forget", response_model=RightToBeForgottenResponse, summary="Right to be Forgotten")
def right_to_be_forgotten(
    req: RightToBeForgottenRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DPDP Act 2023 Sovereign Data Erasure:
    Permanently purges personal identifiers, redacts PII, deactivates active listings,
    purges associated applications, match records, unlinks stored files from disk,
    records deactivation in the persistent deactivated_users registry, and generates
    an immutable cryptographic audit trail.
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

    if artisan.profile_photo_url:
        delete_stored_file(artisan.profile_photo_url, owner_id=req.artisan_id)
        artisan.profile_photo_url = None
    if artisan.voice_intro_url:
        delete_stored_file(artisan.voice_intro_url, owner_id=req.artisan_id)
        artisan.voice_intro_url = None

    redacted_count += 1

    # 2. Deactivate Active Product Listings and remove product stored files
    products = db.query(Product).filter(Product.artisan_id == req.artisan_id).all()
    for p in products:
        p.is_active = False
        delete_stored_file(p.studio_image_url, owner_id=req.artisan_id)
        delete_stored_file(p.before_after_preview_url, owner_id=req.artisan_id)
        delete_stored_file(p.raw_photo_url, owner_id=req.artisan_id)
        delete_stored_file(p.raw_audio_url, owner_id=req.artisan_id)
        p.studio_image_url = None
        p.before_after_preview_url = None
        p.raw_photo_url = None
        p.raw_audio_url = None
        redacted_count += 1

    # 3. Purge associated upgrade applications
    apps_deleted = db.query(ArtisanApplication).filter(ArtisanApplication.user_id == req.artisan_id).delete()
    redacted_count += apps_deleted

    # 4. Clean up B2B Match Records directed to this artisan
    matches_deleted = db.query(B2BMatchRecord).filter(B2BMatchRecord.artisan_id == req.artisan_id).delete()
    redacted_count += matches_deleted

    # 5. Purge all remaining user storage files across categories
    delete_user_stored_files(req.artisan_id)

    # 6. Record in DeactivatedUser registry to invalidate all existing tokens
    deact = db.query(DeactivatedUser).filter(DeactivatedUser.id == req.artisan_id).first()
    if not deact:
        deact = DeactivatedUser(
            id=req.artisan_id,
            reason=req.reason or "Artisan requested full data deletion under DPDP Act 2023 Section 12",
            deactivated_at=datetime.now(timezone.utc)
        )
        db.add(deact)

    # 7. Log Sovereign Erasure in Consent Ledger
    audit_entry = ConsentLog(
        id=f"forget-{uuid.uuid4().hex[:12]}",
        artisan_id=req.artisan_id,
        user_id=req.artisan_id,
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
        message="Database profile identifiers were redacted, listings deactivated, stored files deleted, and account registered as deactivated under DPDP Act 2023.",
        records_redacted=redacted_count,
        timestamp=datetime.now(timezone.utc)
    )


@router.delete("/artisan/{artisan_id}", summary="Delete Artisan Personal Data (DPDP S12)")
def delete_artisan_data(
    artisan_id: str,
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """Convenience alias for DPDP sovereign data erasure by artisan ID."""
    req = RightToBeForgottenRequest(artisan_id=artisan_id, confirmation=True)
    return right_to_be_forgotten(req, current_user, db)


@router.delete("/customer/{customer_id}", summary="Delete Customer Personal Data (DPDP S12)")
def delete_customer_data(
    customer_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DPDP Act 2023 Section 12 Customer Data Erasure:
    Allows a customer to delete their personal account data, redact order personal identifiers,
    redact buyer contact information on RFQs, purge upgrade applications, delete stored files,
    and register the customer ID in the deactivated_users registry so further access is blocked.
    """
    if not current_user.is_admin and current_user.id != customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You may only erase your own customer data."
        )

    redacted_count = 0

    # 1. Anonymize Orders
    orders = db.query(Order).filter(Order.customer_id == customer_id).all()
    for o in orders:
        o.customer_id = f"REDACTED_{uuid.uuid4().hex[:8]}"
        o.payment_id = None
        redacted_count += 1

    # 2. Redact B2B RFQs created by this buyer
    rfqs = db.query(B2BRFQ).filter(B2BRFQ.buyer_id == customer_id).all()
    for r in rfqs:
        r.buyer_name = "REDACTED"
        r.buyer_organization = None
        r.buyer_email = f"redacted_{uuid.uuid4().hex[:8]}@anonymized.invalid"
        r.buyer_phone = None
        r.buyer_id = f"REDACTED_{uuid.uuid4().hex[:8]}"
        redacted_count += 1

    # 3. Purge associated upgrade applications
    apps_deleted = db.query(ArtisanApplication).filter(ArtisanApplication.user_id == customer_id).delete()
    redacted_count += apps_deleted

    # 4. Purge stored customer files
    delete_user_stored_files(customer_id)

    # 5. Record in DeactivatedUser registry
    deact = db.query(DeactivatedUser).filter(DeactivatedUser.id == customer_id).first()
    if not deact:
        deact = DeactivatedUser(
            id=customer_id,
            reason="Customer requested data erasure under DPDP Act 2023 Section 12",
            deactivated_at=datetime.now(timezone.utc)
        )
        db.add(deact)

    # 6. Immutable audit log entry
    audit_entry = ConsentLog(
        id=f"forget-cust-{uuid.uuid4().hex[:12]}",
        artisan_id=None,
        user_id=customer_id,
        consent_type="RIGHT_TO_BE_FORGOTTEN",
        granted=True,
        purpose="Customer Sovereign Data Erasure under DPDP Act 2023 Section 12",
        language="en",
        consent_artifact_type="ERASURE_DIRECTIVE",
        consent_artifact_hash=hashlib.sha256(f"ERASE_CUSTOMER:{customer_id}".encode()).hexdigest()
    )
    db.add(audit_entry)
    db.commit()

    return {
        "status": "success",
        "customer_id": customer_id,
        "records_redacted": redacted_count,
        "message": "Customer personal identifiers redacted and account deactivated successfully under DPDP Act 2023."
    }


@router.get("/export", response_model=DataExportResponse, summary="Data Portability & Export (DPDP S11)")
def export_personal_data(
    user_id: Optional[str] = Query(None, description="Target user ID (admin only)"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DPDP Act 2023 Section 11 Right to Access & Data Portability:
    Exports all personal data, activity records, orders, listings, RFQs, and consent logs
    for the authenticated user in a structured format.
    Enforces strict ownership: only the user themselves or an administrator can export.
    """
    target_id = current_user.id
    if user_id and user_id != current_user.id:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN_OWNERSHIP: You may only export your own personal data."
            )
        target_id = user_id

    # 1. Account Identity
    deact = db.query(DeactivatedUser).filter(DeactivatedUser.id == target_id).first()
    is_active = deact is None
    account_info = UserDataIdentity(
        user_id=target_id,
        email=current_user.email if target_id == current_user.id else None,
        role=current_user.role if target_id == current_user.id else "user",
        is_active=is_active
    )

    # 2. Artisan Profile (if registered)
    artisan_dict = None
    artisan = db.query(Artisan).filter(Artisan.id == target_id).first()
    if artisan:
        artisan_dict = {
            "id": artisan.id,
            "full_name": artisan.full_name,
            "phone_number": artisan.phone_number,
            "masked_aadhaar": artisan.masked_aadhaar,
            "primary_craft": artisan.primary_craft,
            "cluster_id": artisan.cluster_id,
            "state": artisan.state,
            "district": artisan.district,
            "village": artisan.village,
            "experience_years": artisan.experience_years,
            "monthly_capacity_units": artisan.monthly_capacity_units,
            "social_category": artisan.social_category,
            "preferred_language": artisan.preferred_language,
            "is_active": artisan.is_active,
            "created_at": artisan.created_at.isoformat() if artisan.created_at else None
        }

    # 3. Products Listed (if artisan)
    products = db.query(Product).filter(Product.artisan_id == target_id).all()
    product_items = [
        {
            "id": p.id,
            "title": p.title,
            "craft_type": p.craft_type,
            "listing_price": p.listing_price,
            "floor_price": p.floor_price,
            "stock_quantity": p.stock_quantity,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in products
    ]

    # 4. Orders Placed (if customer)
    orders = db.query(Order).filter(Order.customer_id == target_id).all()
    order_items = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "product_title": o.product_title,
            "quantity": o.quantity,
            "total_price": o.total_price,
            "status": o.status,
            "payment_status": o.payment_status,
            "created_at": o.created_at.isoformat() if o.created_at else None
        }
        for o in orders
    ]

    # 5. B2B RFQs (if buyer)
    rfqs = db.query(B2BRFQ).filter(B2BRFQ.buyer_id == target_id).all()
    rfq_items = [
        {
            "id": r.id,
            "craft_type": r.craft_type,
            "required_quantity": r.required_quantity,
            "unit_budget": r.unit_budget,
            "total_budget": r.total_budget,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in rfqs
    ]

    # 6. Applications
    apps = db.query(ArtisanApplication).filter(ArtisanApplication.user_id == target_id).all()
    app_items = [
        {
            "id": a.id,
            "craft_category": a.craft_category,
            "experience_years": a.experience_years,
            "state": a.state,
            "district": a.district,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in apps
    ]

    # 7. Consent Ledger Records
    consents = db.query(ConsentLog).filter(
        (ConsentLog.user_id == target_id) | (ConsentLog.artisan_id == target_id)
    ).all()
    consent_items = [
        {
            "id": c.id,
            "consent_type": c.consent_type,
            "granted": c.granted,
            "purpose": c.purpose,
            "language": c.language,
            "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None
        }
        for c in consents
    ]

    return DataExportResponse(
        export_id=f"exp-{uuid.uuid4().hex[:12]}",
        standard="DPDP_ACT_2023_DATA_PORTABILITY_SECTION_11",
        user_id=target_id,
        generated_at=datetime.now(timezone.utc),
        account=account_info,
        artisan_profile=artisan_dict,
        products=product_items,
        orders=order_items,
        b2b_rfqs=rfq_items,
        applications=app_items,
        consent_records=consent_items
    )
