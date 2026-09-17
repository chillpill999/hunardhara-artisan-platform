import uuid
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_current_user, CurrentUser, mask_email
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord
from app.models.artisan import Artisan
from app.schemas.b2b import (
    B2BRFQCreate,
    B2BMatchResponse,
    B2BRFQResponse,
    B2BMatchRecordItem,
)
from app.services.b2b_matching_service import b2b_matching_service

logger = logging.getLogger("artisan_platform.api.b2b")
router = APIRouter(prefix="/b2b", tags=["B2B Bulk Procurement & Matchmaker"])


def _filter_buyer_email(raw_email: Optional[str], current_user: Optional[CurrentUser]) -> Optional[str]:
    """
    Zero-Exposure PII Isolation:
    Private email addresses must NEVER appear in public API responses or unauthenticated requests.
    Only authenticated administrators or the creator of the RFQ can inspect the unmasked buyer email.
    """
    if not raw_email:
        return None
    if current_user:
        if current_user.is_admin:
            return raw_email
        if current_user.email and current_user.email.strip().lower() == raw_email.strip().lower():
            return raw_email
    return None


@router.post(
    "/match",
    response_model=B2BMatchResponse,
    summary="B2B Multi-Factor Matchmaker Execution",
    description=(
        "Executes multi-factor AI matching (Craft 35%, Price 30%, Capacity 25%, Location 10%) "
        "against registered artisans and craft clusters. Evaluates solo capacity feasibility "
        "and cluster consortium fulfillment options."
    )
)
def match_b2b_rfq(
    rfq_in: B2BRFQCreate,
    db: Session = Depends(get_db)
):
    """
    R4 / A3 Acceptance Criterion:
    Evaluates buyer RFQ, calculates match percentages and capacity feasibility flags.
    """
    try:
        response = b2b_matching_service.match_rfq(rfq=rfq_in, db=db)
        return response
    except Exception as e:
        logger.error(f"B2B matchmaker error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"B2B_MATCHING_ERROR: {str(e)}"
        )


@router.post(
    "/rfq",
    response_model=B2BRFQResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and Store B2B Bulk RFQ with Matchmaker Execution"
)
def create_b2b_rfq(
    rfq_in: B2BRFQCreate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new institutional buyer RFQ, executes the multi-factor matchmaker,
    and persists matched artisan records with capacity and pricing breakdowns.
    """
    quantity = rfq_in.quantity or rfq_in.required_quantity or 1
    deadline_days = rfq_in.deadline_days or rfq_in.days_to_deadline or 30
    total_budget = round(rfq_in.unit_budget * quantity, 2)
    rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"

    # Execute matchmaker
    match_result = b2b_matching_service.match_rfq(rfq=rfq_in, db=db, rfq_id=rfq_id)

    # Determine status
    rfq_status = "MATCHED" if match_result.total_matches_found > 0 else "OPEN"

    rfq_model = B2BRFQ(
        id=rfq_id,
        buyer_name=rfq_in.buyer_name or "Procurement Buyer",
        buyer_organization=rfq_in.buyer_organization,
        buyer_email=rfq_in.buyer_email or (current_user.email if current_user else "buyer@crafts.gov.in"),
        buyer_phone=rfq_in.buyer_phone,
        craft_type=rfq_in.craft_type,
        required_quantity=quantity,
        unit_budget=rfq_in.unit_budget,
        total_budget=total_budget,
        deadline_days=deadline_days,
        delivery_state=rfq_in.delivery_state or "National",
        delivery_district=rfq_in.delivery_district or "Central",
        delivery_latitude=rfq_in.delivery_latitude if rfq_in.delivery_latitude is not None else 20.5937,
        delivery_longitude=rfq_in.delivery_longitude if rfq_in.delivery_longitude is not None else 78.9629,
        status=rfq_status,
        created_at=datetime.now(timezone.utc)
    )
    db.add(rfq_model)

    # Persist match records (verifying foreign key existence; NEVER substitute unrelated artisans)
    persisted_match_items: List[B2BMatchRecordItem] = []
    
    # Pre-fetch existing artisan IDs in database
    existing_db_artisan_ids = {a.id for a in db.query(Artisan.id).all()}

    for m in match_result.matches:
        if m.artisan_id in existing_db_artisan_ids:
            record_id = f"match-{uuid.uuid4().hex[:12]}"
            match_rec = B2BMatchRecord(
                id=record_id,
                rfq_id=rfq_id,
                artisan_id=m.artisan_id,
                match_percentage=m.match_percentage,
                score_craft=m.breakdown.craft_compatibility,
                score_price=m.breakdown.price_compatibility,
                score_capacity=m.breakdown.capacity_feasibility,
                score_location=m.breakdown.location_score,
                capacity_feasible=m.capacity_feasible,
                estimated_production_days=m.estimated_production_days,
                quoted_unit_price=m.offered_wholesale_price,
                distance_km=m.distance_km or 0.0,
                match_explanation=m.match_explanation,
                status="PROPOSED",
                created_at=datetime.now(timezone.utc)
            )
            db.add(match_rec)

            persisted_match_items.append(
                B2BMatchRecordItem(
                    id=m.artisan_id,
                    artisan_id=m.artisan_id,
                    artisan_name=m.artisan_name,
                    cluster_name=m.cluster_name,
                    match_percentage=m.match_percentage,
                    capacity_feasible=m.capacity_feasible,
                    estimated_production_days=m.estimated_production_days,
                    quoted_unit_price=m.offered_wholesale_price,
                    distance_km=m.distance_km or 0.0,
                    match_explanation=m.match_explanation,
                    scores={
                        "craft": m.breakdown.craft_compatibility,
                        "price": m.breakdown.price_compatibility,
                        "capacity": m.breakdown.capacity_feasibility,
                        "location": m.breakdown.location_score,
                    }
                )
            )

    try:
        db.commit()
        db.refresh(rfq_model)
    except Exception as e:
        db.rollback()
        logger.warning(f"Error persisting RFQ: {e}")

    return B2BRFQResponse(
        id=rfq_model.id,
        craft_type=rfq_model.craft_type,
        required_quantity=rfq_model.required_quantity,
        unit_budget=rfq_model.unit_budget,
        total_budget=rfq_model.total_budget,
        deadline_days=rfq_model.deadline_days,
        delivery_state=rfq_model.delivery_state,
        delivery_district=rfq_model.delivery_district,
        delivery_latitude=rfq_model.delivery_latitude,
        delivery_longitude=rfq_model.delivery_longitude,
        status=rfq_model.status,
        buyer_name=rfq_model.buyer_name,
        buyer_organization=rfq_model.buyer_organization,
        buyer_email=_filter_buyer_email(rfq_model.buyer_email, current_user),
        created_at=rfq_model.created_at,
        matches=persisted_match_items,
        consortium_feasible=match_result.consortium_feasible,
        consortium_option=match_result.consortium_option
    )


@router.get(
    "/rfq",
    response_model=List[B2BRFQResponse],
    summary="List B2B RFQs"
)
def list_b2b_rfqs(
    status_filter: Optional[str] = Query(None, alias="status"),
    craft_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Lists all submitted B2B buyer procurement RFQs with zero PII exposure to public users."""
    query = db.query(B2BRFQ)
    if status_filter:
        query = query.filter(B2BRFQ.status == status_filter.upper())
    if craft_type:
        query = query.filter(B2BRFQ.craft_type.ilike(f"%{craft_type}%"))

    rfqs = query.order_by(B2BRFQ.created_at.desc()).offset(offset).limit(limit).all()
    results = []
    for r in rfqs:
        results.append(
            B2BRFQResponse(
                id=r.id,
                craft_type=r.craft_type,
                required_quantity=r.required_quantity,
                unit_budget=r.unit_budget,
                total_budget=r.total_budget,
                deadline_days=r.deadline_days,
                delivery_state=r.delivery_state,
                delivery_district=r.delivery_district,
                delivery_latitude=r.delivery_latitude,
                delivery_longitude=r.delivery_longitude,
                status=r.status,
                buyer_name=r.buyer_name,
                buyer_organization=r.buyer_organization,
                buyer_email=_filter_buyer_email(r.buyer_email, current_user),
                created_at=r.created_at,
                matches=[]
            )
        )
    return results


@router.get(
    "/rfq/{rfq_id}",
    response_model=B2BRFQResponse,
    summary="Get B2B RFQ with Matchmaker Results"
)
def get_b2b_rfq(
    rfq_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves stored RFQ by ID along with ranked artisan matches and consortium evaluation.
    Enforces Zero-Exposure PII isolation for buyer contact details.
    """
    rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ with ID '{rfq_id}' not found."
        )

    # Re-evaluate live matches to provide enriched breakdown
    temp_rfq = B2BRFQCreate(
        craft_type=rfq.craft_type,
        quantity=rfq.required_quantity,
        unit_budget=rfq.unit_budget,
        deadline_days=rfq.deadline_days,
        delivery_latitude=rfq.delivery_latitude,
        delivery_longitude=rfq.delivery_longitude
    )
    match_result = b2b_matching_service.match_rfq(rfq=temp_rfq, db=db, rfq_id=rfq.id)

    match_items: List[B2BMatchRecordItem] = []
    for m in match_result.matches:
        match_items.append(
            B2BMatchRecordItem(
                id=m.artisan_id,
                artisan_id=m.artisan_id,
                artisan_name=m.artisan_name,
                cluster_name=m.cluster_name,
                match_percentage=m.match_percentage,
                capacity_feasible=m.capacity_feasible,
                estimated_production_days=m.estimated_production_days,
                quoted_unit_price=m.offered_wholesale_price,
                distance_km=m.distance_km or 0.0,
                match_explanation=m.match_explanation,
                scores={
                    "craft": m.breakdown.craft_compatibility,
                    "price": m.breakdown.price_compatibility,
                    "capacity": m.breakdown.capacity_feasibility,
                    "location": m.breakdown.location_score,
                }
            )
        )

    return B2BRFQResponse(
        id=rfq.id,
        craft_type=rfq.craft_type,
        required_quantity=rfq.required_quantity,
        unit_budget=rfq.unit_budget,
        total_budget=rfq.total_budget,
        deadline_days=rfq.deadline_days,
        delivery_state=rfq.delivery_state,
        delivery_district=rfq.delivery_district,
        delivery_latitude=rfq.delivery_latitude,
        delivery_longitude=rfq.delivery_longitude,
        status=rfq.status,
        buyer_name=rfq.buyer_name,
        buyer_organization=rfq.buyer_organization,
        buyer_email=_filter_buyer_email(rfq.buyer_email, current_user),
        created_at=rfq.created_at,
        matches=match_items,
        consortium_feasible=match_result.consortium_feasible,
        consortium_option=match_result.consortium_option
    )


@router.delete(
    "/rfq/{rfq_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete/Withdraw B2B RFQ"
)
def delete_b2b_rfq(
    rfq_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Withdraws or deletes an RFQ with strict ownership verification:
    Only the creating organization (matching email) or a verified administrator can delete an RFQ.
    """
    rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ with ID '{rfq_id}' not found."
        )

    is_owner = bool(current_user.email and current_user.email.strip().lower() == rfq.buyer_email.strip().lower())
    if not current_user.is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to delete this RFQ."
        )

    db.delete(rfq)
    db.commit()
    return {"status": "deleted", "id": rfq_id}

