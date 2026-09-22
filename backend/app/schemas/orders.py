from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class OrderCreate(BaseModel):
    product_id: str = Field(..., description="ID of the craft product")
    quantity: int = Field(default=1, ge=1, description="Quantity to purchase")


class CartItemCreate(BaseModel):
    product_id: str = Field(..., description="ID of the craft product")
    quantity: int = Field(default=1, ge=1, description="Quantity to purchase")


class CartCheckoutRequest(BaseModel):
    items: List[CartItemCreate] = Field(..., min_length=1, description="List of items in the shopping cart to checkout")


class OrderPaymentVerifyRequest(BaseModel):
    payment_id: str = Field(..., min_length=4, max_length=128, description="Payment transaction reference / ID")
    provider: str = Field(default="razorpay", max_length=64, description="Payment gateway or provider name")
    signature: Optional[str] = Field(None, max_length=256, description="Cryptographic signature from payment provider")


class OrderStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Desired order status transition")


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    customer_id: str
    artisan_id: str
    product_id: str
    product_title: str
    quantity: int
    total_price: float
    status: str
    payment_status: str = "unpaid"
    payment_id: Optional[str] = None
    payment_provider: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    product_image_url: Optional[str] = None
    craft_type: Optional[str] = None
    artisan_name: Optional[str] = None
    cluster_name: Optional[str] = None
    statutory_wage: Optional[float] = None


class CartCheckoutResponse(BaseModel):
    orders: List[OrderResponse]
    total_amount: float
    total_items: int

