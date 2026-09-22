import logging
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, get_optional_current_user, require_artisan
from app.models.artisan import Artisan
from app.schemas.artisan import ArtisanResponse, ArtisanPublicProfile, ArtisanUpdate

logger = logging.getLogger("artisan_platform.api.artisans")
router = APIRouter(prefix="/artisans", tags=["Artisans & Profiles"])


@router.get("", response_model=List[ArtisanPublicProfile], summary="List Public Artisan Profiles")
def list_artisans(
    craft_type: Optional[str] = Query(None, description="Filter by craft category"),
    cluster_id: Optional[str] = Query(None, description="Filter by craft cluster"),
    state: Optional[str] = Query(None, description="Filter by state"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Public Artisan Directory:
    Returns sanitized public artisan profiles with zero personal data leakage
    (no phone numbers, no Aadhaar, no exact GPS coordinates, no caste/social category).
    Only active artisans are included.
    """
    query = db.query(Artisan).filter(Artisan.is_active == True)
    if craft_type:
        query = query.filter(Artisan.primary_craft.ilike(f"%{craft_type}%"))
    if cluster_id:
        query = query.filter(Artisan.cluster_id == cluster_id)
    if state:
        query = query.filter(Artisan.state.ilike(f"%{state}%"))

    artisans = query.order_by(Artisan.full_name.asc()).offset(offset).limit(limit).all()
    results = []
    for a in artisans:
        cluster_name = a.cluster.name if a.cluster else None
        results.append(
            ArtisanPublicProfile(
                id=a.id,
                full_name=a.full_name,
                primary_craft=a.primary_craft,
                cluster_name=cluster_name,
                cluster_id=a.cluster_id,
                state=a.state,
                district=a.district,
                experience_years=a.experience_years or 0,
                profile_photo_url=a.profile_photo_url,
                preferred_language=a.preferred_language or "hi"
            )
        )
    return results


@router.get("/me", response_model=ArtisanResponse, summary="Get Authenticated Artisan's Full Profile")
def get_my_artisan_profile(
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Private Profile Endpoint:
    Returns the authenticated artisan's full profile including production capacity,
    cluster wage baselines, and masked Aadhaar.
    Strictly restricted to the account owner or an administrator.
    """
    artisan = db.query(Artisan).filter(Artisan.id == current_user.id).first()
    if not artisan or not artisan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ARTISAN_NOT_FOUND: No active artisan profile found for this account."
        )
    return artisan


@router.put("/me", response_model=ArtisanResponse, summary="Update Authenticated Artisan's Profile")
def update_my_artisan_profile(
    update_in: ArtisanUpdate,
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Self-service Artisan Profile Update:
    Enforces strict ownership: only updates the authenticated artisan's own profile.
    Critical cryptographic keys (Aadhaar hash, cluster baseline, primary craft) cannot be tampered with.
    """
    artisan = db.query(Artisan).filter(Artisan.id == current_user.id).first()
    if not artisan or not artisan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ARTISAN_NOT_FOUND: No active artisan profile found."
        )

    update_data = update_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        if val is not None:
            setattr(artisan, key, val)

    db.commit()
    db.refresh(artisan)
    return artisan


@router.get("/{artisan_id}", summary="Get Artisan Profile (Role-Scoped PII Isolation)")
def get_artisan_by_id(
    artisan_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Context-Aware Artisan Profile:
    - If caller is the owning artisan or an administrator: returns full profile (ArtisanResponse).
    - If caller is an unauthenticated user or unrelated consumer: returns sanitized ArtisanPublicProfile
      with zero phone, Aadhaar, GPS, or social category exposure.
    """
    artisan = db.query(Artisan).filter(Artisan.id == artisan_id).first()
    if not artisan or not artisan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artisan with ID '{artisan_id}' not found."
        )

    is_owner_or_admin = current_user and (current_user.is_admin or current_user.id == artisan.id)

    if is_owner_or_admin:
        return ArtisanResponse.model_validate(artisan)

    cluster_name = artisan.cluster.name if artisan.cluster else None
    return ArtisanPublicProfile(
        id=artisan.id,
        full_name=artisan.full_name,
        primary_craft=artisan.primary_craft,
        cluster_name=cluster_name,
        cluster_id=artisan.cluster_id,
        state=artisan.state,
        district=artisan.district,
        experience_years=artisan.experience_years or 0,
        profile_photo_url=artisan.profile_photo_url,
        preferred_language=artisan.preferred_language or "hi"
    )
