from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class EarningResponse(BaseModel):
    id: str
    artisan_id: str
    order_id: str
    order_type: str
    product_title: str
    quantity: int
    gross_amount: float
    materials_cost: float
    artisan_wage_payout: float
    middleman_saved: float
    status: str
    payout_date: Optional[datetime] = None

    class Config:
        from_attributes = True
