import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.security import create_access_token
from app.models.system_setting import SystemSetting
from app.models.admin_audit_log import AdminAuditLog
from app.models.artisan_application import ArtisanApplication
from app.models.artisan import Artisan
from app.models.product import Product
from app.models.craft_cluster import CraftCluster
from app.models.order import Order
from app.models.b2b_rfq import B2BRFQ, B2BMatchRecord
from app.models.deactivated_user import DeactivatedUser
from app.services.platform_settings_service import platform_settings_service


@pytest.fixture(autouse=True)
def clean_environment():
    """Initializes DB and cleans test fixtures."""
    init_db()
    db = SessionLocal()
    try:
        # Reset platform settings to defaults
        db.query(SystemSetting).delete(synchronize_session=False)
        db.query(AdminAuditLog).delete(synchronize_session=False)
        db.query(DeactivatedUser).delete(synchronize_session=False)
        db.commit()

        # Seed test craft cluster
        cluster = db.query(CraftCluster).filter(CraftCluster.id == "cluster-control-01").first()
        if not cluster:
            db.add(CraftCluster(
                id="cluster-control-01",
                name="Control Test Cluster",
                craft_name="Wood Carving",
                state="Karnataka",
                district="Mysuru",
                latitude=12.29,
                longitude=76.63,
                statutory_hourly_wage=80.0,
                statutory_daily_wage=640.0,
                gi_tag_status="Registered (GI-101)"
            ))
            db.commit()

        # Seed test artisan
        artisan = db.query(Artisan).filter(Artisan.id == "art-ctrl-01").first()
        if not artisan:
            db.add(Artisan(
                id="art-ctrl-01",
                full_name="Govind Master",
                phone_number="+919876543210",
                masked_aadhaar="XXXXXXXX3210",
                aadhaar_hash="ctrl-aadhaar-hash-01",
                social_category="OBC",
                cluster_id="cluster-control-01",
                state="Karnataka",
                district="Mysuru",
                latitude=12.29,
                longitude=76.63,
                primary_craft="Wood Carving",
                experience_years=12,
                is_active=True
            ))
            db.commit()

        # Seed test product
        product = db.query(Product).filter(Product.id == "prod-ctrl-01").first()
        if not product:
            db.add(Product(
                id="prod-ctrl-01",
                artisan_id="art-ctrl-01",
                cluster_id="cluster-control-01",
                title="Mysuru Sandalwood Inlay Box",
                craft_type="Wood Carving",
                materials=["Sandalwood"],
                production_time_hours=8.0,
                technique="Inlay",
                cost_materials=400.0,
                labor_hours=8.0,
                hourly_wage_rate=80.0,
                floor_price=1040.0,
                recommended_retail_price=1450.0,
                wholesale_b2b_price=1200.0,
                listing_price=1500.0,
                stock_quantity=10,
                is_active=True
            ))
            db.commit()

        # Seed test order
        order = db.query(Order).filter(Order.id == "order-ctrl-01").first()
        if not order:
            db.add(Order(
                id="order-ctrl-01",
                order_number="ORD-CTRL-001",
                customer_id="cust-ctrl-01",
                artisan_id="art-ctrl-01",
                product_id="prod-ctrl-01",
                product_title="Mysuru Sandalwood Inlay Box",
                quantity=1,
                total_price=1500.0,
                status="pending",
                payment_status="unpaid"
            ))
            db.commit()

        # Seed test B2BRFQ
        rfq = db.query(B2BRFQ).filter(B2BRFQ.id == "rfq-ctrl-01").first()
        if not rfq:
            db.add(B2BRFQ(
                id="rfq-ctrl-01",
                buyer_name="FabIndia Sourcing",
                buyer_email="procurement@fabindia.com",
                craft_type="Wood Carving",
                required_quantity=50,
                unit_budget=1250.0,
                total_budget=62500.0,
                deadline_days=30,
                status="OPEN"
            ))
            db.commit()

    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def tokens():
    return {
        "customer": create_access_token("cust-ctrl-01", extra_claims={"app_metadata": {"role": "customer"}, "email": "customer@test.gov.in"}),
        "artisan": create_access_token("art-ctrl-01", extra_claims={"app_metadata": {"role": "artisan"}, "email": "artisan@test.gov.in"}),
        "admin": create_access_token("admin-001", extra_claims={"app_metadata": {"role": "admin"}, "email": "admin@hunardhara.gov.in"}),
        "super_admin": create_access_token("sa-aryan-ctrl", extra_claims={"app_metadata": {"role": "super_admin"}, "email": "aryanrockstar2007@gmail.com"}),
    }


class TestSuperAdminControlCenter:
    """Production test suite for the Super Admin Control Center and Platform Governance."""

    def test_platform_settings_rbac(self, client, tokens):
        # 1. Unauthenticated -> 401
        res = client.get("/api/v1/admin/platform-settings")
        assert res.status_code == 401

        # 2. Customer -> 403
        res = client.get(
            "/api/v1/admin/platform-settings",
            headers={"Authorization": f"Bearer {tokens['customer']}"}
        )
        assert res.status_code == 403

        # 3. Admin -> 200 (can view settings)
        res = client.get(
            "/api/v1/admin/platform-settings",
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["marketplace_enabled"] is True
        assert data["b2b_enabled"] is True

        # 4. Standard Admin cannot update settings -> 403
        res = client.patch(
            "/api/v1/admin/platform-settings",
            json={"b2b_enabled": False},
            headers={"Authorization": f"Bearer {tokens['admin']}"}
        )
        assert res.status_code == 403

        # 5. Super Admin updates settings -> 200
        res = client.patch(
            "/api/v1/admin/platform-settings",
            json={"b2b_enabled": False},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        assert res.json()["b2b_enabled"] is False

    def test_overview_metrics(self, client, tokens):
        res = client.get(
            "/api/v1/admin/overview-metrics",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["active_artisans"] >= 1
        assert data["active_products"] >= 1
        assert data["open_rfqs"] >= 1
        assert data["system_health"] in ("operational", "maintenance")
        assert "switches" in data

    def test_guardrail_publishing_switch(self, client, tokens):
        # Disable product publishing
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"product_publishing_enabled": False},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

        # Attempt to create product as artisan -> rejected with 403
        res = client.post(
            "/api/v1/products",
            json={
                "artisan_id": "art-ctrl-01",
                "cluster_id": "cluster-control-01",
                "title": "Blocked Product Attempt",
                "craft_type": "Wood Carving",
                "technique": "Carving",
                "cost_materials": 300.0,
                "labor_hours": 6.0,
                "hourly_wage_rate": 80.0,
                "listing_price": 1200.0,
                "stock_quantity": 5
            },
            headers={"Authorization": f"Bearer {tokens['artisan']}"}
        )
        assert res.status_code == 403
        assert "PRODUCT_PUBLISHING_PAUSED" in res.json()["detail"]

        # Re-enable publishing
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"product_publishing_enabled": True},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

    def test_guardrail_onboarding_switch(self, client, tokens):
        # Disable artisan onboarding
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"artisan_onboarding_enabled": False},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

        # Customer attempts to apply -> rejected with 403
        res = client.post(
            "/api/v1/artisan/apply",
            json={
                "full_name": "Applicant Artisan",
                "craft_category": "Wood Carving",
                "experience_years": 4,
                "state": "Karnataka"
            },
            headers={"Authorization": f"Bearer {tokens['customer']}"}
        )
        assert res.status_code == 403
        assert "ARTISAN_ONBOARDING_PAUSED" in res.json()["detail"]

        # Re-enable onboarding
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"artisan_onboarding_enabled": True},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

    def test_guardrail_b2b_switch(self, client, tokens):
        # Disable B2B
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"b2b_enabled": False},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

        # Buyer attempts B2B matchmaking -> rejected with 403
        res = client.post(
            "/api/v1/b2b/match",
            json={
                "buyer_name": "Test Buyer",
                "buyer_email": "buyer@test.com",
                "craft_type": "Wood Carving",
                "quantity": 25,
                "unit_budget": 1000.0,
                "deadline_days": 14
            },
            headers={"Authorization": f"Bearer {tokens['customer']}"}
        )
        assert res.status_code == 403
        assert "B2B_PAUSED" in res.json()["detail"]

        # Re-enable B2B
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"b2b_enabled": True},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

    def test_guardrail_orders_switch(self, client, tokens):
        # Disable orders
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"orders_enabled": False},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

        # Customer attempts order -> 403
        res = client.post(
            "/api/v1/orders/customer",
            json={
                "product_id": "prod-ctrl-01",
                "quantity": 1
            },
            headers={"Authorization": f"Bearer {tokens['customer']}"}
        )
        assert res.status_code == 403
        assert "ORDERS_PAUSED" in res.json()["detail"]

        # Re-enable orders
        client.patch(
            "/api/v1/admin/platform-settings",
            json={"orders_enabled": True},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )

    def test_authoritative_gi_verification(self, client, tokens):
        # Toggle GI verification for artisan
        res = client.post(
            "/api/v1/admin/artisans/art-ctrl-01/verify-gi",
            json={
                "verified": True,
                "gi_registration_name": "Mysuru Rosewood Inlay",
                "gi_reference": "GI-AUTH-999"
            },
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        assert res.json()["gi_status"] == "AUTHORIZED"

        # Verify DB product was updated
        db = SessionLocal()
        prod = db.query(Product).filter(Product.id == "prod-ctrl-01").first()
        assert prod.gi_artisan_authorization_status == "AUTHORIZED"
        assert prod.gi_craft_registered is True
        db.close()

    def test_authoritative_cluster_wage_update(self, client, tokens):
        res = client.patch(
            "/api/v1/admin/clusters/cluster-control-01/wage",
            json={
                "statutory_daily_wage": 720.0,
                "statutory_hourly_wage": 90.0
            },
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["statutory_daily_wage"] == 720.0
        assert data["statutory_hourly_wage"] == 90.0

        # Verify in DB
        db = SessionLocal()
        cluster = db.query(CraftCluster).filter(CraftCluster.id == "cluster-control-01").first()
        assert cluster.statutory_daily_wage == 720.0
        assert cluster.statutory_hourly_wage == 90.0
        db.close()

    def test_product_moderation_lifecycle(self, client, tokens):
        # 1. Unpublish product with mandatory reason
        res = client.post(
            "/api/v1/admin/products/prod-ctrl-01/moderate",
            json={
                "action": "unpublish",
                "reason": "Suspected copyright infringement"
            },
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is False

        # Verify DB
        db = SessionLocal()
        prod = db.query(Product).filter(Product.id == "prod-ctrl-01").first()
        assert prod.is_active is False
        db.close()

        # 2. Server restore
        res = client.post(
            "/api/v1/admin/products/prod-ctrl-01/restore",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        assert res.json()["is_active"] is True

        db = SessionLocal()
        prod = db.query(Product).filter(Product.id == "prod-ctrl-01").first()
        assert prod.is_active is True
        db.close()

    def test_user_suspension_and_reactivation(self, client, tokens):
        # 1. Super Admin cannot suspend self
        res = client.post(
            "/api/v1/admin/users/sa-aryan-ctrl/suspend",
            json={"reason": "Self test"},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 400
        assert "CANNOT_SUSPEND_SELF" in res.json()["detail"]

        # 2. Suspend an artisan account
        res = client.post(
            "/api/v1/admin/users/art-ctrl-01/suspend",
            json={"reason": "Terms of service violation"},
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        assert res.json()["is_suspended"] is True

        # Suspended user's subsequent requests should be rejected with 403 ACCOUNT_DEACTIVATED
        res = client.get(
            "/api/v1/products/artisan/my",
            headers={"Authorization": f"Bearer {tokens['artisan']}"}
        )
        assert res.status_code == 403
        assert "ACCOUNT_DEACTIVATED" in res.json()["detail"]

        # 3. Reactivate user account
        res = client.post(
            "/api/v1/admin/users/art-ctrl-01/reactivate",
            headers={"Authorization": f"Bearer {tokens['super_admin']}"}
        )
        assert res.status_code == 200
        assert res.json()["is_suspended"] is False

        # Reactivated user can now access resources again
        res = client.get(
            "/api/v1/products/artisan/my",
            headers={"Authorization": f"Bearer {tokens['artisan']}"}
        )
        assert res.status_code == 200
