from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class InquiryCreate(BaseModel):
    product_id: Optional[str] = None
    product_title: str = Field(..., min_length=1, max_length=256)
    product_image: Optional[str] = None
    artisan_id: Optional[str] = None
    artisan_name: Optional[str] = None
    customer_name: str = Field(..., min_length=1, max_length=256)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    inquiry_type: str = Field(default="general", max_length=64)
    message: str = Field(..., min_length=1)
    quantity: Optional[int] = None


class InquiryStatusUpdate(BaseModel):
    status: str = Field(..., description="Status: new, replied, closed")


class InquiryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: Optional[str] = None
    product_title: str
    product_image: Optional[str] = None
    artisan_id: Optional[str] = None
    artisan_name: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    inquiry_type: str = "general"
    message: str
    quantity: Optional[int] = None
    status: str = "new"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
