import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, require_admin
from app.models.artisan_application import ArtisanApplication
from app.schemas.applications import ArtisanApplicationCreate, ArtisanApplicationResponse

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

    new_app = ArtisanApplication(
        id=f"app-{uuid.uuid4().hex[:12]}",
        user_id=current_user.id,
        craft_category=app_in.craft_category,
        experience_years=app_in.experience_years,
        state=app_in.state,
        district=app_in.district,
        status="pending",
        created_at=datetime.now(timezone.utc)
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app


@router.get("/admin/applications", response_model=List[ArtisanApplicationResponse], summary="List Pending Artisan Applications")
def list_applications_admin(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator endpoint to review artisan applications.
    """
    return db.query(ArtisanApplication).order_by(ArtisanApplication.created_at.desc()).all()


@router.post("/admin/applications/{app_id}/approve", response_model=ArtisanApplicationResponse, summary="Approve Artisan Application")
def approve_application_admin(
    app_id: str,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator endpoint to approve an artisan application.
    """
    app_record = db.query(ArtisanApplication).filter(ArtisanApplication.id == app_id).first()
    if not app_record:
        raise HTTPException(status_code=404, detail="Application not found")

    app_record.status = "approved"
    app_record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(app_record)
    return app_record
