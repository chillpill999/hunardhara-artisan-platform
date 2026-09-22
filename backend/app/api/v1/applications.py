import uuid
import json
import hashlib
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, require_admin, require_super_admin
from app.models.artisan_application import ArtisanApplication
from app.models.artisan import Artisan
from app.models.craft_cluster import CraftCluster
from app.schemas.applications import (
    ArtisanApplicationCreate,
    ArtisanApplicationResponse,
    ArtisanApplicationRejectRequest
)

router = APIRouter(tags=["Artisan Applications & Role Upgrades"])


@router.post("/artisan/apply", response_model=ArtisanApplicationResponse, status_code=201, summary="Submit Artisan Upgrade Application")
def submit_artisan_application(
    app_in: ArtisanApplicationCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows an authenticated user/customer to apply for an artisan role upgrade.
    Application starts in 'pending' status.
    """
    # Check if there is already a pending application
    existing = db.query(ArtisanApplication).filter(
        ArtisanApplication.user_id == current_user.id,
        ArtisanApplication.status == "pending"
    ).first()
    if existing:
        return existing

    sample_imgs_str = json.dumps(app_in.sample_images) if app_in.sample_images else None
    doc_refs_str = json.dumps(app_in.document_references) if app_in.document_references else None
    now_utc = datetime.now(timezone.utc)

    new_app = ArtisanApplication(
        id=f"app-{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        full_name=app_in.full_name,
        phone=app_in.phone,
        craft_category=app_in.craft_category,
        experience_years=app_in.experience_years,
        state=app_in.state,
        district=app_in.district,
        workshop_info=app_in.workshop_info,
        craft_description=app_in.craft_description,
        sample_images=sample_imgs_str,
        document_references=doc_refs_str,
        status="pending",
        submitted_at=now_utc,
        created_at=now_utc,
        updated_at=now_utc
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app


@router.get("/artisan/application/my", response_model=List[ArtisanApplicationResponse], summary="List Current User's Applications")
def get_my_applications(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns application history only for the currently authenticated user.
    Prevents applicants from viewing other applicants' submissions.
    """
    return db.query(ArtisanApplication).filter(
        ArtisanApplication.user_id == current_user.id
    ).order_by(ArtisanApplication.created_at.desc()).all()


@router.get("/admin/applications", response_model=List[ArtisanApplicationResponse], summary="List Pending Artisan Applications")
def list_applications_admin(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator endpoint to review artisan applications.
    """
    return db.query(ArtisanApplication).order_by(ArtisanApplication.created_at.desc()).all()


@router.get("/admin/applications/{app_id}", response_model=ArtisanApplicationResponse, summary="Get Artisan Application Details")
def get_application_admin(
    app_id: str,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Administrator endpoint to view single application details."""
    app_record = db.query(ArtisanApplication).filter(ArtisanApplication.id == app_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")
    return app_record


@router.post("/admin/applications/{app_id}/approve", response_model=ArtisanApplicationResponse, summary="Approve Artisan Application")
def approve_application_admin(
    app_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Administrator endpoint to approve an artisan application.
    Artisans can only be approved by users with the 'super_admin' role.
    1. Verifies application exists and is currently in 'pending' status.
    2. Updates application status to 'approved'.
    3. Ensures active Artisan record in PostgreSQL / SQLite.
    4. Elevates user role in Supabase Auth to 'artisan' via server-side Admin API.
    5. Records reviewer ID, review timestamp, and immutable audit log.
    """
    from app.services.supabase_admin import supabase_admin
    from app.models.admin_audit_log import AdminAuditLog

    app_record = db.query(ArtisanApplication).filter(ArtisanApplication.id == app_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_record.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve application with status '{app_record.status}'. Only pending applications can be approved."
        )

    now_utc = datetime.now(timezone.utc)
    app_record.status = "approved"
    app_record.reviewed_at = now_utc
    app_record.reviewed_by = current_user.id
    app_record.updated_at = now_utc

    # Ensure an active Artisan record exists in the database for foreign-key consistency
    artisan = db.query(Artisan).filter(Artisan.id == app_record.user_id).first()
    if not artisan:
        cluster = db.query(CraftCluster).filter(CraftCluster.craft_name.ilike(f"%{app_record.craft_category}%")).first()
        if not cluster:
            cluster = db.query(CraftCluster).first()
        cluster_id = cluster.id if cluster else "cluster-bastar-dhokra"

        artisan = Artisan(
            id=app_record.user_id,
            full_name=app_record.full_name or f"Artisan {app_record.user_id[:8]}",
            phone_number=app_record.phone or f"+9198{uuid.uuid4().int % 100000000:08d}",
            masked_aadhaar="XXXXXXXX0000",
            aadhaar_hash=hashlib.sha256(f"seed-aadhaar-{app_record.user_id}".encode()).hexdigest(),
            social_category="OBC",
            cluster_id=cluster_id,
            state=app_record.state or (cluster.state if cluster else "India"),
            district=app_record.district or (cluster.district if cluster else "Central"),
            latitude=cluster.latitude if cluster else 20.5937,
            longitude=cluster.longitude if cluster else 78.9629,
            primary_craft=app_record.craft_category,
            experience_years=app_record.experience_years or 5,
            is_active=True
        )
        db.add(artisan)
    else:
        artisan.is_active = True
        if app_record.full_name and not artisan.full_name:
            artisan.full_name = app_record.full_name
        if app_record.phone and not artisan.phone_number:
            artisan.phone_number = app_record.phone

    # Upgrade role in Supabase Auth app_metadata
    supabase_admin.set_user_role(app_record.user_id, "artisan")

    # Record audit log
    audit_entry = AdminAuditLog(
        action="APPROVE_ARTISAN_APPLICATION",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=app_record.user_id,
        details=json.dumps({
            "application_id": app_id,
            "craft_category": app_record.craft_category,
            "new_role": "artisan",
            "reviewed_by": current_user.id,
            "reviewed_at": now_utc.isoformat()
        })
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(app_record)
    return app_record


@router.post("/admin/applications/{app_id}/reject", response_model=ArtisanApplicationResponse, summary="Reject Artisan Application")
def reject_application_admin(
    app_id: str,
    payload: ArtisanApplicationRejectRequest,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Administrator endpoint to reject an artisan application.
    Requires a mandatory justification reason.
    Artisans can only be rejected by users with the 'super_admin' role.
    """
    from app.models.admin_audit_log import AdminAuditLog

    app_record = db.query(ArtisanApplication).filter(ArtisanApplication.id == app_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_record.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject application with status '{app_record.status}'. Only pending applications can be rejected."
        )

    reason_clean = payload.reason.strip() if payload.reason else ""
    if not reason_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A non-empty rejection reason is required."
        )

    now_utc = datetime.now(timezone.utc)
    app_record.status = "rejected"
    app_record.rejection_reason = reason_clean
    app_record.reviewed_at = now_utc
    app_record.reviewed_by = current_user.id
    app_record.updated_at = now_utc

    # Record audit log
    audit_entry = AdminAuditLog(
        action="REJECT_ARTISAN_APPLICATION",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=app_record.user_id,
        details=json.dumps({
            "application_id": app_id,
            "reason": reason_clean,
            "reviewed_by": current_user.id,
            "reviewed_at": now_utc.isoformat()
        })
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(app_record)
    return app_record

