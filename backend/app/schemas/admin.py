from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class PlatformSettingsUpdate(BaseModel):
    marketplace_enabled: Optional[bool] = None
    artisan_onboarding_enabled: Optional[bool] = None
    product_publishing_enabled: Optional[bool] = None
    b2b_enabled: Optional[bool] = None
    orders_enabled: Optional[bool] = None
    ai_catalog_enabled: Optional[bool] = None
    voice_catalog_enabled: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None


class PlatformSettingsResponse(BaseModel):
    marketplace_enabled: bool = True
    artisan_onboarding_enabled: bool = True
    product_publishing_enabled: bool = True
    b2b_enabled: bool = True
    orders_enabled: bool = True
    ai_catalog_enabled: bool = True
    voice_catalog_enabled: bool = True
    maintenance_mode: bool = False
    maintenance_message: str = "Platform maintenance in progress."


class PlatformOverviewMetricsResponse(BaseModel):
    active_users: int
    active_artisans: int
    total_artisans: int
    pending_applications: int
    active_products: int
    total_products: int
    total_orders: int
    total_revenue: float
    open_rfqs: int
    suspended_accounts: int
    system_health: str
    switches: Dict[str, Any]
    security_warnings: List[str] = []


class AdminArtisanItem(BaseModel):
    id: str
    full_name: str
    phone_number: str
    state: str
    district: str
    primary_craft: str
    cluster_id: Optional[str] = None
    cluster_name: Optional[str] = None
    is_active: bool
    products_count: int = 0
    gi_verified: bool = False
    created_at: Optional[str] = None


class AdminArtisanVerifyGIRequest(BaseModel):
    verified: bool = True
    gi_registration_name: Optional[str] = None
    gi_reference: Optional[str] = None


class AdminSuspendRequest(BaseModel):
    reason: Optional[str] = Field(default="Administrative suspension by Super Administrator")


class AdminProductItem(BaseModel):
    id: str
    title: str
    artisan_id: str
    artisan_name: Optional[str] = None
    craft_type: str
    listing_price: float
    floor_price: float
    stock_quantity: int
    is_active: bool
    studio_image_url: Optional[str] = None
    created_at: Optional[str] = None


class AdminProductModerateRequest(BaseModel):
    action: str = Field(..., description="'publish', 'unpublish', 'flag', or 'remove'")
    reason: str = Field(..., description="Mandatory reason for moderation action")


class AdminClusterWageUpdateRequest(BaseModel):
    statutory_daily_wage: float = Field(..., gt=0, description="Daily wage for 8-hour shift in INR")
    statutory_hourly_wage: Optional[float] = Field(None, gt=0, description="Optional hourly wage in INR (defaults to daily / 8)")


class AdminOrderItem(BaseModel):
    id: str
    order_number: str
    customer_id: str
    artisan_id: str
    product_id: str
    product_title: str
    quantity: int
    total_price: float
    status: str
    payment_status: str
    created_at: Optional[str] = None


class AdminOrderStatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    note: Optional[str] = None


class AdminB2BRFQItem(BaseModel):
    id: str
    buyer_name: str
    buyer_organization: Optional[str] = None
    buyer_email: str
    craft_type: str
    required_quantity: int
    unit_budget: float
    total_budget: float
    deadline_days: int
    delivery_state: Optional[str] = None
    status: str
    matches_count: int = 0
    created_at: Optional[str] = None


class AdminB2BStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="'OPEN', 'MATCHED', 'FULFILLED', 'CLOSED', or 'REVIEW'")
    note: Optional[str] = None


class AdminPlatformUserItem(BaseModel):
    id: str
    email: Optional[str] = None
    role: str
    is_suspended: bool = False
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None
