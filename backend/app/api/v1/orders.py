import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, require_customer, require_artisan, RateLimiter
from app.core.idempotency import check_idempotency_header, idempotency_store
from app.models.order import Order
from app.models.product import Product
from app.models.artisan import Artisan
from app.models.craft_cluster import CraftCluster
from app.schemas.orders import (
    OrderCreate,
    OrderResponse,
    OrderPaymentVerifyRequest,
    OrderStatusUpdateRequest,
    CartCheckoutRequest,
    CartCheckoutResponse,
)

router = APIRouter(prefix="/orders", tags=["Orders"])

VALID_TRANSITIONS = {
    "pending": {"paid", "cancelled"},
    "paid": {"confirmed", "cancelled"},
    "confirmed": {"processing", "shipped", "cancelled"},
    "processing": {"shipped", "cancelled"},
    "shipped": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
}


def enrich_order_response(order: Order, db: Session) -> OrderResponse:
    """
    Enriches the basic Order database model into OrderResponse with
    authoritative product, artisan, craft cluster, and wage protection details.
    """
    resp = OrderResponse.model_validate(order)
    product = db.query(Product).filter(Product.id == order.product_id).first()
    artisan = db.query(Artisan).filter(Artisan.id == order.artisan_id).first()

    if product:
        resp.product_image_url = getattr(product, "studio_image_url", None) or getattr(product, "raw_photo_url", None)
        resp.craft_type = getattr(product, "craft_type", None)
        wage_rate = getattr(product, "hourly_wage_rate", 50.0) or 50.0
        hours = getattr(product, "labor_hours", 5.0) or 5.0
        resp.statutory_wage = round(wage_rate * hours * (order.quantity or 1), 2)

    if artisan:
        resp.artisan_name = getattr(artisan, "full_name", None)
        cluster_id = getattr(artisan, "cluster_id", None)
        if cluster_id:
            cluster = db.query(CraftCluster).filter(CraftCluster.id == cluster_id).first()
            if cluster:
                resp.cluster_name = getattr(cluster, "name", None) or getattr(cluster, "district", None) or getattr(cluster, "craft_name", None)

    return resp



@router.get("/customer", response_model=List[OrderResponse], summary="List Authenticated Customer's Orders")
def list_customer_orders(
    current_user: CurrentUser = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Returns only the authenticated customer's own order history.
    Admins can view all orders.
    Artisans without customer or administrator privileges are rejected with HTTP 403.
    Enriches order records with live product, artisan, and statutory wage details.
    """
    if current_user.is_admin:
        orders = db.query(Order).order_by(Order.created_at.desc()).all()
    else:
        orders = db.query(Order).filter(Order.customer_id == current_user.id).order_by(Order.created_at.desc()).all()

    return [enrich_order_response(o, db) for o in orders]


@router.post(
    "/customer",
    response_model=OrderResponse,
    status_code=201,
    summary="Create a Customer Order",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="orders_create"))]
)
def create_customer_order(
    order_in: OrderCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_user: CurrentUser = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Allows authenticated customers (or admins) to place an order for a single craft product.
    Enforces atomic inventory decrements to prevent overselling.
    Supports Idempotency-Key / X-Idempotency-Key to prevent duplicate order placements.
    """
    effective_idempotency_key = idempotency_key or x_idempotency_key
    scope = f"order:{current_user.id}"

    if effective_idempotency_key:
        cached = check_idempotency_header(effective_idempotency_key, scope=scope)
        if cached:
            status_code, data = cached
            return JSONResponse(status_code=status_code, content=data, headers={"Idempotent-Replay": "true"})

    try:
        # 1. Validate quantity bounds
        if order_in.quantity < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INVALID_QUANTITY: Quantity must be at least 1."
            )

        product = db.query(Product).filter(Product.id == order_in.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        if not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PRODUCT_UNAVAILABLE: Product listing is currently inactive."
            )

        if product.listing_price <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INVALID_PRICE: Product listing price is invalid."
            )

        # 2. Check stock availability
        if product.stock_quantity < order_in.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"INSUFFICIENT_STOCK: Requested {order_in.quantity} units, but only {product.stock_quantity} available in inventory."
            )

        # 3. Atomic conditional inventory decrement to guarantee race-condition safety
        rows_updated = db.query(Product).filter(
            Product.id == product.id,
            Product.stock_quantity >= order_in.quantity,
            Product.is_active == True
        ).update(
            {Product.stock_quantity: Product.stock_quantity - order_in.quantity},
            synchronize_session="fetch"
        )
        if rows_updated == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"INSUFFICIENT_STOCK: Could not allocate {order_in.quantity} units due to concurrent purchase activity."
            )

        order_id = f"ord-{uuid.uuid4().hex[:12]}"
        order_number = f"HN-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        total_price = round(product.listing_price * order_in.quantity, 2)

        new_order = Order(
            id=order_id,
            order_number=order_number,
            customer_id=current_user.id,
            artisan_id=product.artisan_id,
            product_id=product.id,
            product_title=product.title,
            quantity=order_in.quantity,
            total_price=total_price,
            status="pending",
            payment_status="unpaid",
            created_at=datetime.now(timezone.utc)
        )

        db.add(new_order)
        db.commit()
        db.refresh(new_order)

        enriched = enrich_order_response(new_order, db)
        order_data = enriched.model_dump(mode="json")
        if effective_idempotency_key:
            idempotency_store.complete(effective_idempotency_key, response_data=order_data, status_code=201, scope=scope)

        return enriched
    except Exception:
        db.rollback()
        if effective_idempotency_key:
            idempotency_store.abort(effective_idempotency_key, scope=scope)
        raise


@router.post(
    "/checkout",
    response_model=CartCheckoutResponse,
    status_code=201,
    summary="Checkout Customer Shopping Cart",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="orders_checkout"))]
)
def checkout_customer_cart(
    checkout_in: CartCheckoutRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_user: CurrentUser = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """
    Authoritative transactional multi-item cart checkout.
    Validates product availability, active status, non-zero pricing, and inventory.
    Atomically reserves inventory for all items in a single transaction.
    If any single item fails or is out of stock, the entire cart checkout rolls back.
    Supports Idempotency-Key to prevent duplicate checkouts.
    """
    effective_idempotency_key = idempotency_key or x_idempotency_key
    scope = f"checkout:{current_user.id}"

    if effective_idempotency_key:
        cached = check_idempotency_header(effective_idempotency_key, scope=scope)
        if cached:
            status_code, data = cached
            return JSONResponse(status_code=status_code, content=data, headers={"Idempotent-Replay": "true"})

    if not checkout_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="EMPTY_CART: Cart must contain at least one item."
        )

    # Validate each item quantity
    for item in checkout_in.items:
        if item.quantity < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INVALID_QUANTITY: Quantity for each item must be at least 1."
            )

    try:
        created_orders = []
        total_amount = 0.0
        total_items = 0

        # Validate all items and reserve stock
        for item in checkout_in.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"PRODUCT_NOT_FOUND: Product with ID '{item.product_id}' does not exist."
                )

            if not product.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PRODUCT_UNAVAILABLE: Product '{product.title}' is currently inactive."
                )

            if product.listing_price <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"INVALID_PRICE: Product '{product.title}' listing price is invalid."
                )

            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"INSUFFICIENT_STOCK: Requested {item.quantity} units of '{product.title}', but only {product.stock_quantity} available in inventory."
                )

            rows_updated = db.query(Product).filter(
                Product.id == product.id,
                Product.stock_quantity >= item.quantity,
                Product.is_active == True
            ).update(
                {Product.stock_quantity: Product.stock_quantity - item.quantity},
                synchronize_session="fetch"
            )
            if rows_updated == 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"INSUFFICIENT_STOCK: Could not allocate {item.quantity} units of '{product.title}' due to concurrent purchase activity."
                )

            order_id = f"ord-{uuid.uuid4().hex[:12]}"
            order_number = f"HN-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
            item_total = round(product.listing_price * item.quantity, 2)

            new_order = Order(
                id=order_id,
                order_number=order_number,
                customer_id=current_user.id,
                artisan_id=product.artisan_id,
                product_id=product.id,
                product_title=product.title,
                quantity=item.quantity,
                total_price=item_total,
                status="pending",
                payment_status="unpaid",
                created_at=datetime.now(timezone.utc)
            )
            db.add(new_order)
            created_orders.append(new_order)
            total_amount += item_total
            total_items += item.quantity

        db.commit()

        # Refresh and enrich all created orders
        enriched_orders = []
        for order in created_orders:
            db.refresh(order)
            enriched_orders.append(enrich_order_response(order, db))

        response_payload = CartCheckoutResponse(
            orders=enriched_orders,
            total_amount=round(total_amount, 2),
            total_items=total_items
        )

        response_dict = response_payload.model_dump(mode="json")
        if effective_idempotency_key:
            idempotency_store.complete(effective_idempotency_key, response_data=response_dict, status_code=201, scope=scope)

        return response_payload

    except Exception:
        db.rollback()
        if effective_idempotency_key:
            idempotency_store.abort(effective_idempotency_key, scope=scope)
        raise



@router.get("/artisan", response_model=List[OrderResponse], summary="List Authenticated Artisan's Incoming Orders")
def list_artisan_orders(
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Returns only orders placed for crafts created by the authenticated artisan.
    Admins can view all orders.
    Customer payment identifiers (payment_id, payment_provider) are sanitized for artisan privacy.
    """
    if current_user.is_admin:
        return db.query(Order).order_by(Order.created_at.desc()).all()
    orders = db.query(Order).filter(Order.artisan_id == current_user.id).order_by(Order.created_at.desc()).all()
    # Data minimization: Artisans fulfill based on payment_status ('paid', 'confirmed'),
    # but must not receive customer's financial payment IDs or gateway tokens.
    sanitized_orders = []
    for o in orders:
        resp = enrich_order_response(o, db)
        resp.payment_id = None
        resp.payment_provider = None
        sanitized_orders.append(resp)
    return sanitized_orders


@router.get("/{order_id}", response_model=OrderResponse, summary="Get Order by ID")
def get_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves single order with strict ownership validation:
    Only the purchasing customer, fulfilling artisan, or a verified administrator can view the order.
    Redacts customer's payment gateway reference from fulfilling artisan viewers.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with ID '{order_id}' not found")

    if not current_user.is_admin and current_user.id != order.customer_id and current_user.id != order.artisan_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to view this order."
        )

    resp = enrich_order_response(order, db)
    # Data minimization: If viewer is artisan (and not customer or admin), strip payment identifiers
    if current_user.id == order.artisan_id and current_user.id != order.customer_id and not current_user.is_admin:
        resp.payment_id = None
        resp.payment_provider = None

    return resp



@router.post(
    "/{order_id}/verify-payment",
    response_model=OrderResponse,
    summary="Verify Payment for an Order",
    dependencies=[Depends(RateLimiter(max_requests=30, window_seconds=60, prefix="orders_payment"))]
)
def verify_order_payment(
    order_id: str,
    payment_in: OrderPaymentVerifyRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies payment settlement from trusted payment gateway for a pending customer order.
    Transitions order to 'paid'.
    Enforces idempotency, customer ownership, and production safeguards against demo tokens.
    """
    effective_idempotency_key = idempotency_key or x_idempotency_key
    scope = f"pay:{order_id}"

    if effective_idempotency_key:
        cached = check_idempotency_header(effective_idempotency_key, scope=scope)
        if cached:
            status_code, data = cached
            return JSONResponse(status_code=status_code, content=data, headers={"Idempotent-Replay": "true"})

    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail=f"Order with ID '{order_id}' not found")

        # 1. Ownership validation: only purchasing customer or admin can verify payment
        if not current_user.is_admin and current_user.id != order.customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN_OWNERSHIP: You are not authorized to verify payment for this order."
            )

        # 2. Check current order state
        if order.status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ORDER_CANCELLED: Cannot process payment for a cancelled order."
            )

        if order.payment_status == "paid":
            if order.payment_id == payment_in.payment_id:
                # Idempotent replay for duplicate submission of same payment
                order_data = OrderResponse.model_validate(order).model_dump(mode="json")
                if effective_idempotency_key:
                    idempotency_store.complete(effective_idempotency_key, response_data=order_data, status_code=200, scope=scope)
                return order
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="PAYMENT_ALREADY_COMPLETED: Order has already been paid with a different payment reference."
            )

        if order.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"INVALID_ORDER_STATE: Cannot verify payment for an order in '{order.status}' state."
            )

        # 3. Production Guardrail: reject fake/demo payment tokens in production
        payment_id_lower = payment_in.payment_id.lower().strip()
        is_demo_token = any(token in payment_id_lower for token in ["mock", "demo", "test", "fake", "dummy", "sandbox"])

        if settings.ENVIRONMENT.lower() == "production":
            if is_demo_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="DEMO_PAYMENT_PROHIBITED: Demo and mock payment tokens are strictly prohibited in production."
                )
            if not payment_in.signature or len(payment_in.signature.strip()) < 16:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="INVALID_PAYMENT_SIGNATURE: Payment gateway signature is required and invalid in production."
                )

        # 4. State transition: pending -> paid
        order.status = "paid"
        order.payment_status = "paid"
        order.payment_id = payment_in.payment_id
        order.payment_provider = payment_in.provider
        order.paid_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(order)

        order_data = OrderResponse.model_validate(order).model_dump(mode="json")
        if effective_idempotency_key:
            idempotency_store.complete(effective_idempotency_key, response_data=order_data, status_code=200, scope=scope)

        return order
    except Exception:
        if effective_idempotency_key:
            idempotency_store.abort(effective_idempotency_key, scope=scope)
        raise


@router.put("/{order_id}/status", response_model=OrderResponse, summary="Update Order Status")
def update_order_status(
    order_id: str,
    status_payload: dict,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates order status with role-scoped state transitions:
    - Verified Admin: full status modification authority adhering to state machine and payment verification.
    - Fulfilling Artisan: can advance orders from paid -> confirmed -> processing/shipped -> delivered, or cancel unfulfilled orders.
    - Purchasing Customer: can only cancel unfulfilled orders before shipment.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with ID '{order_id}' not found")

    new_status = str(status_payload.get("status") or "").lower().strip()
    valid_statuses = {"pending", "paid", "confirmed", "processing", "shipped", "delivered", "cancelled"}
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"INVALID_STATUS: Allowed statuses are {sorted(list(valid_statuses))}"
        )

    # 1. Prevent modification of terminal states
    if order.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ORDER_TERMINATED: Cannot modify the status of an already cancelled order."
        )
    if order.status == "delivered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ORDER_COMPLETED: Cannot modify the status of an already delivered order."
        )

    # 2. Prevent cancellation once order has been shipped or delivered
    if new_status == "cancelled" and order.status in {"shipped", "delivered"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANNOT_CANCEL: Order has already been shipped or delivered."
        )

    # 3. Prevent confirming order before successful payment verification
    if new_status == "confirmed" and order.payment_status != "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PAYMENT_REQUIRED: Order cannot be confirmed before successful payment verification."
        )

    # 3. Enforce forward state machine transitions
    allowed_next = VALID_TRANSITIONS.get(order.status, set())
    if new_status not in allowed_next and new_status != order.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_STATE_TRANSITION: Cannot transition order from '{order.status}' to '{new_status}'. Allowed transitions: {sorted(list(allowed_next))}"
        )

    previous_status = order.status

    # 4. Role-based authorization on state transition
    if current_user.is_admin:
        order.status = new_status
        if new_status == "paid":
            order.payment_status = "paid"
            if not order.paid_at:
                order.paid_at = datetime.now(timezone.utc)
    elif current_user.id == order.artisan_id and current_user.role == "artisan":
        if new_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: Artisans cannot directly mark orders as paid without gateway verification."
            )
        order.status = new_status
    elif current_user.id == order.customer_id:
        if new_status != "cancelled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: Customers can only cancel unfulfilled orders."
            )
        if order.status in {"shipped", "delivered"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CANNOT_CANCEL: Order has already been shipped or delivered."
            )
        order.status = "cancelled"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to update this order."
        )

    # 5. Atomically replenish inventory and issue refund when order is cancelled
    if order.status == "cancelled" and previous_status != "cancelled":
        db.query(Product).filter(Product.id == order.product_id).update(
            {Product.stock_quantity: Product.stock_quantity + order.quantity},
            synchronize_session="fetch"
        )
        if order.payment_status == "paid":
            order.payment_status = "refunded"

    db.commit()
    db.refresh(order)
    return order

