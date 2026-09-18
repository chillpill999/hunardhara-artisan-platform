import uuid
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_current_user, CurrentUser, RateLimiter
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord
from app.models.artisan import Artisan
from app.schemas.b2b import (
    B2BRFQCreate,
    B2BMatchResponse,
    B2BRFQResponse,
    B2BMatchRecordItem,
    B2BRFQUpdateRequest,
    B2BMatchStatusUpdateRequest,
)
from app.services.b2b_matching_service import b2b_matching_service

logger = logging.getLogger("artisan_platform.api.b2b")
router = APIRouter(prefix="/b2b", tags=["B2B Bulk Procurement & Matchmaker"])


def _filter_buyer_email(
    raw_email: Optional[str],
    current_user: Optional[CurrentUser],
    buyer_id: Optional[str] = None
) -> Optional[str]:
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
        if buyer_id and current_user.id == buyer_id:
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
        "and cluster consortium fulfillment options. Requires authentication."
    ),
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="b2b_match"))]
)
def match_b2b_rfq(
    rfq_in: B2BRFQCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    R4 / A3 Acceptance Criterion:
    Evaluates buyer RFQ, calculates match percentages and capacity feasibility flags.
    Requires authentication. If requested_artisan_id is provided, verifies it exists and is active.
    """
    if rfq_in.requested_artisan_id:
        target_artisan = db.query(Artisan).filter(
            Artisan.id == rfq_in.requested_artisan_id,
            Artisan.is_active == True
        ).first()
        if not target_artisan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ARTISAN_NOT_FOUND: Requested artisan '{rfq_in.requested_artisan_id}' does not exist or is inactive."
            )

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
    summary="Create and Store B2B Bulk RFQ with Matchmaker Execution",
    dependencies=[Depends(RateLimiter(max_requests=20, window_seconds=60, prefix="b2b_rfq"))]
)
def create_b2b_rfq(
    rfq_in: B2BRFQCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new institutional buyer RFQ, executes the multi-factor matchmaker,
    and persists matched artisan records with capacity and pricing breakdowns.
    Requires authentication. Locks buyer identity to verified DB / token credentials.
    """
    quantity = rfq_in.quantity or rfq_in.required_quantity or 0
    if quantity < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_QUANTITY: Required quantity must be at least 1."
        )
    if rfq_in.unit_budget <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_BUDGET: Unit budget must be greater than zero."
        )
    deadline_days = rfq_in.deadline_days or rfq_in.days_to_deadline or 0
    if deadline_days < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_DEADLINE: Deadline days must be at least 1."
        )

    # Validate craft_type
    if not rfq_in.craft_type or not rfq_in.craft_type.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_CRAFT_TYPE: Craft type must be a non-empty string."
        )

    # Verify requested artisan existence without substitution
    if rfq_in.requested_artisan_id:
        target_artisan = db.query(Artisan).filter(
            Artisan.id == rfq_in.requested_artisan_id,
            Artisan.is_active == True
        ).first()
        if not target_artisan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ARTISAN_NOT_FOUND: Requested artisan '{rfq_in.requested_artisan_id}' does not exist or is inactive."
            )

    # Prevent buyer impersonation: authenticated non-admins are strictly bound to their verified credentials
    buyer_id = current_user.id
    if current_user.is_admin:
        effective_buyer_email = rfq_in.buyer_email or current_user.email or "admin@hunardhara.gov.in"
        effective_buyer_name = rfq_in.buyer_name or "Procurement Administrator"
    else:
        effective_buyer_email = current_user.email
        effective_buyer_name = rfq_in.buyer_name or (current_user.email.split("@")[0].title() if current_user.email else "Verified Buyer")

    total_budget = round(rfq_in.unit_budget * quantity, 2)
    rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"

    # Execute matchmaker
    match_result = b2b_matching_service.match_rfq(rfq=rfq_in, db=db, rfq_id=rfq_id)

    # Determine status
    rfq_status = "MATCHED" if match_result.total_matches_found > 0 else "OPEN"

    rfq_model = B2BRFQ(
        id=rfq_id,
        buyer_id=buyer_id,
        buyer_name=effective_buyer_name,
        buyer_organization=rfq_in.buyer_organization,
        buyer_email=effective_buyer_email,
        buyer_phone=rfq_in.buyer_phone,
        craft_type=rfq_in.craft_type,
        required_quantity=quantity,
        unit_budget=rfq_in.unit_budget,
        total_budget=total_budget,
        deadline_days=deadline_days,
        delivery_state=rfq_in.delivery_state,
        delivery_district=rfq_in.delivery_district,
        delivery_latitude=rfq_in.delivery_latitude,
        delivery_longitude=rfq_in.delivery_longitude,
        status=rfq_status,
        created_at=datetime.now(timezone.utc)
    )
    db.add(rfq_model)

    # Persist match records (verifying foreign key existence; NEVER substitute unrelated artisans)
    persisted_match_items: List[B2BMatchRecordItem] = []
    existing_db_artisan_ids = {a.id for a in db.query(Artisan.id).filter(Artisan.is_active == True).all()}

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
                    id=record_id,
                    artisan_id=m.artisan_id,
                    artisan_name=m.artisan_name,
                    cluster_name=m.cluster_name,
                    match_percentage=m.match_percentage,
                    capacity_feasible=m.capacity_feasible,
                    estimated_production_days=m.estimated_production_days,
                    quoted_unit_price=m.offered_wholesale_price,
                    distance_km=m.distance_km or 0.0,
                    match_explanation=m.match_explanation,
                    status="PROPOSED",
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
        buyer_id=rfq_model.buyer_id,
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
        buyer_email=_filter_buyer_email(rfq_model.buyer_email, current_user, rfq_model.buyer_id),
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
                buyer_id=r.buyer_id,
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
                buyer_email=_filter_buyer_email(r.buyer_email, current_user, r.buyer_id),
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

    # First check persisted matches
    db_matches = db.query(B2BMatchRecord).filter(B2BMatchRecord.rfq_id == rfq.id).all()
    match_items: List[B2BMatchRecordItem] = []
    consortium_feasible = False
    consortium_option = None

    if db_matches:
        for dm in db_matches:
            artisan = dm.artisan
            cluster = artisan.cluster if artisan else None
            match_items.append(
                B2BMatchRecordItem(
                    id=dm.id,
                    artisan_id=dm.artisan_id,
                    artisan_name=artisan.full_name if artisan else "Artisan",
                    cluster_name=cluster.name if cluster else "Cluster",
                    match_percentage=dm.match_percentage,
                    capacity_feasible=dm.capacity_feasible,
                    estimated_production_days=dm.estimated_production_days,
                    quoted_unit_price=dm.quoted_unit_price,
                    distance_km=dm.distance_km or 0.0,
                    match_explanation=dm.match_explanation,
                    status=dm.status,
                    scores={
                        "craft": dm.score_craft,
                        "price": dm.score_price,
                        "capacity": dm.score_capacity,
                        "location": dm.score_location,
                    }
                )
            )
    else:
        # Re-evaluate live matches if no persisted matches exist
        temp_rfq = B2BRFQCreate(
            craft_type=rfq.craft_type,
            quantity=rfq.required_quantity,
            unit_budget=rfq.unit_budget,
            deadline_days=rfq.deadline_days,
            delivery_latitude=rfq.delivery_latitude,
            delivery_longitude=rfq.delivery_longitude
        )
        match_result = b2b_matching_service.match_rfq(rfq=temp_rfq, db=db, rfq_id=rfq.id)
        consortium_feasible = match_result.consortium_feasible
        consortium_option = match_result.consortium_option
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
                    status="PROPOSED",
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
        buyer_id=rfq.buyer_id,
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
        buyer_email=_filter_buyer_email(rfq.buyer_email, current_user, rfq.buyer_id),
        created_at=rfq.created_at,
        matches=match_items,
        consortium_feasible=consortium_feasible,
        consortium_option=consortium_option
    )


@router.put(
    "/rfq/{rfq_id}",
    response_model=B2BRFQResponse,
    summary="Update B2B RFQ Details or Status"
)
def update_b2b_rfq(
    rfq_id: str,
    update_in: B2BRFQUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates an RFQ with strict ownership verification:
    Only the buyer who created the RFQ or an administrator can modify it.
    """
    rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ with ID '{rfq_id}' not found."
        )

    is_owner = (
        (rfq.buyer_id and current_user.id == rfq.buyer_id) or
        (current_user.email and rfq.buyer_email and current_user.email.strip().lower() == rfq.buyer_email.strip().lower())
    )
    if not current_user.is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to update this RFQ."
        )

    if update_in.status is not None:
        allowed_statuses = {"OPEN", "MATCHED", "IN_NEGOTIATION", "FULFILLED", "CLOSED", "CANCELLED"}
        if update_in.status.upper() not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"INVALID_STATUS: Status must be one of {sorted(allowed_statuses)}"
            )
        rfq.status = update_in.status.upper()

    if update_in.unit_budget is not None:
        if update_in.unit_budget <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_BUDGET: Unit budget must be > 0.")
        rfq.unit_budget = update_in.unit_budget

    if update_in.required_quantity is not None:
        if update_in.required_quantity < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_QUANTITY: Quantity must be >= 1.")
        rfq.required_quantity = update_in.required_quantity

    rfq.total_budget = round(rfq.unit_budget * rfq.required_quantity, 2)

    if update_in.deadline_days is not None:
        if update_in.deadline_days < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_DEADLINE: Deadline days must be >= 1.")
        rfq.deadline_days = update_in.deadline_days

    if update_in.delivery_state is not None:
        rfq.delivery_state = update_in.delivery_state
    if update_in.delivery_district is not None:
        rfq.delivery_district = update_in.delivery_district

    db.commit()
    db.refresh(rfq)

    return B2BRFQResponse(
        id=rfq.id,
        buyer_id=rfq.buyer_id,
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
        buyer_email=_filter_buyer_email(rfq.buyer_email, current_user, rfq.buyer_id),
        created_at=rfq.created_at,
        matches=[]
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
    Only the creating buyer or a verified administrator can delete an RFQ.
    """
    rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ with ID '{rfq_id}' not found."
        )

    is_owner = (
        (rfq.buyer_id and current_user.id == rfq.buyer_id) or
        (current_user.email and rfq.buyer_email and current_user.email.strip().lower() == rfq.buyer_email.strip().lower())
    )
    if not current_user.is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to delete this RFQ."
        )

    db.delete(rfq)
    db.commit()
    return {"status": "deleted", "id": rfq_id}


@router.put(
    "/matches/{match_id}/status",
    summary="Update B2B Match Record Status (Artisan acceptance/rejection or Buyer update)"
)
def update_match_status(
    match_id: str,
    body: B2BMatchStatusUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the status of a match record (e.g. ACCEPTED, REJECTED, IN_REVIEW).
    Strict ownership verification:
    Only the matched artisan, the creating buyer, or an administrator can update.
    """
    match_rec = db.query(B2BMatchRecord).filter(B2BMatchRecord.id == match_id).first()
    if not match_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MATCH_NOT_FOUND: Match record '{match_id}' not found."
        )

    # Ownership check
    is_artisan = (current_user.id == match_rec.artisan_id)
    is_buyer = bool(
        match_rec.rfq and (
            (match_rec.rfq.buyer_id and current_user.id == match_rec.rfq.buyer_id) or
            (current_user.email and match_rec.rfq.buyer_email and current_user.email.strip().lower() == match_rec.rfq.buyer_email.strip().lower())
        )
    )
    if not current_user.is_admin and not is_artisan and not is_buyer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to update this match record."
        )

    allowed = {"PROPOSED", "ACCEPTED", "REJECTED", "IN_REVIEW"}
    new_status = body.status.upper()
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_MATCH_STATUS: Status must be one of {sorted(allowed)}"
        )

    match_rec.status = new_status
    db.commit()
    db.refresh(match_rec)

    return {
        "status": "success",
        "match_id": match_rec.id,
        "new_status": match_rec.status,
        "artisan_id": match_rec.artisan_id,
        "rfq_id": match_rec.rfq_id
    }


@router.get(
    "/artisan/matches",
    response_model=List[B2BMatchRecordItem],
    summary="List Matches Directed to the Authenticated Artisan"
)
def list_artisan_matches(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists match opportunities directed to the authenticated artisan.
    Strictly protects buyer PII while presenting order parameters.
    """
    query = db.query(B2BMatchRecord)
    if not current_user.is_admin:
        query = query.filter(B2BMatchRecord.artisan_id == current_user.id)

    matches = query.order_by(B2BMatchRecord.created_at.desc()).all()
    results = []
    for m in matches:
        artisan = m.artisan
        cluster = artisan.cluster if artisan else None
        results.append(
            B2BMatchRecordItem(
                id=m.id,
                artisan_id=m.artisan_id,
                artisan_name=artisan.full_name if artisan else None,
                cluster_name=cluster.name if cluster else None,
                match_percentage=m.match_percentage,
                capacity_feasible=m.capacity_feasible,
                estimated_production_days=m.estimated_production_days,
                quoted_unit_price=m.quoted_unit_price,
                distance_km=m.distance_km or 0.0,
                match_explanation=m.match_explanation,
                status=m.status,
                scores={
                    "craft": m.score_craft,
                    "price": m.score_price,
                    "capacity": m.score_capacity,
                    "location": m.score_location,
                }
            )
        )
    return results
