import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.product import Product
from app.models.order import Order
from app.models.craft_cluster import CraftCluster
from app.models.artisan import Artisan
from app.models.b2b_rfq import B2BRFQ


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
def test_cluster(db):
    cluster = db.query(CraftCluster).filter(CraftCluster.id == "cluster-bastar-dhokra").first()
    if not cluster:
        cluster = CraftCluster(
            id="cluster-bastar-dhokra",
            name="Bastar Dhokra Craft Cluster",
            craft_name="Bastar Dhokra",
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.0748,
            longitude=82.0298,
            statutory_hourly_wage=50.0,
            statutory_daily_wage=400.0,
            gi_tag_status="Registered (GI-83)",
            materials=["Brass Scrap", "Beeswax"],
            techniques=["Lost-Wax Casting"],
            description="Tribal bell metal craft"
        )
        db.add(cluster)
        db.commit()
        db.refresh(cluster)
    return cluster


@pytest.fixture
def test_artisan(db, test_cluster):
    artisan = db.query(Artisan).filter(Artisan.id == "art-integrity-001").first()
    if not artisan:
        artisan = Artisan(
            id="art-integrity-001",
            full_name="Sukhdev Baghel",
            phone_number="+919876543999",
            masked_aadhaar="XXXXXXXX1234",
            aadhaar_hash="sha256-test-aadhaar-hash-01",
            social_category="ST",
            cluster_id=test_cluster.id,
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.0748,
            longitude=82.0298,
            primary_craft="Bastar Dhokra",
            experience_years=12,
            is_active=True
        )
        db.add(artisan)
        db.commit()
        db.refresh(artisan)
    return artisan


class TestDatabaseAndAPIIntegrity:
    """Rigorous verification of database & API integrity constraints."""

    def test_create_product_rejects_invalid_cluster_id(self, client, test_artisan):
        """Must return 400 when cluster ID is non-existent."""
        headers = auth_header("art-integrity-001", "artisan")
        res = client.post(
            "/api/v1/products",
            headers=headers,
            json={
                "title": "Fictitious Craft Pot",
                "craft_type": "Unknown Craft",
                "artisan_id": "art-integrity-001",
                "cluster_id": "cluster-non-existent-999",
                "cost_materials": 200.0,
                "labor_hours": 6.0,
                "technique": "Casting",
                "listing_price": 1000.0
            }
        )
        assert res.status_code == 400
        assert "INVALID_CLUSTER_ID" in res.json()["detail"]

    def test_create_product_enforces_numeric_and_stock_bounds(self, client, test_cluster, test_artisan):
        """Rejects negative material cost, non-positive labor hours, negative stock, and non-positive price."""
        headers = auth_header("art-integrity-001", "artisan")
        base_payload = {
            "title": "Boundary Test Pot",
            "craft_type": "Bastar Dhokra",
            "artisan_id": "art-integrity-001",
            "cluster_id": test_cluster.id,
            "cost_materials": 200.0,
            "labor_hours": 6.0,
            "technique": "Casting",
            "listing_price": 1500.0,
            "stock_quantity": 5
        }

        # Negative materials cost
        bad_cost = {**base_payload, "cost_materials": -50.0}
        res = client.post("/api/v1/products", headers=headers, json=bad_cost)
        assert res.status_code in (400, 422)

        # Zero labor hours
        bad_hours = {**base_payload, "labor_hours": 0.0}
        res = client.post("/api/v1/products", headers=headers, json=bad_hours)
        assert res.status_code in (400, 422)

        # Negative stock
        bad_stock = {**base_payload, "stock_quantity": -3}
        res = client.post("/api/v1/products", headers=headers, json=bad_stock)
        assert res.status_code in (400, 422)

        # Zero or negative listing price
        bad_price = {**base_payload, "listing_price": 0.0}
        res = client.post("/api/v1/products", headers=headers, json=bad_price)
        assert res.status_code in (400, 422)

    def test_update_product_revalidates_price_floor(self, client, db, test_cluster, test_artisan):
        """Updating a product's listing_price below the certified statutory floor must fail with HTTP 422."""
        headers = auth_header("art-integrity-001", "artisan")
        # 1. Create a valid product
        create_res = client.post(
            "/api/v1/products",
            headers=headers,
            json={
                "title": "Floor Revalidation Bull",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-integrity-001",
                "cluster_id": test_cluster.id,
                "cost_materials": 300.0,
                "labor_hours": 8.0,  # 8 * 50 = 400 + 300 + 30 = 730 floor
                "technique": "Lost-Wax",
                "listing_price": 1500.0,
                "stock_quantity": 10
            }
        )
        assert create_res.status_code == 201
        prod_id = create_res.json()["id"]
        floor_price = create_res.json()["floor_price"]
        assert floor_price >= 730.0

        # 2. Attempt to update listing_price below floor price (e.g. ₹500)
        update_res = client.put(
            f"/api/v1/products/{prod_id}",
            headers=headers,
            json={"listing_price": 500.0}
        )
        assert update_res.status_code == 422
        assert "PRICE_BELOW_STATUTORY_FLOOR" in update_res.json()["detail"]

        # 3. Legitimate update above floor succeeds
        valid_update = client.put(
            f"/api/v1/products/{prod_id}",
            headers=headers,
            json={"listing_price": 1800.0, "title": "Updated Handcrafted Bull"}
        )
        assert valid_update.status_code == 200
        assert valid_update.json()["listing_price"] == 1800.0
        assert valid_update.json()["title"] == "Updated Handcrafted Bull"

    def test_update_product_cannot_modify_artisan_ownership(self, client, test_cluster, test_artisan):
        """Ensures artisan_id and id are stripped on update, maintaining immutable ownership."""
        headers = auth_header("art-integrity-001", "artisan")
        create_res = client.post(
            "/api/v1/products",
            headers=headers,
            json={
                "title": "Ownership Immutable Figurine",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-integrity-001",
                "cluster_id": test_cluster.id,
                "cost_materials": 200.0,
                "labor_hours": 4.0,
                "technique": "Casting",
                "listing_price": 1200.0
            }
        )
        assert create_res.status_code == 201
        prod_id = create_res.json()["id"]

        # Attempt to transfer product ownership to another artisan
        update_res = client.put(
            f"/api/v1/products/{prod_id}",
            headers=headers,
            json={"title": "Ownership Attack", "artisan_id": "art-hijacker-999"}
        )
        assert update_res.status_code == 200
        assert update_res.json()["artisan_id"] == "art-integrity-001"

    def test_order_creation_atomic_stock_decrement(self, client, db, test_cluster, test_artisan):
        """Customer order atomically decrements product inventory."""
        artisan_headers = auth_header("art-integrity-001", "artisan")
        create_res = client.post(
            "/api/v1/products",
            headers=artisan_headers,
            json={
                "title": "Inventory Decrement Craft",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-integrity-001",
                "cluster_id": test_cluster.id,
                "cost_materials": 200.0,
                "labor_hours": 4.0,
                "technique": "Casting",
                "listing_price": 1200.0,
                "stock_quantity": 10
            }
        )
        assert create_res.status_code == 201
        prod_id = create_res.json()["id"]

        # Customer places order for 3 units
        customer_headers = auth_header("cust-order-001", "customer")
        order_res = client.post(
            "/api/v1/orders/customer",
            headers=customer_headers,
            json={"product_id": prod_id, "quantity": 3}
        )
        assert order_res.status_code == 201
        assert order_res.json()["quantity"] == 3
        assert order_res.json()["total_price"] == 3600.0

        # Verify stock decreased to 7
        prod = db.query(Product).filter(Product.id == prod_id).first()
        db.refresh(prod)
        assert prod.stock_quantity == 7

    def test_order_creation_prevents_overselling_409(self, client, db, test_cluster, test_artisan):
        """Attempting to order more units than available inventory returns 409 Conflict without modifying stock."""
        artisan_headers = auth_header("art-integrity-001", "artisan")
        create_res = client.post(
            "/api/v1/products",
            headers=artisan_headers,
            json={
                "title": "Limited Stock Bell",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-integrity-001",
                "cluster_id": test_cluster.id,
                "cost_materials": 200.0,
                "labor_hours": 4.0,
                "technique": "Casting",
                "listing_price": 1000.0,
                "stock_quantity": 2
            }
        )
        assert create_res.status_code == 201
        prod_id = create_res.json()["id"]

        # Customer attempts to order 5 units (exceeding stock of 2)
        customer_headers = auth_header("cust-order-002", "customer")
        order_res = client.post(
            "/api/v1/orders/customer",
            headers=customer_headers,
            json={"product_id": prod_id, "quantity": 5}
        )
        assert order_res.status_code == 409
        assert "INSUFFICIENT_STOCK" in order_res.json()["detail"]

        # Verify stock is still 2
        prod = db.query(Product).filter(Product.id == prod_id).first()
        db.refresh(prod)
        assert prod.stock_quantity == 2

    def test_order_cancellation_replenishes_stock(self, client, db, test_cluster, test_artisan):
        """Cancelling an unfulfilled order atomically replenishes product inventory."""
        artisan_headers = auth_header("art-integrity-001", "artisan")
        create_res = client.post(
            "/api/v1/products",
            headers=artisan_headers,
            json={
                "title": "Replenish Craft Item",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-integrity-001",
                "cluster_id": test_cluster.id,
                "cost_materials": 200.0,
                "labor_hours": 4.0,
                "technique": "Casting",
                "listing_price": 1000.0,
                "stock_quantity": 10
            }
        )
        prod_id = create_res.json()["id"]

        customer_headers = auth_header("cust-order-003", "customer")
        order_res = client.post(
            "/api/v1/orders/customer",
            headers=customer_headers,
            json={"product_id": prod_id, "quantity": 4}
        )
        assert order_res.status_code == 201
        order_id = order_res.json()["id"]

        # Stock is now 6
        prod = db.query(Product).filter(Product.id == prod_id).first()
        db.refresh(prod)
        assert prod.stock_quantity == 6

        # Customer cancels unfulfilled order
        cancel_res = client.put(
            f"/api/v1/orders/{order_id}/status",
            headers=customer_headers,
            json={"status": "cancelled"}
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "cancelled"

        # Stock is replenished back to 10
        db.refresh(prod)
        assert prod.stock_quantity == 10

    def test_terminal_order_state_cannot_be_overridden(self, client, db, test_cluster, test_artisan):
        """Once an order is cancelled or delivered, further status updates are rejected with HTTP 400."""
        customer_headers = auth_header("cust-order-004", "customer")
        artisan_headers = auth_header("art-integrity-001", "artisan")

        # Create product & order
        create_res = client.post(
            "/api/v1/products",
            headers=artisan_headers,
            json={
                "title": "Terminal Order Craft",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-integrity-001",
                "cluster_id": test_cluster.id,
                "cost_materials": 200.0,
                "labor_hours": 4.0,
                "technique": "Casting",
                "listing_price": 1000.0,
                "stock_quantity": 5
            }
        )
        prod_id = create_res.json()["id"]
        order_res = client.post(
            "/api/v1/orders/customer",
            headers=customer_headers,
            json={"product_id": prod_id, "quantity": 1}
        )
        order_id = order_res.json()["id"]

        # Cancel order
        client.put(
            f"/api/v1/orders/{order_id}/status",
            headers=customer_headers,
            json={"status": "cancelled"}
        )

        # Attempt to reactivate or update status
        reactivate_res = client.put(
            f"/api/v1/orders/{order_id}/status",
            headers=artisan_headers,
            json={"status": "processing"}
        )
        assert reactivate_res.status_code == 400
        assert "ORDER_TERMINATED" in reactivate_res.json()["detail"]

    def test_b2b_rfq_enforces_bounds_and_prevents_impersonation(self, client):
        """B2B RFQ creation enforces positive quantity, unit_budget, deadline_days, and locks buyer email."""
        customer_headers = auth_header("buyer-user-01", "customer", email="realbuyer@enterprise.com")

        # Invalid quantity
        res = client.post(
            "/api/v1/b2b/rfq",
            headers=customer_headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 0,
                "unit_budget": 1500.0,
                "deadline_days": 30
            }
        )
        assert res.status_code in (400, 422)

        # Invalid budget
        res = client.post(
            "/api/v1/b2b/rfq",
            headers=customer_headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 50,
                "unit_budget": -50.0,
                "deadline_days": 30
            }
        )
        assert res.status_code in (400, 422)

        # Attempt to forge buyer email as someone else
        res = client.post(
            "/api/v1/b2b/rfq",
            headers=customer_headers,
            json={
                "craft_type": "Bastar Dhokra",
                "quantity": 50,
                "unit_budget": 1500.0,
                "deadline_days": 30,
                "buyer_email": "impersonated_ceo@tata.com",
                "buyer_name": "Pretending CEO"
            }
        )
        assert res.status_code == 201
        # Buyer email must be bound to the authenticated user's actual email
        assert res.json()["buyer_email"] == "realbuyer@enterprise.com"
