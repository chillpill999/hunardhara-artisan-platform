import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.product import Product
from app.models.earning import ArtisanEarning
from app.models.order import Order
from app.models.artisan import Artisan
from app.models.craft_cluster import CraftCluster


@pytest.fixture(autouse=True)
def init_test_db():
    """Ensure all database tables are created and clusters seeded before running tests."""
    init_db()
    session = SessionLocal()
    try:
        if not session.query(CraftCluster).filter(CraftCluster.id == "cluster-bastar-dhokra-01").first():
            session.add(CraftCluster(
                id="cluster-bastar-dhokra-01",
                name="Bastar Dhokra Cluster",
                craft_name="Bastar Dhokra",
                state="Chhattisgarh",
                district="Bastar",
                latitude=19.07,
                longitude=82.03,
                statutory_hourly_wage=120.0,
                statutory_daily_wage=960.0,
                gi_tag_status="Registered (GI-83)"
            ))
        if not session.query(CraftCluster).filter(CraftCluster.id == "cluster-khurja-pottery-01").first():
            session.add(CraftCluster(
                id="cluster-khurja-pottery-01",
                name="Khurja Pottery Cluster",
                craft_name="Khurja Pottery",
                state="Uttar Pradesh",
                district="Bulandshahr",
                latitude=28.25,
                longitude=77.85,
                statutory_hourly_wage=110.0,
                statutory_daily_wage=880.0,
                gi_tag_status="Registered (GI-177)"
            ))
        session.commit()
    finally:
        session.close()


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


@pytest.fixture
def auth_tokens(db):
    """Generates standard tokens for all test roles and ensures test artisans exist."""
    cluster = db.query(CraftCluster).first()
    cluster_id = cluster.id if cluster else "cluster-bastar-dhokra"
    if not db.query(Artisan).filter(Artisan.id == "art-001").first():
        db.add(Artisan(
            id="art-001",
            full_name="Artisan A Test",
            phone_number="+919999000001",
            masked_aadhaar="XXXXXXXX1111",
            aadhaar_hash="hash-art-rbac-001",
            social_category="General",
            cluster_id=cluster_id,
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.03,
            primary_craft="Bastar Dhokra",
            is_active=True
        ))
        db.commit()
    if not db.query(Artisan).filter(Artisan.id == "art-002").first():
        db.add(Artisan(
            id="art-002",
            full_name="Artisan B Test",
            phone_number="+919999000002",
            masked_aadhaar="XXXXXXXX2222",
            aadhaar_hash="hash-art-rbac-002",
            social_category="General",
            cluster_id=cluster_id,
            state="Chhattisgarh",
            district="Bastar",
            latitude=19.07,
            longitude=82.03,
            primary_craft="Bastar Dhokra",
            is_active=True
        ))
        db.commit()
    return {
        "customerA": create_access_token("cust-001", extra_claims={"app_metadata": {"role": "customer"}, "email": "customerA@crafts.gov.in"}),
        "customerB": create_access_token("cust-002", extra_claims={"app_metadata": {"role": "customer"}, "email": "customerB@crafts.gov.in"}),
        "artisanA": create_access_token("art-001", extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisanA@crafts.gov.in"}),
        "artisanB": create_access_token("art-002", extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisanB@crafts.gov.in"}),
        "adminA": create_access_token("admin-001", extra_claims={"app_metadata": {"role": "admin"}, "email": "admin@hunardhara.gov.in"}),
    }


class TestRoleRBACArchitecture:
    """Comprehensive test suite covering Section 27 verification requirements."""

    def test_anonymous_public_catalog_allowed(self, client):
        """Anonymous visitor can view the public catalog."""
        res = client.get("/api/v1/products")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_anonymous_cannot_create_product_returns_401(self, client):
        """Anonymous caller cannot create products (401 Unauthorized)."""
        res = client.post(
            "/api/v1/products",
            json={
                "title": "Unauthorized Pot",
                "craft_type": "Khurja Pottery",
                "artisan_id": "art-anon",
                "cluster_id": "cluster-khurja-pottery-01",
                "cost_materials": 100.0,
                "labor_hours": 4.0,
                "listing_price": 600.0
            }
        )
        assert res.status_code == 401
        assert "AUTHENTICATION_REQUIRED" in res.json()["detail"]

    def test_customer_cannot_create_product_returns_403(self, client, auth_tokens):
        """Customer cannot access product creation (403 Forbidden)."""
        headers = {"Authorization": f"Bearer {auth_tokens['customerA']}"}
        res = client.post(
            "/api/v1/products",
            json={
                "title": "Customer Attempted Craft",
                "craft_type": "Khurja Pottery",
                "artisan_id": "cust-001",
                "cluster_id": "cluster-khurja-pottery-01",
                "cost_materials": 100.0,
                "labor_hours": 4.0,
                "listing_price": 600.0
            },
            headers=headers
        )
        assert res.status_code == 403
        assert "FORBIDDEN" in res.json()["detail"]

    def test_customer_cannot_access_earnings_returns_403(self, client, auth_tokens):
        """Customer cannot access artisan earnings endpoint (403 Forbidden)."""
        headers = {"Authorization": f"Bearer {auth_tokens['customerA']}"}
        res = client.get("/api/v1/earnings", headers=headers)
        assert res.status_code == 403
        assert "FORBIDDEN" in res.json()["detail"]

    def test_artisan_cannot_access_admin_endpoints_returns_403(self, client, auth_tokens):
        """Artisan cannot access admin-only endpoints (403 Forbidden)."""
        headers = {"Authorization": f"Bearer {auth_tokens['artisanA']}"}
        res = client.get("/api/v1/admin/applications", headers=headers)
        assert res.status_code == 403
        assert "FORBIDDEN" in res.json()["detail"]

    def test_admin_can_access_admin_endpoints(self, client, auth_tokens):
        """Admin can access admin applications endpoint."""
        headers = {"Authorization": f"Bearer {auth_tokens['adminA']}"}
        res = client.get("/api/v1/admin/applications", headers=headers)
        assert res.status_code == 200

    def test_artisanA_can_create_and_manage_own_product(self, client, auth_tokens, db):
        """Artisan A creates their own product successfully."""
        headers = {"Authorization": f"Bearer {auth_tokens['artisanA']}"}
        res = client.post(
            "/api/v1/products",
            json={
                "title": "Artisan A Authentic Bell Metal Horse",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-001",
                "cluster_id": "cluster-bastar-dhokra-01",
                "cost_materials": 400.0,
                "labor_hours": 8.0,
                "hourly_wage_rate": 120.0,
                "technique": "Lost-Wax Casting",
                "listing_price": 2500.0
            },
            headers=headers
        )
        assert res.status_code == 201
        data = res.json()
        assert data["artisan_id"] == "art-001"
        prod_id = data["id"]

        # Artisan A can fetch their own products via /artisan/my
        my_res = client.get("/api/v1/products/artisan/my", headers=headers)
        assert my_res.status_code == 200
        assert any(p["id"] == prod_id for p in my_res.json())

        # Artisan A can update their own product
        update_res = client.put(
            f"/api/v1/products/{prod_id}",
            json={"title": "Artisan A Updated Title", "stock_quantity": 8},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["title"] == "Artisan A Updated Title"

    def test_artisanB_cannot_modify_artisanA_product_returns_403(self, client, auth_tokens, db):
        """Artisan B is denied from editing or deleting Artisan A's product (403 Forbidden)."""
        # Create product owned by artisanA
        headersA = {"Authorization": f"Bearer {auth_tokens['artisanA']}"}
        resA = client.post(
            "/api/v1/products",
            json={
                "title": "Artisan A Exclusive Craft",
                "craft_type": "Bastar Dhokra",
                "artisan_id": "art-001",
                "cluster_id": "cluster-bastar-dhokra-01",
                "cost_materials": 300.0,
                "labor_hours": 6.0,
                "hourly_wage_rate": 120.0,
                "technique": "Lost-Wax Casting",
                "listing_price": 2000.0
            },
            headers=headersA
        )
        assert resA.status_code == 201, f"Failed creating product: {resA.text}"
        prod_id = resA.json()["id"]

        # Artisan B attempts to modify Artisan A's product
        headersB = {"Authorization": f"Bearer {auth_tokens['artisanB']}"}
        res_put = client.put(
            f"/api/v1/products/{prod_id}",
            json={"title": "Malicious Tampering by Artisan B"},
            headers=headersB
        )
        assert res_put.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_put.json()["detail"]

        # Artisan B attempts to delete Artisan A's product
        res_del = client.delete(f"/api/v1/products/{prod_id}", headers=headersB)
        assert res_del.status_code == 403
        assert "FORBIDDEN_OWNERSHIP" in res_del.json()["detail"]

    def test_artisan_earnings_isolation(self, client, auth_tokens, db):
        """Artisan A can only view their own earnings, not Artisan B's."""
        # Seed earning records for Artisan A and Artisan B
        earningA = ArtisanEarning(
            id="earn-001",
            artisan_id="art-001",
            order_id="ord-a-1",
            product_title="Silk Saree A",
            gross_amount=5000.0,
            artisan_wage_payout=3500.0,
            middleman_saved=1500.0
        )
        earningB = ArtisanEarning(
            id="earn-002",
            artisan_id="art-002",
            order_id="ord-b-1",
            product_title="Terracotta Vase B",
            gross_amount=3000.0,
            artisan_wage_payout=2100.0,
            middleman_saved=900.0
        )
        db.merge(earningA)
        db.merge(earningB)
        db.commit()

        # Artisan A queries earnings
        headersA = {"Authorization": f"Bearer {auth_tokens['artisanA']}"}
        resA = client.get("/api/v1/earnings", headers=headersA)
        assert resA.status_code == 200
        earnings_a = resA.json()
        assert all(e["artisan_id"] == "art-001" for e in earnings_a)
        assert not any(e["artisan_id"] == "art-002" for e in earnings_a)

    def test_customer_can_place_and_view_own_orders_isolated(self, client, auth_tokens, db):
        """Customer A can place an order and see only their own orders."""
        # First ensure a product exists
        prod = db.query(Product).first()
        assert prod is not None

        headersCustA = {"Authorization": f"Bearer {auth_tokens['customerA']}"}
        res_order = client.post(
            "/api/v1/orders/customer",
            json={"product_id": prod.id, "quantity": 2},
            headers=headersCustA
        )
        assert res_order.status_code == 201
        order_data = res_order.json()
        assert order_data["customer_id"] == "cust-001"

        # Customer A lists orders
        res_listA = client.get("/api/v1/orders/customer", headers=headersCustA)
        assert res_listA.status_code == 200
        ordersA = res_listA.json()
        assert all(o["customer_id"] == "cust-001" for o in ordersA)

        # Customer B lists orders -> Customer A's order is not visible
        headersCustB = {"Authorization": f"Bearer {auth_tokens['customerB']}"}
        res_listB = client.get("/api/v1/orders/customer", headers=headersCustB)
        assert res_listB.status_code == 200
        ordersB = res_listB.json()
        assert not any(o["id"] == order_data["id"] for o in ordersB)

    def test_customer_can_submit_artisan_upgrade_application(self, client, auth_tokens):
        """Customer submits an application to upgrade to an artisan."""
        headers = {"Authorization": f"Bearer {auth_tokens['customerA']}"}
        res = client.post(
            "/api/v1/artisan/apply",
            json={
                "craft_category": "Varanasi Silk Brocade",
                "experience_years": 4,
                "state": "Uttar Pradesh",
                "district": "Varanasi"
            },
            headers=headers
        )
        assert res.status_code == 201
        data = res.json()
        assert data["user_id"] == "cust-001"
        assert data["status"] == "pending"
