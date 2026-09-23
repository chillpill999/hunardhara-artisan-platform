import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.core.security import (
    CurrentUser,
    get_current_user,
    get_optional_current_user,
    require_admin,
    require_super_admin,
    RateLimiter
)
from app.models.system_setting import SystemSetting
from app.models.admin_audit_log import AdminAuditLog
from app.models.artisan import Artisan
from app.models.artisan_application import ArtisanApplication
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.models.order import Order
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord
from app.models.deactivated_user import DeactivatedUser
from app.services.supabase_admin import supabase_admin
from app.services.platform_settings_service import platform_settings_service
from app.schemas.admin import (
    PlatformSettingsUpdate,
    PlatformSettingsResponse,
    PlatformOverviewMetricsResponse,
    AdminArtisanItem,
    AdminArtisanVerifyGIRequest,
    AdminSuspendRequest,
    AdminProductItem,
    AdminProductModerateRequest,
    AdminClusterWageUpdateRequest,
    AdminOrderItem,
    AdminOrderStatusUpdateRequest,
    AdminB2BRFQItem,
    AdminB2BStatusUpdateRequest,
    AdminPlatformUserItem,
)

logger = logging.getLogger("artisan_platform.api.admin")

router = APIRouter(prefix="/admin", tags=["Administrative & Super Admin Console"])


class BootstrapRequest(BaseModel):
    email: Optional[str] = None


class BootstrapResponse(BaseModel):
    success: bool
    bootstrapped: bool
    message: str
    email: Optional[str] = None
    role: Optional[str] = None


class BootstrapStatusResponse(BaseModel):
    bootstrapped: bool
    super_admin_email: Optional[str] = None


class AdminUserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    role: str
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    action: str
    actor_id: str
    actor_email: Optional[str] = None
    target_user_id: Optional[str] = None
    details: Optional[str] = None
    created_at: str


# =========================================================================
# 1. BOOTSTRAP & SYSTEM HEALTH
# =========================================================================

@router.get(
    "/bootstrap-status",
    response_model=BootstrapStatusResponse,
    summary="Check Super Admin Bootstrap Status",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="bootstrap_status"))]
)
def get_bootstrap_status(db: Session = Depends(get_db)):
    """
    Public diagnostic endpoint: Reports whether the platform's initial Super Admin
    has been bootstrapped.
    """
    setting = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_bootstrapped").first()
    is_bootstrapped = bool(setting and setting.value == "true")
    email_setting = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_email").first()
    email_val = email_setting.value if is_bootstrapped and email_setting else None

    return BootstrapStatusResponse(
        bootstrapped=is_bootstrapped,
        super_admin_email=email_val
    )


@router.post(
    "/bootstrap-super-admin",
    response_model=BootstrapResponse,
    summary="One-Time Super Admin Bootstrap",
    dependencies=[Depends(RateLimiter(max_requests=5, window_seconds=60, prefix="bootstrap_super_admin"))]
)
def bootstrap_super_admin(
    payload: Optional[BootstrapRequest] = None,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Idempotent One-Time Super Admin Bootstrap:
    1. Checks if a Super Admin is already provisioned in the database.
       If yes -> immediately returns HTTP 409 Conflict.
    2. Verifies that the target email matches the designated initial identity:
       'aryanrockstar2007@gmail.com'. Rejects all other emails with HTTP 403.
    3. Provisions 'super_admin' role in Supabase Auth app_metadata via trusted server API.
    4. Permanently locks the bootstrap mechanism in system settings and logs audit trail.
    """
    # 1. Lockout check
    existing = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_bootstrapped").first()
    if existing and existing.value == "true":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SUPER_ADMIN_ALREADY_EXISTS: A Super Admin has already been provisioned. The bootstrap system is permanently locked."
        )

    target_email = (
        (current_user.email if current_user and current_user.email else None)
        or (payload.email if payload and payload.email else None)
        or settings.INITIAL_SUPER_ADMIN_EMAIL
    )
    target_email_clean = str(target_email).strip().lower()

    if target_email_clean != settings.INITIAL_SUPER_ADMIN_EMAIL.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"BOOTSTRAP_UNAUTHORIZED: Initial bootstrap is strictly restricted to the designated administrative identity ({settings.INITIAL_SUPER_ADMIN_EMAIL})."
        )

    # Resolve user_id from Supabase Admin API, active session, or deterministic identifier
    user_id = None
    supabase_user = supabase_admin.get_user_by_email(target_email_clean)
    if supabase_user and supabase_user.get("id"):
        user_id = str(supabase_user.get("id"))
    elif current_user and current_user.id:
        user_id = current_user.id
    else:
        user_id = f"sa-{target_email_clean.split('@')[0]}"

    # Server-side Supabase role assignment
    supabase_admin.set_user_role(user_id, "super_admin")

    # Lock bootstrap and record audit log
    db.merge(SystemSetting(key="super_admin_bootstrapped", value="true"))
    db.merge(SystemSetting(key="super_admin_user_id", value=user_id))
    db.merge(SystemSetting(key="super_admin_email", value=target_email_clean))
    db.merge(SystemSetting(key="super_admin_bootstrapped_at", value=datetime.now(timezone.utc).isoformat()))

    audit_entry = AdminAuditLog(
        action="BOOTSTRAP_SUPER_ADMIN",
        actor_id=user_id,
        actor_email=target_email_clean,
        target_user_id=user_id,
        details=json.dumps({
            "action": "super_admin_bootstrap",
            "email": target_email_clean,
            "role": "super_admin"
        })
    )
    db.add(audit_entry)
    db.commit()

    logger.info(f"Super Admin bootstrap completed for {target_email_clean} ({user_id})")

    return BootstrapResponse(
        success=True,
        bootstrapped=True,
        message=f"Super Admin role successfully provisioned for {target_email_clean}.",
        email=target_email_clean,
        role="super_admin"
    )


# =========================================================================
# 2. PLATFORM SWITCHES & EMERGENCY CONTROLS
# =========================================================================

@router.get(
    "/platform-settings",
    response_model=PlatformSettingsResponse,
    summary="Retrieve Platform Emergency Switches (Admin / Super Admin)"
)
def get_platform_settings(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Returns current state of all 9 persistent platform switches."""
    return platform_settings_service.get_settings(db)


@router.patch(
    "/platform-settings",
    response_model=PlatformSettingsResponse,
    summary="Update Platform Emergency Switches (Super Admin Only)"
)
def update_platform_settings(
    payload: PlatformSettingsUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to toggle emergency platform switches.
    Records structured audit log with previous and new states.
    """
    raw_updates = payload.model_dump(exclude_unset=True)
    if not raw_updates:
        return platform_settings_service.get_settings(db)

    updated = platform_settings_service.update_settings(
        db=db,
        updates=raw_updates,
        actor_id=current_user.id,
        actor_email=current_user.email
    )
    return updated


# =========================================================================
# 3. PLATFORM OVERVIEW METRICS
# =========================================================================

@router.get(
    "/overview-metrics",
    response_model=PlatformOverviewMetricsResponse,
    summary="Retrieve Real-Time Platform Overview Metrics (Admin / Super Admin)"
)
def get_overview_metrics(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Computes real-time platform metrics directly from the authoritative database:
    active artisans, pending applications, active products, revenue, open RFQs,
    suspended accounts, and active security warnings.
    """
    active_artisans = db.query(Artisan).filter(Artisan.is_active == True).count()
    total_artisans = db.query(Artisan).count()
    pending_applications = db.query(ArtisanApplication).filter(ArtisanApplication.status == "pending").count()
    active_products = db.query(Product).filter(Product.is_active == True).count()
    total_products = db.query(Product).count()
    total_orders = db.query(Order).count()

    paid_orders = db.query(Order).filter(Order.payment_status == "paid").all()
    total_revenue = sum(o.total_price for o in paid_orders) if paid_orders else 0.0

    open_rfqs = db.query(B2BRFQ).filter(B2BRFQ.status == "OPEN").count()
    suspended_accounts = db.query(DeactivatedUser).count()
    switches = platform_settings_service.get_settings(db)

    # Derive system health and warnings
    warnings: List[str] = []
    if switches.get("maintenance_mode"):
        warnings.append("EMERGENCY_MAINTENANCE_ACTIVE: Platform is in full maintenance lockdown.")
    if not switches.get("marketplace_enabled"):
        warnings.append("MARKETPLACE_PAUSED: Public buying and cart checkout are paused.")
    if not switches.get("artisan_onboarding_enabled"):
        warnings.append("ONBOARDING_PAUSED: Artisan onboarding applications are paused.")
    if not switches.get("product_publishing_enabled"):
        warnings.append("PUBLISHING_PAUSED: New product listings are temporarily halted.")
    if not switches.get("b2b_enabled"):
        warnings.append("B2B_PAUSED: B2B RFQ submissions and matchmaking are halted.")
    if pending_applications > 10:
        warnings.append(f"HIGH_PENDING_QUEUE: {pending_applications} artisan applications awaiting Super Admin review.")

    system_health = "maintenance" if switches.get("maintenance_mode") else "operational"

    # Active user estimation (artisans + admin users + unique customers)
    unique_customers = db.query(Order.customer_id).distinct().count()
    active_users = total_artisans + max(unique_customers, 1) + 2

    return PlatformOverviewMetricsResponse(
        active_users=active_users,
        active_artisans=active_artisans,
        total_artisans=total_artisans,
        pending_applications=pending_applications,
        active_products=active_products,
        total_products=total_products,
        total_orders=total_orders,
        total_revenue=round(total_revenue, 2),
        open_rfqs=open_rfqs,
        suspended_accounts=suspended_accounts,
        system_health=system_health,
        switches=switches,
        security_warnings=warnings
    )


# =========================================================================
# 4. ARTISAN GOVERNANCE
# =========================================================================

@router.get(
    "/artisans",
    response_model=List[AdminArtisanItem],
    summary="List Registered Artisans for Governance (Admin / Super Admin)"
)
def list_admin_artisans(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Returns registered artisans with their active status, cluster, product counts,
    and verified GI status.
    """
    artisans = db.query(Artisan).order_by(Artisan.created_at.desc()).all()
    results: List[AdminArtisanItem] = []

    for a in artisans:
        prods_count = db.query(Product).filter(Product.artisan_id == a.id).count()
        cluster = db.query(CraftCluster).filter(CraftCluster.id == a.cluster_id).first() if a.cluster_id else None
        
        # Check if artisan has verified GI products or authorization
        gi_verified = db.query(Product).filter(
            Product.artisan_id == a.id,
            Product.gi_artisan_authorization_status == "AUTHORIZED"
        ).first() is not None

        results.append(AdminArtisanItem(
            id=a.id,
            full_name=a.full_name,
            phone_number=a.phone_number,
            state=a.state,
            district=a.district,
            primary_craft=a.primary_craft,
            cluster_id=a.cluster_id,
            cluster_name=cluster.name if cluster else None,
            is_active=a.is_active,
            products_count=prods_count,
            gi_verified=gi_verified,
            created_at=a.created_at.isoformat() if a.created_at else None
        ))
    return results


@router.post(
    "/artisans/{artisan_id}/verify-gi",
    response_model=Dict[str, Any],
    summary="Authoritatively Toggle Artisan GI Verification (Super Admin Only)"
)
def verify_artisan_gi(
    artisan_id: str,
    payload: Optional[AdminArtisanVerifyGIRequest] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to authoritatively certify or uncertify an artisan's GI status.
    Updates all products linked to this artisan with 'AUTHORIZED' / 'UNVERIFIED'
    and records an immutable audit log.
    """
    artisan = db.query(Artisan).filter(Artisan.id == artisan_id).first()
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan not found")

    verified = payload.verified if payload is not None else True
    new_status = "AUTHORIZED" if verified else "UNVERIFIED"

    products = db.query(Product).filter(Product.artisan_id == artisan_id).all()
    for p in products:
        p.gi_artisan_authorization_status = new_status
        p.gi_craft_registered = verified
        if payload and payload.gi_registration_name:
            p.gi_registration_name = payload.gi_registration_name
        if payload and payload.gi_reference:
            p.gi_registration_reference = payload.gi_reference
        p.gi_verification_date = datetime.now(timezone.utc)

    audit = AdminAuditLog(
        action="VERIFY_ARTISAN_GI",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=artisan_id,
        details=json.dumps({
            "artisan_id": artisan_id,
            "artisan_name": artisan.full_name,
            "gi_verified": verified,
            "gi_status": new_status,
            "products_updated": len(products),
            "gi_registration_name": payload.gi_registration_name if payload else None
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "artisan_id": artisan_id,
        "gi_verified": verified,
        "gi_status": new_status,
        "products_updated": len(products)
    }


@router.post(
    "/artisans/{artisan_id}/suspend",
    response_model=Dict[str, Any],
    summary="Suspend Artisan Account (Super Admin Only)"
)
def suspend_artisan(
    artisan_id: str,
    payload: Optional[AdminSuspendRequest] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to suspend an artisan account.
    Marks artisan as inactive, adds to deactivated_users registry,
    and logs audit entry.
    """
    artisan = db.query(Artisan).filter(Artisan.id == artisan_id).first()
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan not found")

    artisan.is_active = False
    reason = payload.reason if payload and payload.reason else "Suspended by Super Administrator"

    # Add to deactivated_users registry
    existing_deact = db.query(DeactivatedUser).filter(DeactivatedUser.id == artisan_id).first()
    if not existing_deact:
        db.add(DeactivatedUser(id=artisan_id, reason=reason))

    audit = AdminAuditLog(
        action="SUSPEND_ARTISAN",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=artisan_id,
        details=json.dumps({
            "artisan_id": artisan_id,
            "artisan_name": artisan.full_name,
            "reason": reason
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {"success": True, "artisan_id": artisan_id, "is_active": False, "message": "Artisan successfully suspended."}


@router.post(
    "/artisans/{artisan_id}/reactivate",
    response_model=Dict[str, Any],
    summary="Reactivate Artisan Account (Super Admin Only)"
)
def reactivate_artisan(
    artisan_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to reactivate a suspended artisan account.
    """
    artisan = db.query(Artisan).filter(Artisan.id == artisan_id).first()
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan not found")

    artisan.is_active = True

    # Remove from deactivated registry
    db.query(DeactivatedUser).filter(DeactivatedUser.id == artisan_id).delete()

    audit = AdminAuditLog(
        action="REACTIVATE_ARTISAN",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=artisan_id,
        details=json.dumps({
            "artisan_id": artisan_id,
            "artisan_name": artisan.full_name
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {"success": True, "artisan_id": artisan_id, "is_active": True, "message": "Artisan successfully reactivated."}


# =========================================================================
# 5. PRODUCT MODERATION LIFECYCLE
# =========================================================================

@router.get(
    "/products",
    response_model=List[AdminProductItem],
    summary="List Products for Moderation (Admin / Super Admin)"
)
def list_admin_products(
    limit: int = 100,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Returns products with artisan name and moderation status."""
    products = db.query(Product).order_by(Product.created_at.desc()).offset(offset).limit(limit).all()
    results: List[AdminProductItem] = []

    for p in products:
        artisan = db.query(Artisan).filter(Artisan.id == p.artisan_id).first()
        results.append(AdminProductItem(
            id=p.id,
            title=p.title,
            artisan_id=p.artisan_id,
            artisan_name=artisan.full_name if artisan else None,
            craft_type=p.craft_type,
            listing_price=p.listing_price,
            floor_price=p.floor_price,
            stock_quantity=p.stock_quantity,
            is_active=p.is_active,
            studio_image_url=p.studio_image_url or p.raw_photo_url,
            created_at=p.created_at.isoformat() if p.created_at else None
        ))
    return results


@router.post(
    "/products/{product_id}/moderate",
    response_model=Dict[str, Any],
    summary="Moderate Product (Admin / Super Admin)"
)
def moderate_product(
    product_id: str,
    payload: AdminProductModerateRequest,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Authoritative product moderation: publish, unpublish, flag, or remove.
    Requires a mandatory justification reason and logs immutable audit trail.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    action_clean = payload.action.strip().lower()
    reason_clean = payload.reason.strip()
    if not reason_clean:
        raise HTTPException(status_code=422, detail="A mandatory justification reason is required.")

    prev_state = product.is_active

    if action_clean in ("unpublish", "remove"):
        product.is_active = False
    elif action_clean == "publish":
        product.is_active = True
    elif action_clean == "flag":
        # Flagging does not immediately deactivate unless requested
        pass
    else:
        raise HTTPException(status_code=400, detail=f"Invalid moderation action '{payload.action}'.")

    audit = AdminAuditLog(
        action="MODERATE_PRODUCT",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=product.artisan_id,
        details=json.dumps({
            "product_id": product_id,
            "product_title": product.title,
            "moderation_action": action_clean,
            "reason": reason_clean,
            "previous_is_active": prev_state,
            "new_is_active": product.is_active
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "product_id": product_id,
        "action": action_clean,
        "is_active": product.is_active,
        "reason": reason_clean
    }


@router.post(
    "/products/{product_id}/restore",
    response_model=Dict[str, Any],
    summary="Restore Inactive Product (Super Admin Only)"
)
def restore_product(
    product_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to authoritatively restore a deactivated/removed product.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = True

    audit = AdminAuditLog(
        action="RESTORE_PRODUCT",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=product.artisan_id,
        details=json.dumps({
            "product_id": product_id,
            "product_title": product.title
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {"success": True, "product_id": product_id, "is_active": True, "message": "Product restored successfully."}


# =========================================================================
# 6. CLUSTERS & STATUTORY WAGE GOVERNANCE
# =========================================================================

@router.get(
    "/clusters",
    response_model=List[Dict[str, Any]],
    summary="List Craft Clusters for Wage Governance (Admin / Super Admin)"
)
def list_admin_clusters(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Returns craft clusters with statutory wages and GI registration tags."""
    clusters = db.query(CraftCluster).all()
    results: List[Dict[str, Any]] = []
    for c in clusters:
        artisans_count = db.query(Artisan).filter(Artisan.cluster_id == c.id).count()
        results.append({
            "id": c.id,
            "name": c.name,
            "craft_name": c.craft_name,
            "state": c.state,
            "district": c.district,
            "statutory_daily_wage": c.statutory_daily_wage,
            "statutory_hourly_wage": c.statutory_hourly_wage,
            "gi_tag_status": c.gi_tag_status,
            "gi_tag_number": c.gi_tag_number,
            "artisans_count": artisans_count,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None
        })
    return results


@router.patch(
    "/clusters/{cluster_id}/wage",
    response_model=Dict[str, Any],
    summary="Update Cluster Statutory Wage Rate (Super Admin Only)"
)
def update_cluster_wage(
    cluster_id: str,
    payload: AdminClusterWageUpdateRequest,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to update the statutory minimum wage rates for a craft cluster.
    Directly affects the anti-exploitation floor price for newly verified crafts.
    """
    cluster = db.query(CraftCluster).filter(CraftCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Craft cluster not found")

    old_daily = cluster.statutory_daily_wage
    old_hourly = cluster.statutory_hourly_wage

    new_daily = payload.statutory_daily_wage
    new_hourly = payload.statutory_hourly_wage if payload.statutory_hourly_wage is not None else round(new_daily / 8.0, 2)

    cluster.statutory_daily_wage = new_daily
    cluster.statutory_hourly_wage = new_hourly
    cluster.updated_at = datetime.now(timezone.utc)

    audit = AdminAuditLog(
        action="UPDATE_CLUSTER_WAGE",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=None,
        details=json.dumps({
            "cluster_id": cluster_id,
            "cluster_name": cluster.name,
            "previous_daily_wage": old_daily,
            "new_daily_wage": new_daily,
            "previous_hourly_wage": old_hourly,
            "new_hourly_wage": new_hourly
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "cluster_id": cluster_id,
        "statutory_daily_wage": new_daily,
        "statutory_hourly_wage": new_hourly,
        "message": f"Statutory wage for {cluster.name} updated to ₹{new_daily}/day (₹{new_hourly}/hr)."
    }


# =========================================================================
# 7. ORDER & COMMERCE OVERSIGHT
# =========================================================================

@router.get(
    "/orders",
    response_model=List[AdminOrderItem],
    summary="List Platform Orders (Admin / Super Admin)"
)
def list_admin_orders(
    limit: int = 100,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Returns platform orders with payment and fulfillment status."""
    orders = db.query(Order).order_by(Order.created_at.desc()).offset(offset).limit(limit).all()
    results: List[AdminOrderItem] = []
    for o in orders:
        results.append(AdminOrderItem(
            id=o.id,
            order_number=o.order_number,
            customer_id=o.customer_id,
            artisan_id=o.artisan_id,
            product_id=o.product_id,
            product_title=o.product_title,
            quantity=o.quantity,
            total_price=o.total_price,
            status=o.status,
            payment_status=o.payment_status,
            created_at=o.created_at.isoformat() if o.created_at else None
        ))
    return results


@router.patch(
    "/orders/{order_id}/status",
    response_model=Dict[str, Any],
    summary="Update Order Status or Payment Flag (Super Admin Only)"
)
def update_admin_order_status(
    order_id: str,
    payload: AdminOrderStatusUpdateRequest,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to override or update order status and payment status.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    old_payment = order.payment_status

    if payload.status:
        order.status = payload.status
    if payload.payment_status:
        order.payment_status = payload.payment_status

    audit = AdminAuditLog(
        action="UPDATE_ORDER_STATUS",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=order.customer_id,
        details=json.dumps({
            "order_id": order_id,
            "order_number": order.order_number,
            "previous_status": old_status,
            "new_status": order.status,
            "previous_payment_status": old_payment,
            "new_payment_status": order.payment_status,
            "note": payload.note
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "order_id": order_id,
        "status": order.status,
        "payment_status": order.payment_status
    }


# =========================================================================
# 8. B2B RFQ GOVERNANCE
# =========================================================================

@router.get(
    "/b2b/rfqs",
    response_model=List[AdminB2BRFQItem],
    summary="List B2B RFQs (Admin / Super Admin)"
)
def list_admin_b2b_rfqs(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Returns database B2B RFQs with match counts."""
    rfqs = db.query(B2BRFQ).order_by(B2BRFQ.created_at.desc()).all()
    results: List[AdminB2BRFQItem] = []
    for r in rfqs:
        matches_cnt = db.query(B2BMatchRecord).filter(B2BMatchRecord.rfq_id == r.id).count()
        results.append(AdminB2BRFQItem(
            id=r.id,
            buyer_name=r.buyer_name,
            buyer_organization=r.buyer_organization,
            buyer_email=r.buyer_email,
            craft_type=r.craft_type,
            required_quantity=r.required_quantity,
            unit_budget=r.unit_budget,
            total_budget=r.total_budget,
            deadline_days=r.deadline_days,
            delivery_state=r.delivery_state,
            status=r.status,
            matches_count=matches_cnt,
            created_at=r.created_at.isoformat() if r.created_at else None
        ))
    return results


@router.patch(
    "/b2b/rfqs/{rfq_id}/status",
    response_model=Dict[str, Any],
    summary="Update B2B RFQ Status (Super Admin Only)"
)
def update_admin_b2b_status(
    rfq_id: str,
    payload: AdminB2BStatusUpdateRequest,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to authoritatively update B2B RFQ status
    ('OPEN', 'MATCHED', 'FULFILLED', 'CLOSED', 'REVIEW').
    """
    rfq = db.query(B2BRFQ).filter(B2BRFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="B2B RFQ not found")

    old_status = rfq.status
    rfq.status = payload.status.upper()

    audit = AdminAuditLog(
        action="UPDATE_B2B_STATUS",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=rfq.buyer_id,
        details=json.dumps({
            "rfq_id": rfq_id,
            "previous_status": old_status,
            "new_status": rfq.status,
            "note": payload.note
        }, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "rfq_id": rfq_id,
        "previous_status": old_status,
        "new_status": rfq.status
    }


# =========================================================================
# 9. USER ACCOUNT GOVERNANCE & SUSPENSION
# =========================================================================

@router.get(
    "/users",
    response_model=List[AdminPlatformUserItem],
    summary="List Platform Users for Governance (Super Admin Only)"
)
def list_platform_users(
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to list platform accounts across roles (super_admin, admin, artisan, customer).
    Reports active vs suspended status based on the authoritative deactivated_users registry.
    """
    deactivated_ids = {row.id for row in db.query(DeactivatedUser.id).all()}
    results: List[AdminPlatformUserItem] = []

    # Check Cloud / Supabase users
    supabase_admins = supabase_admin.list_admin_users()
    admin_emails = set()
    for a in supabase_admins:
        uid = str(a.get("id", ""))
        em = a.get("email")
        if em:
            admin_emails.add(em.strip().lower())
        results.append(AdminPlatformUserItem(
            id=uid,
            email=em,
            role=str(a.get("role", "admin")),
            is_suspended=uid in deactivated_ids,
            created_at=a.get("created_at"),
            last_sign_in_at=a.get("last_sign_in_at")
        ))

    # Always ensure primary Super Admin is represented
    sa_email = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_email").first()
    sa_uid = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
    if sa_email and sa_email.value.strip().lower() not in admin_emails:
        results.insert(0, AdminPlatformUserItem(
            id=sa_uid.value if sa_uid else "super-admin-root",
            email=sa_email.value,
            role="super_admin",
            is_suspended=False,
            created_at=datetime.now(timezone.utc).isoformat()
        ))

    # Include registered Artisans
    artisans = db.query(Artisan).all()
    for art in artisans:
        is_susp = not art.is_active or art.id in deactivated_ids
        results.append(AdminPlatformUserItem(
            id=art.id,
            email=f"{art.phone_number}@artisan.hunardhara.gov.in",
            role="artisan",
            is_suspended=is_susp,
            created_at=art.created_at.isoformat() if art.created_at else None
        ))

    return results


@router.post(
    "/users/{user_id}/suspend",
    response_model=Dict[str, Any],
    summary="Suspend User Account (Super Admin Only)"
)
def suspend_platform_user(
    user_id: str,
    payload: Optional[AdminSuspendRequest] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to suspend any user account.
    Adds user to deactivated_users table so subsequent requests are blocked with HTTP 403 ACCOUNT_DEACTIVATED.
    Super Admins cannot suspend themselves or the primary Super Admin.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_SUSPEND_SELF: You cannot suspend your own administrative account."
        )

    sa_uid = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
    if sa_uid and sa_uid.value == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_SUSPEND_PRIMARY_SUPER_ADMIN: The primary platform Super Administrator cannot be suspended."
        )

    reason = payload.reason if payload and payload.reason else "Administrative suspension by Super Administrator"

    # Add to deactivated registry
    existing = db.query(DeactivatedUser).filter(DeactivatedUser.id == user_id).first()
    if not existing:
        db.add(DeactivatedUser(id=user_id, reason=reason))

    # If artisan, deactivate artisan record
    artisan = db.query(Artisan).filter(Artisan.id == user_id).first()
    if artisan:
        artisan.is_active = False

    audit = AdminAuditLog(
        action="SUSPEND_USER",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=user_id,
        details=json.dumps({"reason": reason, "target_user_id": user_id}, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {"success": True, "user_id": user_id, "is_suspended": True, "reason": reason}


@router.post(
    "/users/{user_id}/reactivate",
    response_model=Dict[str, Any],
    summary="Reactivate Suspended User Account (Super Admin Only)"
)
def reactivate_platform_user(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Super Admin endpoint to reactivate a suspended user account.
    """
    db.query(DeactivatedUser).filter(DeactivatedUser.id == user_id).delete()

    artisan = db.query(Artisan).filter(Artisan.id == user_id).first()
    if artisan:
        artisan.is_active = True

    audit = AdminAuditLog(
        action="REACTIVATE_USER",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=user_id,
        details=json.dumps({"target_user_id": user_id}, ensure_ascii=False)
    )
    db.add(audit)
    db.commit()

    return {"success": True, "user_id": user_id, "is_suspended": False, "message": "User reactivated successfully."}


# =========================================================================
# 10. ADMINISTRATORS & AUDIT LOGS
# =========================================================================

@router.get(
    "/admins",
    response_model=List[AdminUserResponse],
    summary="List Administrators (Super Admin Only)",
    dependencies=[Depends(RateLimiter(max_requests=20, window_seconds=60, prefix="list_admins"))]
)
def list_administrators(
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin endpoint to list all users with administrative roles."""
    raw_admins = supabase_admin.list_admin_users()
    results: List[AdminUserResponse] = []

    if not raw_admins:
        sa_email = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_email").first()
        sa_uid = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
        if sa_email and sa_uid:
            results.append(AdminUserResponse(
                id=sa_uid.value,
                email=sa_email.value,
                role="super_admin",
                created_at=datetime.now(timezone.utc).isoformat()
            ))
        return results

    for a in raw_admins:
        results.append(AdminUserResponse(
            id=str(a.get("id", "")),
            email=a.get("email"),
            role=str(a.get("role", "admin")),
            created_at=a.get("created_at"),
            last_sign_in_at=a.get("last_sign_in_at")
        ))
    return results


@router.post(
    "/admins/{user_id}/grant",
    response_model=Dict[str, Any],
    summary="Grant Administrator Role (Super Admin Only)"
)
def grant_admin_role(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin endpoint to grant 'admin' role to a user."""
    if user_id == current_user.id:
        return {"success": True, "message": "You are already Super Administrator.", "role": "super_admin"}

    res = supabase_admin.set_user_role(user_id, "admin")

    audit = AdminAuditLog(
        action="GRANT_ADMIN_ROLE",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=user_id,
        details=json.dumps({"granted_role": "admin", "actor_role": current_user.role})
    )
    db.add(audit)
    db.commit()

    return {"success": True, "user_id": user_id, "new_role": "admin", "details": res}


@router.post(
    "/admins/{user_id}/revoke",
    response_model=Dict[str, Any],
    summary="Revoke Administrator Role (Super Admin Only)"
)
def revoke_admin_role(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin endpoint to demote an administrator back to 'customer'."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_REVOKE_SELF: Super Administrator cannot revoke their own role."
        )

    sa_uid = db.query(SystemSetting).filter(SystemSetting.key == "super_admin_user_id").first()
    if sa_uid and sa_uid.value == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_REVOKE_SUPER_ADMIN: The primary Super Administrator role cannot be revoked."
        )

    res = supabase_admin.set_user_role(user_id, "customer")

    audit = AdminAuditLog(
        action="REVOKE_ADMIN_ROLE",
        actor_id=current_user.id,
        actor_email=current_user.email,
        target_user_id=user_id,
        details=json.dumps({"revoked_role": "admin", "new_role": "customer"})
    )
    db.add(audit)
    db.commit()

    return {"success": True, "user_id": user_id, "new_role": "customer", "details": res}


@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    summary="Retrieve Platform Audit Logs (Admin / Super Admin)",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="audit_logs"))]
)
def get_admin_audit_logs(
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Administrative endpoint to inspect immutable platform audit trail."""
    logs = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(limit).all()
    results: List[AuditLogResponse] = []
    for l in logs:
        results.append(AuditLogResponse(
            id=l.id,
            action=l.action,
            actor_id=l.actor_id,
            actor_email=l.actor_email,
            target_user_id=l.target_user_id,
            details=l.details,
            created_at=l.created_at.isoformat() if l.created_at else datetime.now(timezone.utc).isoformat()
        ))
    return results
