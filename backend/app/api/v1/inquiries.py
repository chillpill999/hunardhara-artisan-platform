import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, get_optional_current_user, require_artisan
from app.models.inquiry import ArtisanInquiry
from app.models.artisan import Artisan
from app.schemas.inquiries import InquiryCreate, InquiryResponse, InquiryStatusUpdate

router = APIRouter(prefix="/inquiries", tags=["Inquiries"])


@router.post("", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
def create_inquiry(
    inquiry_in: InquiryCreate,
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    """
    Submits a new customer inquiry for an artisan's craft/product.
    Stores the inquiry directly in PostgreSQL as the single source of truth.
    """
    customer_name = inquiry_in.customer_name
    customer_email = inquiry_in.customer_email
    customer_phone = inquiry_in.customer_phone

    if current_user:
        if not customer_email:
            customer_email = current_user.email
        if not customer_name and current_user.email:
            customer_name = current_user.email.split("@")[0]

    # Resolve artisan_name if artisan_id provided but name omitted
    artisan_name = inquiry_in.artisan_name
    if inquiry_in.artisan_id and not artisan_name:
        artisan = db.query(Artisan).filter(
            (Artisan.id == inquiry_in.artisan_id) | (Artisan.user_id == inquiry_in.artisan_id)
        ).first()
        if artisan:
            artisan_name = artisan.full_name

    new_inquiry = ArtisanInquiry(
        id=str(uuid.uuid4()),
        product_id=inquiry_in.product_id,
        product_title=inquiry_in.product_title,
        product_image=inquiry_in.product_image,
        artisan_id=inquiry_in.artisan_id,
        artisan_name=artisan_name,
        customer_name=customer_name or "Anonymous Buyer",
        customer_phone=customer_phone,
        customer_email=customer_email,
        inquiry_type=inquiry_in.inquiry_type or "general",
        message=inquiry_in.message,
        quantity=inquiry_in.quantity,
        status="new",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    db.add(new_inquiry)
    db.commit()
    db.refresh(new_inquiry)
    return new_inquiry


@router.get("/artisan", response_model=List[InquiryResponse])
def get_artisan_inquiries(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    artisan_id_override: Optional[str] = Query(None, description="Optional artisan identifier filter"),
):
    """
    Retrieves inquiries for the authenticated artisan.
    Matches against artisan user_id, artisan database id, or registered email.
    """
    query = db.query(ArtisanInquiry)

    target_ids = {current_user.id}
    if current_user.email:
        target_ids.add(current_user.email.lower())

    # Check if artisan record exists for this user
    artisan = db.query(Artisan).filter(
        (Artisan.id == current_user.id) | (getattr(Artisan, "user_id", Artisan.id) == current_user.id)
    ).first()
    if artisan:
        target_ids.add(str(artisan.id))

    if artisan_id_override:
        target_ids.add(artisan_id_override.strip().lower())

    conditions = [ArtisanInquiry.artisan_id.in_(list(target_ids))]
    if current_user.email:
        conditions.append(ArtisanInquiry.artisan_id.ilike(f"%{current_user.email}%"))

    # Also show general inquiries if no specific matches found
    inquiries = query.filter(
        ArtisanInquiry.artisan_id.in_(list(target_ids))
    ).order_by(ArtisanInquiry.created_at.desc()).all()

    # If user has no artisan-specific inquiries yet, return any inquiries matching email or general ones
    if not inquiries:
        inquiries = db.query(ArtisanInquiry).order_by(ArtisanInquiry.created_at.desc()).limit(50).all()

    return inquiries


@router.patch("/{inquiry_id}/status", response_model=InquiryResponse)
def update_inquiry_status(
    inquiry_id: str,
    status_update: InquiryStatusUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Updates the status of an inquiry (e.g., 'replied', 'closed').
    """
    inquiry = db.query(ArtisanInquiry).filter(ArtisanInquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquiry not found",
        )

    inquiry.status = status_update.status
    inquiry.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inquiry)
    return inquiry


@router.delete("/{inquiry_id}", status_code=status.HTTP_200_OK)
def delete_inquiry(
    inquiry_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Deletes an inquiry record.
    """
    inquiry = db.query(ArtisanInquiry).filter(ArtisanInquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquiry not found",
        )

    db.delete(inquiry)
    db.commit()
    return {"success": True, "message": "Inquiry deleted successfully", "id": inquiry_id}
