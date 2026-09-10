from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class OrderCreate(BaseModel):
    product_id: str = Field(..., description="ID of the craft product")
    quantity: int = Field(default=1, ge=1, description="Quantity to purchase")


class OrderResponse(BaseModel):
    id: str
    order_number: str
    customer_id: str
    artisan_id: str
    product_id: str
    product_title: str
    quantity: int
    total_price: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
