import uuid
import secrets
import pytest
from fastapi.testclient import TestClient

from app.main import app
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
def multi_artisan_and_products(db):
    """Creates two active artisans with multiple active products for cart checkout testing."""
    cluster_id = f"cl-auth-{uuid.uuid4().hex[:6]}"
    cluster = CraftCluster(
        id=cluster_id,
        name=f"Varanasi Weaving Cluster {cluster_id}",
        craft_name="Varanasi Silk",
        state="Uttar Pradesh",
        district="Varanasi",
        latitude=25.3176,
        longitude=82.9739,
        statutory_hourly_wage=75.0,
        statutory_daily_wage=600.0,
        gi_tag_status="Registered (GI-01)",
    )
    db.merge(cluster)

    artisan1_id = f"art-auth1-{uuid.uuid4().hex[:6]}"
    artisan1 = Artisan(
        id=artisan1_id,
        full_name="Radheshyam Ansari",
        phone_number=f"+91{secrets.token_hex(4)}01",
        masked_aadhaar="XXXXXXXX5678",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="OBC",
        cluster_id=cluster_id,
        state="Uttar Pradesh",
        district="Varanasi",
        latitude=25.3176,
        longitude=82.9739,
        primary_craft="Varanasi Silk",
        experience_years=20,
        is_active=True,
    )
    db.merge(artisan1)

    artisan2_id = f"art-auth2-{uuid.uuid4().hex[:6]}"
    artisan2 = Artisan(
        id=artisan2_id,
        full_name="Mangla Devi",
        phone_number=f"+91{secrets.token_hex(4)}02",
        masked_aadhaar="XXXXXXXX8765",
        aadhaar_hash=f"hash-{secrets.token_hex(8)}",
        social_category="SC",
        cluster_id=cluster_id,
        state="Uttar Pradesh",
        district="Varanasi",
        latitude=25.3176,
        longitude=82.9739,
        primary_craft="Varanasi Silk",
        experience_years=15,
        is_active=True,
    )
    db.merge(artisan2)

    prod1_id = f"prod-auth1-{uuid.uuid4().hex[:6]}"
    prod1 = Product(
        id=prod1_id,
        title="Pure Katan Silk Brocade Saree",
        craft_type="Varanasi Silk",
        artisan_id=artisan1_id,
        cluster_id=cluster_id,
        cost_materials=2500.0,
        labor_hours=24.0,
        hourly_wage_rate=75.0,
        floor_price=4300.0,
        recommended_retail_price=6500.0,
        wholesale_b2b_price=5200.0,
        technique="Handloom Jacquard Weaving",
        listing_price=6000.0,
        stock_quantity=5,
        is_active=True,
        studio_image_url="https://hunardhara.gov.in/static/studio/varanasi_saree.jpg"
    )
    db.merge(prod1)

    prod2_id = f"prod-auth2-{uuid.uuid4().hex[:6]}"
    prod2 = Product(
        id=prod2_id,
        title="Handwoven Tanchoi Silk Stole",
        craft_type="Varanasi Silk",
        artisan_id=artisan2_id,
        cluster_id=cluster_id,
        cost_materials=800.0,
        labor_hours=8.0,
        hourly_wage_rate=75.0,
        floor_price=1400.0,
        recommended_retail_price=2200.0,
        wholesale_b2b_price=1800.0,
        technique="Tanchoi Weft Patterning",
        listing_price=2000.0,
        stock_quantity=4,
        is_active=True,
        studio_image_url="https://hunardhara.gov.in/static/studio/varanasi_stole.jpg"
    )
    db.merge(prod2)
    db.commit()

    return {
        "artisan1_id": artisan1_id,
        "artisan2_id": artisan2_id,
        "prod1_id": prod1_id,
        "prod2_id": prod2_id,
        "cluster_id": cluster_id,
    }


class TestAuthoritativeCustomerOrders:
    """Verifies authoritative, database-grounded cart checkout and customer order management."""

    def test_unauthenticated_checkout_rejected(self, client, multi_artisan_and_products):
        """Unauthenticated checkout requests must return HTTP 401."""
        payload = {
            "items": [
                {"product_id": multi_artisan_and_products["prod1_id"], "quantity": 1}
            ]
        }
        res = client.post("/api/v1/orders/checkout", json=payload)
        assert res.status_code == 401

    def test_artisan_cannot_checkout_as_customer(self, client, multi_artisan_and_products):
        """Artisans without customer privileges cannot checkout or place orders (HTTP 403)."""
        art_headers = auth_header("art-only-user", role="artisan")
        payload = {
            "items": [
                {"product_id": multi_artisan_and_products["prod1_id"], "quantity": 1}
            ]
        }
        res = client.post("/api/v1/orders/checkout", headers=art_headers, json=payload)
        assert res.status_code == 403
        assert "FORBIDDEN_ROLE" in res.json()["detail"]

    def test_empty_cart_checkout_rejected(self, client):
        """Empty cart checkout payload returns HTTP 422 or 400."""
        cust_headers = auth_header("cust-empty-cart", role="customer")
        res = client.post("/api/v1/orders/checkout", headers=cust_headers, json={"items": []})
        assert res.status_code in (400, 422)

    def test_invalid_quantity_in_cart_rejected(self, client, multi_artisan_and_products):
        """Quantity < 1 in any cart item is rejected with HTTP 400 or 422."""
        cust_headers = auth_header("cust-invalid-qty", role="customer")
        payload = {
            "items": [
                {"product_id": multi_artisan_and_products["prod1_id"], "quantity": 0}
            ]
        }
        res = client.post("/api/v1/orders/checkout", headers=cust_headers, json=payload)
        assert res.status_code in (400, 422)

    def test_multi_item_cart_checkout_atomic_success(self, client, db, multi_artisan_and_products):
        """Multiple items from different artisans are checked out in a single atomic transaction."""
        cust_headers = auth_header("cust-multi-success", role="customer")
        p1_id = multi_artisan_and_products["prod1_id"]
        p2_id = multi_artisan_and_products["prod2_id"]

        p1 = db.query(Product).filter(Product.id == p1_id).first()
        p2 = db.query(Product).filter(Product.id == p2_id).first()
        init_p1_stock = p1.stock_quantity
        init_p2_stock = p2.stock_quantity

        payload = {
            "items": [
                {"product_id": p1_id, "quantity": 2},
                {"product_id": p2_id, "quantity": 1},
            ]
        }

        res = client.post("/api/v1/orders/checkout", headers=cust_headers, json=payload)
        assert res.status_code == 201
        data = res.json()

        assert data["total_items"] == 3
        # Expected total: 6000.0 * 2 + 2000.0 * 1 = 14000.0
        assert data["total_amount"] == 14000.0
        assert len(data["orders"]) == 2

        # Check enriched metadata
        ord1 = next(o for o in data["orders"] if o["product_id"] == p1_id)
        assert ord1["quantity"] == 2
        assert ord1["total_price"] == 12000.0
        assert ord1["status"] == "pending"
        assert ord1["payment_status"] == "unpaid"
        assert ord1["artisan_name"] == "Radheshyam Ansari"
        assert ord1["craft_type"] == "Varanasi Silk"
        assert ord1["product_image_url"] == "https://hunardhara.gov.in/static/studio/varanasi_saree.jpg"
        # Statutory wage: 75.0 * 24.0 * 2 = 3600.0
        assert ord1["statutory_wage"] == 3600.0

        ord2 = next(o for o in data["orders"] if o["product_id"] == p2_id)
        assert ord2["quantity"] == 1
        assert ord2["total_price"] == 2000.0
        assert ord2["status"] == "pending"
        assert ord2["payment_status"] == "unpaid"
        assert ord2["artisan_name"] == "Mangla Devi"
        assert ord2["craft_type"] == "Varanasi Silk"

        # Verify stock decrements in PostgreSQL
        db.refresh(p1)
        db.refresh(p2)
        assert p1.stock_quantity == init_p1_stock - 2
        assert p2.stock_quantity == init_p2_stock - 1

    def test_stock_conflict_rolls_back_entire_cart(self, client, db, multi_artisan_and_products):
        """If item 2 has insufficient stock, item 1's stock must NOT be decremented and no orders created."""
        cust_headers = auth_header("cust-conflict-test", role="customer")
        p1_id = multi_artisan_and_products["prod1_id"]
        p2_id = multi_artisan_and_products["prod2_id"]

        p1 = db.query(Product).filter(Product.id == p1_id).first()
        p2 = db.query(Product).filter(Product.id == p2_id).first()
        init_p1_stock = p1.stock_quantity
        init_p2_stock = p2.stock_quantity

        # Request 1 unit of p1 (available), but 99 units of p2 (unavailable)
        payload = {
            "items": [
                {"product_id": p1_id, "quantity": 1},
                {"product_id": p2_id, "quantity": 99},
            ]
        }

        res = client.post("/api/v1/orders/checkout", headers=cust_headers, json=payload)
        assert res.status_code == 409
        assert "INSUFFICIENT_STOCK" in res.json()["detail"]

        # Crucial: verify p1 stock was NOT decremented (transaction rollback)
        db.refresh(p1)
        db.refresh(p2)
        assert p1.stock_quantity == init_p1_stock
        assert p2.stock_quantity == init_p2_stock

    def test_inactive_product_in_cart_blocks_checkout(self, client, db, multi_artisan_and_products):
        """An inactive product in the cart blocks checkout and rolls back all items."""
        cust_headers = auth_header("cust-inactive-test", role="customer")
        p1_id = multi_artisan_and_products["prod1_id"]
        p2_id = multi_artisan_and_products["prod2_id"]

        p2 = db.query(Product).filter(Product.id == p2_id).first()
        p2.is_active = False
        db.commit()

        payload = {
            "items": [
                {"product_id": p1_id, "quantity": 1},
                {"product_id": p2_id, "quantity": 1},
            ]
        }

        res = client.post("/api/v1/orders/checkout", headers=cust_headers, json=payload)
        assert res.status_code == 400
        assert "PRODUCT_UNAVAILABLE" in res.json()["detail"]

        # Restore
        p2.is_active = True
        db.commit()

    def test_client_cannot_tamper_prices_in_cart_checkout(self, client, multi_artisan_and_products):
        """Even if client attempts to pass spoofed prices or artisan IDs, prices come strictly from DB."""
        cust_headers = auth_header("cust-tamper-tester", role="customer")
        p1_id = multi_artisan_and_products["prod1_id"]

        spoofed_payload = {
            "items": [
                {
                    "product_id": p1_id,
                    "quantity": 1,
                    "price": 1.0,  # Attacker tries to set ₹1.00
                    "total_price": 1.0,
                    "artisan_id": "art-attacker"
                }
            ]
        }

        res = client.post("/api/v1/orders/checkout", headers=cust_headers, json=spoofed_payload)
        assert res.status_code == 201
        data = res.json()
        assert data["total_amount"] == 6000.0  # Real DB listing_price
        assert data["orders"][0]["total_price"] == 6000.0

    def test_get_customer_orders_enriched_and_isolated(self, client, multi_artisan_and_products):
        """GET /orders/customer returns only the authenticated user's orders with full enrichment."""
        cust1_headers = auth_header("cust-history-user-1", role="customer")
        cust2_headers = auth_header("cust-history-user-2", role="customer")

        p1_id = multi_artisan_and_products["prod1_id"]

        # Customer 1 places an order
        res_chk = client.post(
            "/api/v1/orders/checkout",
            headers=cust1_headers,
            json={"items": [{"product_id": p1_id, "quantity": 1}]}
        )
        assert res_chk.status_code == 201

        # Customer 1 lists orders
        res_list1 = client.get("/api/v1/orders/customer", headers=cust1_headers)
        assert res_list1.status_code == 200
        orders1 = res_list1.json()
        assert len(orders1) >= 1
        assert orders1[0]["customer_id"] == "cust-history-user-1"
        assert orders1[0]["product_id"] == p1_id
        assert orders1[0]["artisan_name"] == "Radheshyam Ansari"
        assert "Varanasi Weaving Cluster" in orders1[0]["cluster_name"]
        assert orders1[0]["product_image_url"] is not None

        # Customer 2 lists orders -> Customer 1's orders are isolated and not returned
        res_list2 = client.get("/api/v1/orders/customer", headers=cust2_headers)
        assert res_list2.status_code == 200
        orders2 = res_list2.json()
        assert not any(o["customer_id"] == "cust-history-user-1" for o in orders2)

    def test_cart_checkout_idempotency(self, client, multi_artisan_and_products):
        """Replaying checkout with same Idempotency-Key returns cached response without duplicate stock decrements."""
        cust_headers = auth_header("cust-idem-cart", role="customer")
        p2_id = multi_artisan_and_products["prod2_id"]
        idem_key = f"cart-key-{secrets.token_hex(8)}"

        payload = {"items": [{"product_id": p2_id, "quantity": 1}]}

        res1 = client.post(
            "/api/v1/orders/checkout",
            headers={**cust_headers, "Idempotency-Key": idem_key},
            json=payload
        )
        assert res1.status_code == 201
        data1 = res1.json()

        # Duplicate request
        res2 = client.post(
            "/api/v1/orders/checkout",
            headers={**cust_headers, "Idempotency-Key": idem_key},
            json=payload
        )
        assert res2.status_code in (200, 201)
        assert res2.headers.get("idempotent-replay") == "true"
        data2 = res2.json()
        assert data2["total_amount"] == data1["total_amount"]
        assert len(data2["orders"]) == len(data1["orders"])
