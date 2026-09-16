import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user, require_artisan
from app.models.order import Order
from app.models.product import Product
from app.schemas.orders import OrderCreate, OrderResponse

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/customer", response_model=List[OrderResponse], summary="List Authenticated Customer's Orders")
def list_customer_orders(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns only the authenticated customer's own order history.
    Admins can view all orders.
    """
    if current_user.is_admin:
        return db.query(Order).order_by(Order.created_at.desc()).all()
    return db.query(Order).filter(Order.customer_id == current_user.id).order_by(Order.created_at.desc()).all()


@router.post("/customer", response_model=OrderResponse, status_code=201, summary="Create a Customer Order")
def create_customer_order(
    order_in: OrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows authenticated customers (or admins) to place an order for a craft product.
    """
    product = db.query(Product).filter(Product.id == order_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

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
        status="confirmed",
        created_at=datetime.now(timezone.utc)
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order


@router.get("/artisan", response_model=List[OrderResponse], summary="List Authenticated Artisan's Incoming Orders")
def list_artisan_orders(
    current_user: CurrentUser = Depends(require_artisan),
    db: Session = Depends(get_db)
):
    """
    Returns only orders placed for crafts created by the authenticated artisan.
    Admins can view all orders.
    """
    if current_user.is_admin:
        return db.query(Order).order_by(Order.created_at.desc()).all()
    return db.query(Order).filter(Order.artisan_id == current_user.id).order_by(Order.created_at.desc()).all()


@router.get("/{order_id}", response_model=OrderResponse, summary="Get Order by ID")
def get_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves single order with strict ownership validation:
    Only the purchasing customer, fulfilling artisan, or a verified administrator can view the order.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with ID '{order_id}' not found")

    if not current_user.is_admin and current_user.id != order.customer_id and current_user.id != order.artisan_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN_OWNERSHIP: You are not authorized to view this order."
        )
    return order


@router.put("/{order_id}/status", response_model=OrderResponse, summary="Update Order Status")
def update_order_status(
    order_id: str,
    status_payload: dict,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates order status with role-scoped state transitions:
    - Verified Admin: full status modification authority.
    - Fulfilling Artisan: can update status to processing, shipped, delivered, cancelled.
    - Purchasing Customer: can only cancel order if it has not shipped.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with ID '{order_id}' not found")

    new_status = str(status_payload.get("status") or "").lower().strip()
    valid_statuses = {"pending", "confirmed", "processing", "shipped", "delivered", "cancelled"}
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"INVALID_STATUS: Allowed statuses are {sorted(list(valid_statuses))}"
        )

    if current_user.is_admin:
        order.status = new_status
    elif current_user.id == order.artisan_id and current_user.role == "artisan":
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

    db.commit()
    db.refresh(order)
    return order
