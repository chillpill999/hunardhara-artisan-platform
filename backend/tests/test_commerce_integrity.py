import uuid
import secrets
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.product import Product
from app.models.order import Order
from app.models.craft_cluster import CraftCluster
from app.models.artisan import Artisan


@pytest.fixture(autouse=True)
def initialize_test_db():
    init_db()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def auth_header(subject: str, role: str = "customer", email: str = None, **claims):
    payload = {"app_metadata": {"role": role}, "email": email or f"{subject}@hunardhara.gov.in", **claims}
    return {"Authorization": f"Bearer {create_access_token(subject, extra_claims=payload)}"}


@pytest.fixture
def sample_artisan_and_product(db):
    """Creates an active artisan and product fixture with inventory of 10."""
    cluster_id = f"cl-comm-{uuid.uuid4().hex[:6]}"
    cluster = CraftCluster(
        id=cluster_id,
        name=f"Commerce Test Cluster {cluster_id}",
        craft_name="Bastar Dhokra",
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        statutory_hourly_wage=50.0,
        statutory_daily_wage=400.0,
        gi_tag_status="Registered (GI-99)",
    )
    db.merge(cluster)

    artisan_id = f"art-comm-{uuid.uuid4().hex[:6]}"
    artisan = Artisan(
        id=artisan_id,
        full_name="Ramesh Baghel",
        phone_number=f"+91{secrets.token_hex(4)}00",
        masked_aadhaar="XXXXXXXX1234",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="ST",
        cluster_id=cluster_id,
        state="Chhattisgarh",
        district="Bastar",
        latitude=19.0748,
        longitude=82.0298,
        primary_craft="Bastar Dhokra",
        experience_years=12,
        is_active=True,
    )
    db.merge(artisan)

    product_id = f"prod-comm-{uuid.uuid4().hex[:6]}"
    product = Product(
        id=product_id,
        title="Handcrafted Brass Nandi",
        craft_type="Bastar Dhokra",
        artisan_id=artisan_id,
        cluster_id=cluster_id,
        cost_materials=500.0,
        labor_hours=6.0,
        hourly_wage_rate=50.0,
        floor_price=850.0,
        recommended_retail_price=1300.0,
        wholesale_b2b_price=1050.0,
        technique="Lost Wax Casting",
        listing_price=1200.0,
        stock_quantity=10,
        is_active=True,
    )
    db.merge(product)
    db.commit()

    return {"artisan_id": artisan_id, "product_id": product_id, "cluster_id": cluster_id}


class TestCommerceOrderPaymentIntegrity:
    """Comprehensive test suite for commerce, order state machine, and payment integrity."""

    def test_customer_only_ordering_enforcement(self, client, sample_artisan_and_product):
        """Customers and verified admins can place orders; artisans are rejected with 403."""
        prod_id = sample_artisan_and_product["product_id"]

        # 1. Customer places order -> 201 Created
        cust_headers = auth_header("cust-buyer-101", role="customer")
        res_cust = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        assert res_cust.status_code == 201
        assert res_cust.json()["status"] == "pending"

        # 2. Admin places order -> 201 Created
        admin_headers = auth_header("admin-001", role="admin")
        res_admin = client.post("/api/v1/orders/customer", headers=admin_headers, json={"product_id": prod_id, "quantity": 1})
        assert res_admin.status_code == 201

        # 3. Artisan attempts to place customer order -> 403 Forbidden
        art_headers = auth_header("art-seller-999", role="artisan")
        res_art = client.post("/api/v1/orders/customer", headers=art_headers, json={"product_id": prod_id, "quantity": 1})
        assert res_art.status_code == 403
        assert "FORBIDDEN_ROLE" in res_art.json()["detail"]

        # 4. Artisan attempts to list customer orders -> 403 Forbidden
        res_art_list = client.get("/api/v1/orders/customer", headers=art_headers)
        assert res_art_list.status_code == 403

    def test_validate_product_availability_before_order(self, client, db, sample_artisan_and_product):
        """Validates active listing, valid non-zero pricing, and existing product ID."""
        cust_headers = auth_header("cust-buyer-102", role="customer")
        prod_id = sample_artisan_and_product["product_id"]

        # 1. Non-existent product -> 404
        res_404 = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": "non-existent-id", "quantity": 1})
        assert res_404.status_code == 404

        # 2. Inactive product -> 400 PRODUCT_UNAVAILABLE
        prod = db.query(Product).filter(Product.id == prod_id).first()
        prod.is_active = False
        db.commit()

        res_inactive = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        assert res_inactive.status_code == 400
        assert "PRODUCT_UNAVAILABLE" in res_inactive.json()["detail"]

        # 3. Zero / Invalid price -> 400 INVALID_PRICE
        prod.is_active = True
        prod.listing_price = 0.0
        db.commit()

        res_price = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        assert res_price.status_code == 400
        assert "INVALID_PRICE" in res_price.json()["detail"]

        # Restore
        prod.listing_price = 1200.0
        db.commit()

        # 4. Invalid quantity (0) -> 400 or 422
        res_qty = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 0})
        assert res_qty.status_code in (400, 422)

    def test_atomic_stock_reservation_and_overselling_prevention(self, client, db, sample_artisan_and_product):
        """Stock is atomically reserved; ordering more than available fails with 409 Conflict."""
        prod_id = sample_artisan_and_product["product_id"]
        prod = db.query(Product).filter(Product.id == prod_id).first()
        prod.stock_quantity = 3
        db.commit()

        cust1 = auth_header("cust-atomic-01", role="customer")
        cust2 = auth_header("cust-atomic-02", role="customer")

        # First customer orders 2 units -> leaves 1
        res1 = client.post("/api/v1/orders/customer", headers=cust1, json={"product_id": prod_id, "quantity": 2})
        assert res1.status_code == 201
        db.refresh(prod)
        assert prod.stock_quantity == 1

        # Second customer tries to order 2 units (only 1 left) -> 409 Conflict
        res2 = client.post("/api/v1/orders/customer", headers=cust2, json={"product_id": prod_id, "quantity": 2})
        assert res2.status_code == 409
        assert "INSUFFICIENT_STOCK" in res2.json()["detail"]

        # Stock remains at 1
        db.refresh(prod)
        assert prod.stock_quantity == 1

    def test_order_starts_in_pending_and_cannot_confirm_without_payment(self, client, sample_artisan_and_product):
        """New orders are pending/unpaid and cannot be confirmed before successful payment."""
        prod_id = sample_artisan_and_product["product_id"]
        art_id = sample_artisan_and_product["artisan_id"]

        cust_headers = auth_header("cust-buyer-103", role="customer")
        art_headers = auth_header(art_id, role="artisan")

        # 1. Create order
        create_res = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        assert create_res.status_code == 201
        order_data = create_res.json()
        order_id = order_data["id"]

        assert order_data["status"] == "pending"
        assert order_data["payment_status"] == "unpaid"
        assert order_data["paid_at"] is None

        # 2. Artisan attempts to confirm without payment -> 400 PAYMENT_REQUIRED
        confirm_res = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "confirmed"})
        assert confirm_res.status_code == 400
        assert "PAYMENT_REQUIRED" in confirm_res.json()["detail"]

    def test_complete_order_lifecycle_and_state_machine(self, client, sample_artisan_and_product):
        """Valid transition sequence: pending -> paid -> confirmed -> shipped -> delivered."""
        prod_id = sample_artisan_and_product["product_id"]
        art_id = sample_artisan_and_product["artisan_id"]

        cust_headers = auth_header("cust-lifecycle-01", role="customer")
        art_headers = auth_header(art_id, role="artisan")

        # 1. Order Creation -> pending
        res_create = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        assert res_create.status_code == 201
        order_id = res_create.json()["id"]

        # 2. Customer verifies payment -> paid
        pay_payload = {
            "payment_id": f"pay_gateway_{secrets.token_hex(6)}",
            "provider": "razorpay",
            "signature": f"sig_{secrets.token_hex(16)}"
        }
        res_pay = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=pay_payload)
        assert res_pay.status_code == 200
        assert res_pay.json()["status"] == "paid"
        assert res_pay.json()["payment_status"] == "paid"
        assert res_pay.json()["paid_at"] is not None

        # 3. Artisan confirms order -> confirmed
        res_confirm = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "confirmed"})
        assert res_confirm.status_code == 200
        assert res_confirm.json()["status"] == "confirmed"

        # 4. Artisan ships order -> shipped
        res_ship = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "shipped"})
        assert res_ship.status_code == 200
        assert res_ship.json()["status"] == "shipped"

        # 5. Customer CANNOT cancel after shipment -> 400 CANNOT_CANCEL
        res_cancel_after_ship = client.put(f"/api/v1/orders/{order_id}/status", headers=cust_headers, json={"status": "cancelled"})
        assert res_cancel_after_ship.status_code == 400
        assert "CANNOT_CANCEL" in res_cancel_after_ship.json()["detail"]

        # 6. Artisan delivers order -> delivered
        res_deliver = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "delivered"})
        assert res_deliver.status_code == 200
        assert res_deliver.json()["status"] == "delivered"

        # 7. Terminal delivered state is immutable
        res_remodify = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "shipped"})
        assert res_remodify.status_code == 400
        assert "ORDER_COMPLETED" in res_remodify.json()["detail"]

    def test_illegal_state_jumps_rejected(self, client, sample_artisan_and_product):
        """State transitions must follow deterministic sequence; skips are rejected."""
        prod_id = sample_artisan_and_product["product_id"]
        art_id = sample_artisan_and_product["artisan_id"]

        cust_headers = auth_header("cust-jumps-01", role="customer")
        art_headers = auth_header(art_id, role="artisan")

        res_create = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        order_id = res_create.json()["id"]

        # Cannot jump from pending to shipped
        res_skip_ship = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "shipped"})
        assert res_skip_ship.status_code == 400

        # Cannot jump from pending to delivered
        res_skip_deliv = client.put(f"/api/v1/orders/{order_id}/status", headers=art_headers, json={"status": "delivered"})
        assert res_skip_deliv.status_code == 400

    def test_client_cannot_tamper_price_seller_ownership(self, client, sample_artisan_and_product):
        """Calculates totals and ownership strictly server-side, ignoring client spoofing."""
        prod_id = sample_artisan_and_product["product_id"]
        real_artisan_id = sample_artisan_and_product["artisan_id"]

        cust_headers = auth_header("cust-spoof-tester", role="customer")

        # Client attempts to spoof total price (0.01), artisan_id, customer_id, and status
        spoofed_payload = {
            "product_id": prod_id,
            "quantity": 2,
            "total_price": 0.01,
            "artisan_id": "art-attacker-fake",
            "customer_id": "cust-victim-victim",
            "status": "confirmed"
        }
        res = client.post("/api/v1/orders/customer", headers=cust_headers, json=spoofed_payload)
        assert res.status_code == 201
        data = res.json()

        # Validated strictly server-side
        assert data["customer_id"] == "cust-spoof-tester"
        assert data["artisan_id"] == real_artisan_id
        assert data["total_price"] == 2400.0  # 1200.0 * 2
        assert data["status"] == "pending"
        assert data["payment_status"] == "unpaid"

    def test_payment_idempotency_protection(self, client, sample_artisan_and_product):
        """Replaying payment verification with Idempotency-Key returns cached response without error."""
        prod_id = sample_artisan_and_product["product_id"]
        cust_headers = auth_header("cust-idem-pay-01", role="customer")

        res_create = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        order_id = res_create.json()["id"]

        idem_key = f"pay-key-{secrets.token_hex(8)}"
        cust_headers["Idempotency-Key"] = idem_key
        pay_payload = {
            "payment_id": f"pay_tx_{secrets.token_hex(6)}",
            "provider": "upi",
            "signature": f"sig_{secrets.token_hex(16)}"
        }

        # First payment verification
        res1 = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=pay_payload)
        assert res1.status_code == 200
        assert res1.json()["status"] == "paid"

        # Duplicate payment submission with identical Idempotency-Key
        res2 = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=pay_payload)
        assert res2.status_code == 200
        assert res2.headers.get("idempotent-replay") == "true"
        assert res2.json()["id"] == res1.json()["id"]

    def test_cancellation_refund_and_stock_replenishment(self, client, db, sample_artisan_and_product):
        """Cancelling a paid order replenishes inventory and sets payment_status to refunded."""
        prod_id = sample_artisan_and_product["product_id"]
        prod = db.query(Product).filter(Product.id == prod_id).first()
        initial_stock = prod.stock_quantity

        cust_headers = auth_header("cust-refund-01", role="customer")

        # 1. Place order for 2 units
        res_create = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 2})
        order_id = res_create.json()["id"]

        db.refresh(prod)
        assert prod.stock_quantity == initial_stock - 2

        # 2. Pay for order
        pay_payload = {
            "payment_id": f"pay_tx_{secrets.token_hex(6)}",
            "provider": "razorpay",
            "signature": f"sig_{secrets.token_hex(16)}"
        }
        res_pay = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=pay_payload)
        assert res_pay.status_code == 200
        assert res_pay.json()["payment_status"] == "paid"

        # 3. Customer cancels order prior to dispatch
        res_cancel = client.put(f"/api/v1/orders/{order_id}/status", headers=cust_headers, json={"status": "cancelled"})
        assert res_cancel.status_code == 200
        cancel_data = res_cancel.json()

        assert cancel_data["status"] == "cancelled"
        assert cancel_data["payment_status"] == "refunded"

        # 4. Stock is fully replenished
        db.refresh(prod)
        assert prod.stock_quantity == initial_stock

        # 5. Cannot pay a cancelled order
        res_repay = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=pay_payload)
        assert res_repay.status_code == 400
        assert "ORDER_CANCELLED" in res_repay.json()["detail"]

    def test_production_rejects_demo_fake_payment_tokens(self, client, sample_artisan_and_product):
        """In production environment, demo/mock tokens and missing signatures are blocked."""
        prod_id = sample_artisan_and_product["product_id"]
        cust_headers = auth_header("cust-prod-pay-01", role="customer")

        res_create = client.post("/api/v1/orders/customer", headers=cust_headers, json={"product_id": prod_id, "quantity": 1})
        order_id = res_create.json()["id"]

        demo_payload = {
            "payment_id": "mock_tx_demo_12345",
            "provider": "razorpay",
            "signature": "fake_test_sig"
        }

        # Mock settings.ENVIRONMENT to production
        with patch.object(settings, "ENVIRONMENT", "production"):
            res_demo = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=demo_payload)
            assert res_demo.status_code == 400
            assert "DEMO_PAYMENT_PROHIBITED" in res_demo.json()["detail"]

            # Real token prefix but missing signature
            missing_sig_payload = {
                "payment_id": "pay_live_0987654321_legit",
                "provider": "razorpay",
                "signature": ""
            }
            res_no_sig = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_headers, json=missing_sig_payload)
            assert res_no_sig.status_code == 400
            assert "INVALID_PAYMENT_SIGNATURE" in res_no_sig.json()["detail"]

    def test_cross_customer_ownership_isolation(self, client, sample_artisan_and_product):
        """Customer B cannot view, pay for, or cancel Customer A's order."""
        prod_id = sample_artisan_and_product["product_id"]

        cust_a_headers = auth_header("cust-iso-a", role="customer")
        cust_b_headers = auth_header("cust-iso-b", role="customer")

        # Customer A creates order
        res_create = client.post("/api/v1/orders/customer", headers=cust_a_headers, json={"product_id": prod_id, "quantity": 1})
        order_id = res_create.json()["id"]

        # Customer B attempts to view Customer A's order -> 403 Forbidden
        res_view = client.get(f"/api/v1/orders/{order_id}", headers=cust_b_headers)
        assert res_view.status_code == 403

        # Customer B attempts to pay for Customer A's order -> 403 Forbidden
        pay_payload = {
            "payment_id": "pay_cross_tenant_test",
            "provider": "razorpay",
            "signature": "sig_cross_tenant_1234"
        }
        res_pay = client.post(f"/api/v1/orders/{order_id}/verify-payment", headers=cust_b_headers, json=pay_payload)
        assert res_pay.status_code == 403

        # Customer B attempts to cancel Customer A's order -> 403 Forbidden
        res_cancel = client.put(f"/api/v1/orders/{order_id}/status", headers=cust_b_headers, json={"status": "cancelled"})
        assert res_cancel.status_code == 403
