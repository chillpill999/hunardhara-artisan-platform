from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_artisan
from app.models.earning import ArtisanEarning
from app.schemas.earnings import EarningResponse

router = APIRouter(prefix="/earnings", tags=["Artisan Earnings"])


@router.get("", response_model=List[EarningResponse], summary="List Authenticated Artisan's Earnings Ledger")
def get_artisan_earnings(
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Returns only the authenticated artisan's earnings ledger records.
    Ensures complete isolation: Artisan A cannot see Artisan B's earnings.
    Customers cannot access earnings (HTTP 403).
    """
    if current_user.is_admin:
        return db.query(ArtisanEarning).order_by(ArtisanEarning.payout_date.desc()).all()
    from app.models.artisan import Artisan
    target_ids = {current_user.id}
    artisan = db.query(Artisan).filter(
        (Artisan.id == current_user.id) | (getattr(Artisan, "user_id", Artisan.id) == current_user.id)
    ).first()
    if artisan:
        target_ids.add(artisan.id)
    return db.query(ArtisanEarning).filter(ArtisanEarning.artisan_id.in_(list(target_ids))).order_by(ArtisanEarning.payout_date.desc()).all()
